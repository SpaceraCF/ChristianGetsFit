import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek } from "date-fns";
import { checkAndAwardAchievements } from "@/lib/gamification";
import { awardQuestXp } from "@/lib/quests";
import { MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";

// New body shape — finalize an already-saved workout.
const finalizeBodySchema = z.object({
  workoutId: z.string(),
});

// Legacy body shape — all-in-one save for older clients.
const legacyBodySchema = z.object({
  workoutType: z.enum(["A", "B", "C"]),
  isExpress: z.boolean(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      weightKg: z.number(),
      setsCompleted: z.number(),
      // repsCompleted is optional for backwards compat with the old client.
      // If absent, fall back to the legacy hardcoded [11,11,11] pattern.
      repsCompleted: z.array(z.number().int().min(0)).optional(),
      difficultyFeedback: z.enum(["too_light", "just_right", "too_heavy"]),
      enjoyed: z.boolean(),
    })
  ),
});

/**
 * POST /api/workout/complete
 *
 * Two body shapes for backwards compatibility:
 *
 *   Preferred:  { workoutId }
 *               Finalizes a workout that was started via /workout/start
 *               and has its exercises saved piecewise via /workout/exercise-log.
 *
 *   Legacy:     { workoutType, isExpress, exercises: [...] }
 *               All-in-one save the original client used. Wrapped in a
 *               transaction so partial state can no longer leak. Now
 *               accepts repsCompleted from the client; falls back to
 *               the old hardcoded [11,11,11] if the field is absent.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const raw = await req.json();
    const finalize = finalizeBodySchema.safeParse(raw);
    if (finalize.success) {
      return await finalizeWorkout(user.id, finalize.data.workoutId);
    }
    const legacy = legacyBodySchema.parse(raw);
    return await legacySave(user.id, legacy);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error("[workout/complete]", e);
    return NextResponse.json({ error: "Failed to complete workout" }, { status: 500 });
  }
}

async function finalizeWorkout(userId: string, workoutId: string) {
  const completedAt = new Date();
  const workoutId_ = await prisma.$transaction(async (tx) => {
    const workout = await tx.workout.findFirst({
      where: { id: workoutId, userId },
      include: { exerciseLogs: { select: { exerciseId: true } } },
    });
    if (!workout) {
      throw new HTTPError(404, "Workout not found");
    }
    if (workout.completedAt) {
      // Idempotent: returning OK lets a retried "complete" call from a
      // flaky client succeed instead of erroring.
      return workout.id;
    }

    // Compute duration: prefer the gap between scheduled_at (which we set
    // to "started_at" at /start time) and now. Fall back to 30 / 15 min.
    let durationMins: number;
    if (workout.scheduledAt) {
      durationMins = Math.max(1, Math.round((completedAt.getTime() - workout.scheduledAt.getTime()) / 60000));
    } else {
      durationMins = workout.isExpress ? 15 : 30;
    }
    // Clamp to a sane range — if a workout was "open" for hours because the
    // user crashed and resumed, we don't want to record an 8h duration.
    durationMins = Math.min(durationMins, 120);

    await tx.workout.update({
      where: { id: workout.id },
      data: {
        completedAt,
        durationMins,
        exercisesCompleted: workout.exerciseLogs.map((l) => l.exerciseId),
      },
    });

    await recomputeWeeklyStat(tx, userId, completedAt);
    return workout.id;
  });

  await checkAndAwardAchievements(userId, "workout");
  await awardQuestXp(userId);
  return NextResponse.json({ ok: true, workoutId: workoutId_ });
}

async function legacySave(
  userId: string,
  body: z.infer<typeof legacyBodySchema>
) {
  const startedAt = new Date();
  const workoutId = await prisma.$transaction(async (tx) => {
    const workout = await tx.workout.create({
      data: {
        userId,
        workoutType: body.workoutType,
        isExpress: body.isExpress,
        scheduledAt: startedAt,
        completedAt: startedAt,
        durationMins: body.isExpress ? 15 : 30,
        exercisesCompleted: body.exercises.map((e) => e.exerciseId),
      },
    });

    for (const ex of body.exercises) {
      const reps = ex.repsCompleted ?? Array(ex.setsCompleted).fill(11);
      await tx.exerciseLog.create({
        data: {
          workoutId: workout.id,
          exerciseId: ex.exerciseId,
          setsCompleted: ex.setsCompleted,
          repsPerSet: reps,
          weightKg: ex.weightKg,
          difficultyFeedback: ex.difficultyFeedback,
          enjoyed: ex.enjoyed,
        },
      });

      const exercise = await tx.exercise.findUnique({ where: { id: ex.exerciseId } });
      const inc = exercise?.weightIncrementKg ?? 2.5;
      const repsMax = exercise?.repsMax ?? 12;
      const hitRepCap = reps.some((r) => r >= repsMax);

      const pref = await tx.exercisePreference.findUnique({
        where: { userId_exerciseId: { userId, exerciseId: ex.exerciseId } },
      });

      let newWeight = ex.weightKg;
      let sessionsAtCurrent = 1;
      if (pref) {
        if (ex.difficultyFeedback === "too_heavy") {
          newWeight = Math.max(inc, ex.weightKg - inc);
          sessionsAtCurrent = 0;
        } else if (ex.difficultyFeedback === "too_light" || hitRepCap) {
          newWeight = ex.weightKg + inc;
          sessionsAtCurrent = 0;
        } else if (pref.currentWeightKg === ex.weightKg) {
          sessionsAtCurrent = pref.sessionsAtCurrentWeight + 1;
          if (sessionsAtCurrent >= 3) {
            newWeight = ex.weightKg + inc;
            sessionsAtCurrent = 0;
          }
        }
      }

      await tx.exercisePreference.upsert({
        where: { userId_exerciseId: { userId, exerciseId: ex.exerciseId } },
        create: {
          userId,
          exerciseId: ex.exerciseId,
          blacklisted: !ex.enjoyed,
          currentWeightKg: newWeight,
          sessionsAtCurrentWeight: sessionsAtCurrent,
          totalSessions: 1,
          lastPerformedAt: startedAt,
        },
        update: {
          blacklisted: ex.enjoyed ? false : true,
          currentWeightKg: newWeight,
          sessionsAtCurrentWeight: sessionsAtCurrent,
          totalSessions: { increment: 1 },
          lastPerformedAt: startedAt,
        },
      });
    }

    await recomputeWeeklyStat(tx, userId, startedAt);
    return workout.id;
  });

  await checkAndAwardAchievements(userId, "workout");
  await awardQuestXp(userId);
  return NextResponse.json({ ok: true, workoutId });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function recomputeWeeklyStat(tx: Tx, userId: string, when: Date) {
  const weekStart = startOfWeek(when, { weekStartsOn: 1 });
  const existing = await tx.weeklyStat.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });
  const count = await tx.workout.count({
    where: {
      userId,
      completedAt: {
        not: null,
        gte: weekStart,
        lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
  });
  if (existing) {
    await tx.weeklyStat.update({
      where: { id: existing.id },
      data: {
        workoutsCompleted: count,
        punishmentActive: count < MIN_WORKOUTS_FOR_GOAL,
        xpEarned: existing.xpEarned + 50,
      },
    });
  } else {
    await tx.weeklyStat.create({
      data: {
        userId,
        weekStart,
        workoutsCompleted: count,
        punishmentActive: count < MIN_WORKOUTS_FOR_GOAL,
        xpEarned: 50,
      },
    });
  }
}

class HTTPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

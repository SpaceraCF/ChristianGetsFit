import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek } from "date-fns";
import { checkAndAwardAchievements } from "@/lib/gamification";
import { MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";

const bodySchema = z.object({
  workoutType: z.enum(["A", "B", "C"]),
  isExpress: z.boolean(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      weightKg: z.number(),
      setsCompleted: z.number(),
      difficultyFeedback: z.enum(["too_light", "just_right", "too_heavy"]),
      enjoyed: z.boolean(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());

    const startedAt = new Date();
    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        workoutType: body.workoutType,
        isExpress: body.isExpress,
        scheduledAt: startedAt,
        completedAt: startedAt,
        durationMins: body.isExpress ? 15 : 30,
        exercisesCompleted: body.exercises.map((e) => e.exerciseId),
      },
    });

    for (const ex of body.exercises) {
      await prisma.exerciseLog.create({
        data: {
          workoutId: workout.id,
          exerciseId: ex.exerciseId,
          setsCompleted: ex.setsCompleted,
          repsPerSet: Array(ex.setsCompleted).fill(
            Math.floor((10 + 12) / 2)
          ),
          weightKg: ex.weightKg,
          difficultyFeedback: ex.difficultyFeedback,
          enjoyed: ex.enjoyed,
        },
      });

      const pref = await prisma.exercisePreference.findUnique({
        where: { userId_exerciseId: { userId: user.id, exerciseId: ex.exerciseId } },
      });

      let newWeight = ex.weightKg;
      let sessionsAtCurrent = 1;
      if (pref) {
        if (ex.difficultyFeedback === "too_heavy") {
          const exercise = await prisma.exercise.findUnique({ where: { id: ex.exerciseId } });
          const inc = exercise?.weightIncrementKg ?? 2.5;
          newWeight = Math.max(inc, ex.weightKg - inc);
          sessionsAtCurrent = 0;
        } else if (ex.difficultyFeedback === "too_light") {
          const exercise = await prisma.exercise.findUnique({ where: { id: ex.exerciseId } });
          const inc = exercise?.weightIncrementKg ?? 2.5;
          newWeight = ex.weightKg + inc;
          sessionsAtCurrent = 0;
        } else if (pref.currentWeightKg === ex.weightKg) {
          sessionsAtCurrent = pref.sessionsAtCurrentWeight + 1;
          if (sessionsAtCurrent >= 3) {
            const exercise = await prisma.exercise.findUnique({ where: { id: ex.exerciseId } });
            const inc = exercise?.weightIncrementKg ?? 2.5;
            newWeight = ex.weightKg + inc;
            sessionsAtCurrent = 0;
          }
        }
      }

      await prisma.exercisePreference.upsert({
        where: { userId_exerciseId: { userId: user.id, exerciseId: ex.exerciseId } },
        create: {
          userId: user.id,
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

    const weekStart = startOfWeek(startedAt, { weekStartsOn: 1 });
    const existing = await prisma.weeklyStat.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    });
    const count = await prisma.workout.count({
      where: {
        userId: user.id,
        completedAt: { not: null, gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) {
      await prisma.weeklyStat.update({
        where: { id: existing.id },
        data: {
          workoutsCompleted: count,
          punishmentActive: count < MIN_WORKOUTS_FOR_GOAL,
          xpEarned: existing.xpEarned + 50,
        },
      });
    } else {
      await prisma.weeklyStat.create({
        data: {
          userId: user.id,
          weekStart,
          workoutsCompleted: count,
          punishmentActive: count < MIN_WORKOUTS_FOR_GOAL,
          xpEarned: 50,
        },
      });
    }

    await checkAndAwardAchievements(user.id, "workout");
    return NextResponse.json({ ok: true, workoutId: workout.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to complete workout" }, { status: 500 });
  }
}

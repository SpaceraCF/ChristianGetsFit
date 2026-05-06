import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  workoutId: z.string(),
  exerciseId: z.string(),
  weightKg: z.number(),
  setsCompleted: z.number().int().min(1),
  repsCompleted: z.array(z.number().int().min(0)).min(1),
  difficultyFeedback: z.enum(["too_light", "just_right", "too_heavy"]),
  enjoyed: z.boolean(),
});

/**
 * POST /api/workout/exercise-log
 *
 * Persists a single exercise's results to an in-progress Workout. Idempotent
 * on (workoutId, exerciseId): a second post for the same pair updates the
 * existing log row rather than creating a duplicate. This makes the client
 * safe to retry on flaky networks.
 *
 * The whole save (ExerciseLog upsert + ExercisePreference upsert with
 * progression logic) is wrapped in a transaction so partial state can't leak.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const workout = await tx.workout.findFirst({
        where: { id: body.workoutId, userId: user.id },
        select: { id: true, completedAt: true },
      });
      if (!workout) {
        throw new HTTPError(404, "Workout not found");
      }
      if (workout.completedAt) {
        throw new HTTPError(409, "Workout already completed");
      }

      const existing = await tx.exerciseLog.findFirst({
        where: { workoutId: body.workoutId, exerciseId: body.exerciseId },
      });
      const logData = {
        setsCompleted: body.setsCompleted,
        repsPerSet: body.repsCompleted,
        weightKg: body.weightKg,
        difficultyFeedback: body.difficultyFeedback,
        enjoyed: body.enjoyed,
      };
      let logId: string;
      if (existing) {
        const updated = await tx.exerciseLog.update({ where: { id: existing.id }, data: logData });
        logId = updated.id;
      } else {
        const created = await tx.exerciseLog.create({
          data: { workoutId: body.workoutId, exerciseId: body.exerciseId, ...logData },
        });
        logId = created.id;
      }

      // Progression: update ExercisePreference based on difficulty feedback +
      // hit-the-rep-cap rule (if any set hit reps_max, treat as too_light).
      const exercise = await tx.exercise.findUnique({ where: { id: body.exerciseId } });
      const inc = exercise?.weightIncrementKg ?? 2.5;
      const repsMax = exercise?.repsMax ?? 12;
      const hitRepCap = body.repsCompleted.some((r) => r >= repsMax);

      const pref = await tx.exercisePreference.findUnique({
        where: { userId_exerciseId: { userId: user.id, exerciseId: body.exerciseId } },
      });

      let newWeight = body.weightKg;
      let sessionsAtCurrent = 1;
      if (pref) {
        if (body.difficultyFeedback === "too_heavy") {
          newWeight = Math.max(inc, body.weightKg - inc);
          sessionsAtCurrent = 0;
        } else if (body.difficultyFeedback === "too_light" || hitRepCap) {
          newWeight = body.weightKg + inc;
          sessionsAtCurrent = 0;
        } else if (pref.currentWeightKg === body.weightKg) {
          sessionsAtCurrent = pref.sessionsAtCurrentWeight + 1;
          if (sessionsAtCurrent >= 3) {
            newWeight = body.weightKg + inc;
            sessionsAtCurrent = 0;
          }
        }
      }

      const isUpdate = !!existing;
      await tx.exercisePreference.upsert({
        where: { userId_exerciseId: { userId: user.id, exerciseId: body.exerciseId } },
        create: {
          userId: user.id,
          exerciseId: body.exerciseId,
          blacklisted: !body.enjoyed,
          currentWeightKg: newWeight,
          sessionsAtCurrentWeight: sessionsAtCurrent,
          totalSessions: 1,
          lastPerformedAt: new Date(),
        },
        update: {
          blacklisted: body.enjoyed ? false : true,
          currentWeightKg: newWeight,
          sessionsAtCurrentWeight: sessionsAtCurrent,
          totalSessions: isUpdate ? undefined : { increment: 1 },
          lastPerformedAt: new Date(),
        },
      });

      return { logId, weightAfter: newWeight, hitRepCap };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    if (e instanceof HTTPError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[workout/exercise-log]", e);
    return NextResponse.json({ error: "Failed to log exercise" }, { status: 500 });
  }
}

class HTTPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

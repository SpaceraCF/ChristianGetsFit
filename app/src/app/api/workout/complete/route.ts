import { NextRequest, NextResponse } from "next/server";
import { startOfWeek } from "date-fns";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";
import { prisma } from "@/lib/db";
import { checkAndAwardAchievements } from "@/lib/gamification";
import {
  nextPeakWeight,
  programStateFromCompletedSessions,
} from "@/lib/program";
import { awardQuestXp } from "@/lib/quests";
import {
  getExercisesForWorkout,
  getUserProgramState,
} from "@/lib/workout";

const exerciseSchema = z
  .object({
    exerciseId: z.string().min(1),
    weightKg: z.number().min(0).max(1000),
    setsCompleted: z.number().int().min(1).max(6),
    repsPerSet: z.array(z.number().int().min(1).max(100)).min(1).max(6),
    difficultyFeedback: z.enum(["too_light", "just_right", "too_heavy"]),
    enjoyed: z.boolean(),
  })
  .refine((exercise) => exercise.repsPerSet.length === exercise.setsCompleted, {
    message: "Each completed set needs a rep count",
    path: ["repsPerSet"],
  });

const bodySchema = z.object({
  workoutType: z.enum(["A", "B", "C"]),
  isExpress: z.boolean(),
  durationMins: z.number().int().min(1).max(180).optional(),
  exercises: z.array(exerciseSchema).min(1).max(5),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const program = await getUserProgramState(user.id);
    const plannedExercises = await getExercisesForWorkout(
      user.id,
      body.workoutType,
      body.isExpress,
      program,
    );
    const plannedIds = new Set(plannedExercises.map((exercise) => exercise.id));
    const submittedIds = new Set(body.exercises.map((exercise) => exercise.exerciseId));
    if (
      body.exercises.length !== plannedExercises.length ||
      submittedIds.size !== body.exercises.length ||
      body.exercises.some((exercise) => !plannedIds.has(exercise.exerciseId))
    ) {
      return NextResponse.json(
        { error: "This workout no longer matches the active program. Reload it and try again." },
        { status: 409 },
      );
    }

    const planById = new Map(
      plannedExercises.map((exercise) => [exercise.id, exercise]),
    );
    const completedAt = new Date();
    const durationMins = body.durationMins ?? (body.isExpress ? 15 : 30);
    const startedAt = new Date(completedAt.getTime() - durationMins * 60_000);
    const weekStart = startOfWeek(completedAt, { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const workout = await prisma.$transaction(async (tx) => {
      if (!program.startedAt) {
        await tx.user.update({
          where: { id: user.id },
          data: { workoutProgramStartedAt: startedAt },
        });
      }
      const savedWorkout = await tx.workout.create({
        data: {
          userId: user.id,
          workoutType: body.workoutType,
          isExpress: body.isExpress,
          scheduledAt: startedAt,
          completedAt,
          durationMins,
          programCycle: program.cycle,
          programBlock: program.block,
          programWeek: program.week,
          programSession: program.sessionInBlock,
          targetRir: program.targetRir,
          exercisesCompleted: body.exercises.map((exercise) => exercise.exerciseId),
        },
      });

      for (const submitted of body.exercises) {
        const planned = planById.get(submitted.exerciseId);
        if (!planned) throw new Error("Submitted exercise is not in this program");
        await tx.exerciseLog.create({
          data: {
            workoutId: savedWorkout.id,
            exerciseId: submitted.exerciseId,
            setsCompleted: submitted.setsCompleted,
            repsPerSet: submitted.repsPerSet,
            weightKg: submitted.weightKg,
            difficultyFeedback: submitted.difficultyFeedback,
            enjoyed: submitted.enjoyed,
          },
        });

        const existing = await tx.exercisePreference.findUnique({
          where: {
            userId_exerciseId: {
              userId: user.id,
              exerciseId: submitted.exerciseId,
            },
          },
        });
        const peakWeightKg = nextPeakWeight({
          performedWeightKg: submitted.weightKg,
          incrementKg: planned.weightIncrementKg,
          week: program.week,
          feedback: submitted.difficultyFeedback,
        });
        const unchanged = existing?.currentWeightKg === peakWeightKg;
        await tx.exercisePreference.upsert({
          where: {
            userId_exerciseId: {
              userId: user.id,
              exerciseId: submitted.exerciseId,
            },
          },
          create: {
            userId: user.id,
            exerciseId: submitted.exerciseId,
            blacklisted: !submitted.enjoyed,
            currentWeightKg: peakWeightKg,
            sessionsAtCurrentWeight: 1,
            totalSessions: 1,
            lastPerformedAt: completedAt,
          },
          update: {
            blacklisted: !submitted.enjoyed,
            currentWeightKg: peakWeightKg,
            sessionsAtCurrentWeight: unchanged
              ? { increment: 1 }
              : 1,
            totalSessions: { increment: 1 },
            lastPerformedAt: completedAt,
          },
        });
      }

      const workoutsThisWeek = await tx.workout.count({
        where: {
          userId: user.id,
          completedAt: { not: null, gte: weekStart, lt: weekEnd },
        },
      });
      await tx.weeklyStat.upsert({
        where: { userId_weekStart: { userId: user.id, weekStart } },
        create: {
          userId: user.id,
          weekStart,
          workoutsCompleted: workoutsThisWeek,
          punishmentActive: workoutsThisWeek < MIN_WORKOUTS_FOR_GOAL,
          xpEarned: 50,
        },
        update: {
          workoutsCompleted: workoutsThisWeek,
          punishmentActive: workoutsThisWeek < MIN_WORKOUTS_FOR_GOAL,
          xpEarned: { increment: 50 },
        },
      });
      return savedWorkout;
    });

    await checkAndAwardAchievements(user.id, "workout");
    await awardQuestXp(user.id);
    return NextResponse.json({
      ok: true,
      workoutId: workout.id,
      nextProgram: programStateFromCompletedSessions(program.completedSessions + 1),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to complete workout" }, { status: 500 });
  }
}

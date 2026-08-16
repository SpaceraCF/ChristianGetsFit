import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  HEALTHTRACK_EXPORT_PATH,
  verifyHealthTrackSignature,
} from "@/lib/healthtrack-bridge";
import { WORKOUT_LABELS, type WorkoutType } from "@/lib/program";
import { getUserProgramState } from "@/lib/workout";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.HEALTHTRACK_BRIDGE_SECRET ?? "";
  if (secret.length < 32) {
    return NextResponse.json(
      { error: "HealthTrack bridge is not configured" },
      { status: 503 },
    );
  }
  const authorized = verifyHealthTrackSignature({
    secret,
    timestamp: request.headers.get("x-healthtrack-timestamp"),
    signature: request.headers.get("x-healthtrack-signature"),
    path: HEALTHTRACK_EXPORT_PATH,
  });
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerEmail = (
    process.env.OWNER_EMAIL ?? "christian.farre@gmail.com"
  ).toLowerCase();
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    return NextResponse.json({ error: "Workout owner not found" }, { status: 404 });
  }
  const [program, workouts] = await Promise.all([
    getUserProgramState(owner.id),
    prisma.workout.findMany({
      where: { userId: owner.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 500,
      include: {
        exerciseLogs: {
          include: {
            exercise: {
              select: { name: true, loadMultiplier: true },
            },
          },
        },
      },
    }),
  ]);

  const response = NextResponse.json({
    version: 1,
    generatedAt: new Date().toISOString(),
    program: {
      ...program,
      startedAt: program.startedAt?.toISOString() ?? null,
      workoutsPerTrainingWeek: 3,
      sessionsPerBlock: 12,
      launchUrl: `${process.env.APP_URL ?? "https://cgf.one22.me"}/dashboard/workout`,
    },
    workouts: workouts.map((workout) => {
      const exercises = workout.exerciseLogs.map((log) => {
        const volumeKg =
          log.weightKg *
          log.exercise.loadMultiplier *
          log.repsPerSet.reduce((total, reps) => total + reps, 0);
        return {
          name: log.exercise.name,
          setCount: log.setsCompleted,
          repsPerSet: log.repsPerSet,
          weightKg: log.weightKg,
          volumeKg,
          difficultyFeedback: log.difficultyFeedback,
        };
      });
      const type = workout.workoutType as WorkoutType;
      return {
        id: workout.id,
        name: `${WORKOUT_LABELS[type]?.name ?? `Workout ${type}`}${
          workout.programBlock && workout.programWeek
            ? ` · Block ${workout.programBlock}, week ${workout.programWeek}`
            : ""
        }`,
        date: workout.completedAt?.toISOString(),
        durationMinutes: workout.durationMins,
        totalVolumeKg: exercises.reduce(
          (total, exercise) => total + exercise.volumeKg,
          0,
        ),
        exerciseCount: exercises.length,
        isExpress: workout.isExpress,
        programBlock: workout.programBlock,
        programWeek: workout.programWeek,
        targetRir: workout.targetRir,
        exercises,
      };
    }),
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

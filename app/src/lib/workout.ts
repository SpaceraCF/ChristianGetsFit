import { prisma } from "@/lib/db";
import {
  programStateFromCompletedSessions,
  recommendedWeightForWeek,
  type ProgramState,
  type WorkoutType,
} from "@/lib/program";

export type { WorkoutType } from "@/lib/program";

export type UserProgramState = ProgramState & {
  startedAt: Date | null;
};

export async function getUserProgramState(
  userId: string,
): Promise<UserProgramState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { workoutProgramStartedAt: true },
  });
  const completedSessions = user.workoutProgramStartedAt
    ? await prisma.workout.count({
        where: {
          userId,
          completedAt: { not: null, gte: user.workoutProgramStartedAt },
        },
      })
    : 0;
  return {
    ...programStateFromCompletedSessions(completedSessions),
    startedAt: user.workoutProgramStartedAt,
  };
}

type WorkoutExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  instructions: string | null;
  weightCue: string | null;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSecs: number;
  recommendedWeightKg: number;
  weightIncrementKg: number;
  orderInWorkout: number;
  isWarmUp: false;
  videoUrl: string | null;
};

/** Select the active block, then apply blacklist and injury substitutions. */
export async function getExercisesForWorkout(
  userId: string,
  workoutType: WorkoutType,
  isExpress: boolean,
  suppliedProgram?: UserProgramState,
): Promise<WorkoutExercise[]> {
  const program = suppliedProgram ?? (await getUserProgramState(userId));
  const [placements, preferences, activeInjuries, user] = await Promise.all([
    prisma.programExercise.findMany({
      where: { programBlock: program.block, workoutType },
      include: { exercise: true },
      orderBy: { orderInWorkout: "asc" },
    }),
    prisma.exercisePreference.findMany({ where: { userId } }),
    prisma.injury.findMany({
      where: { userId, resolvedAt: null },
      select: { bodyArea: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentWeight: true, startingWeight: true },
    }),
  ]);

  const preferenceByExercise = new Map(
    preferences.map((preference) => [preference.exerciseId, preference]),
  );
  const injuredAreas = new Set(
    activeInjuries.map((injury) => injury.bodyArea.toLowerCase()),
  );
  const bodyWeightKg = user?.currentWeight ?? user?.startingWeight ?? 82;
  const limit = isExpress ? 3 : placements.length;
  const output: WorkoutExercise[] = [];
  const used = new Set<string>();

  const isUnavailable = (exercise: (typeof placements)[number]["exercise"]) =>
    preferenceByExercise.get(exercise.id)?.blacklisted === true ||
    exercise.injuryAreasToSkip.some((area) =>
      injuredAreas.has(area.toLowerCase()),
    );

  const addExercise = (exercise: (typeof placements)[number]["exercise"]) => {
    const preference = preferenceByExercise.get(exercise.id);
    const increment = exercise.weightIncrementKg;
    const initialPeak =
      increment > 0
        ? Math.max(
            increment,
            Math.round(
              (bodyWeightKg * exercise.baseWeightPercent) / increment,
            ) * increment,
          )
        : 0;
    const peakWeightKg = preference?.currentWeightKg ?? initialPeak;
    output.push({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
      weightCue: exercise.weightCue,
      sets: program.prescribedSets,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
      restSecs: exercise.restSecs,
      recommendedWeightKg: recommendedWeightForWeek({
        peakWeightKg,
        incrementKg: increment,
        week: program.week,
      }),
      weightIncrementKg: increment,
      orderInWorkout: output.length,
      isWarmUp: false,
      videoUrl: exercise.videoUrl,
    });
    used.add(exercise.id);
  };

  for (const placement of placements) {
    if (output.length >= limit) break;
    const exercise = placement.exercise;
    if (!isUnavailable(exercise) && !used.has(exercise.id)) {
      addExercise(exercise);
      continue;
    }

    for (const substituteId of exercise.substituteExerciseIds) {
      if (used.has(substituteId)) continue;
      const substitute = await prisma.exercise.findUnique({
        where: { id: substituteId },
      });
      if (substitute && !isUnavailable(substitute)) {
        addExercise(substitute);
        break;
      }
    }
  }

  return output;
}

export async function getWarmUpExercises() {
  return prisma.exercise.findMany({
    where: { isWarmUp: true, programKey: { startsWith: "warm-" } },
    orderBy: { warmUpOrder: "asc" },
  });
}

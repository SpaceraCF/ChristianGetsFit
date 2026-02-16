import { prisma } from "@/lib/db";

export type WorkoutType = "A" | "B" | "C";

/** Get exercises for a workout type, applying blacklist and injury substitutions */
export async function getExercisesForWorkout(
  userId: string,
  workoutType: WorkoutType,
  isExpress: boolean
): Promise<
  Array<{
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    instructions: string | null;
    sets: number;
    repsMin: number;
    repsMax: number;
    restSecs: number;
    recommendedWeightKg: number;
    orderInWorkout: number;
    isWarmUp: boolean;
  }>
> {
  const all = await prisma.exercise.findMany({
    where: { workoutType, isWarmUp: false },
    orderBy: { orderInWorkout: "asc" },
  });

  const limit = isExpress ? 3 : all.length;
  const prefs = await prisma.exercisePreference.findMany({
    where: { userId, blacklisted: true },
    select: { exerciseId: true },
  });
  const blacklistedIds = new Set(prefs.map((p) => p.exerciseId));

  const activeInjuries = await prisma.injury.findMany({
    where: { userId, resolvedAt: null },
    select: { bodyArea: true },
  });
  const injuredAreas = new Set(activeInjuries.map((i) => i.bodyArea.toLowerCase()));

  const out: Array<{
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    instructions: string | null;
    sets: number;
    repsMin: number;
    repsMax: number;
    restSecs: number;
    recommendedWeightKg: number;
    orderInWorkout: number;
    isWarmUp: boolean;
    videoUrl: string | null;
  }> = [];
  const used = new Set<string>();

  for (let i = 0; i < all.length && out.length < limit; i++) {
    const ex = all[i];
    if (blacklistedIds.has(ex.id)) continue;
    const skip = ex.injuryAreasToSkip.some((a) => injuredAreas.has(a.toLowerCase()));
    if (skip && ex.substituteExerciseIds.length > 0) {
      for (const subId of ex.substituteExerciseIds) {
        if (used.has(subId)) continue;
        const sub = all.find((e) => e.id === subId) ?? await prisma.exercise.findUnique({ where: { id: subId } });
        if (sub && !blacklistedIds.has(sub.id)) {
          const subInjured = sub.injuryAreasToSkip.some((a) => injuredAreas.has(a.toLowerCase()));
          if (!subInjured) {
            used.add(sub.id);
            const rec = await getRecommendedWeight(userId, sub);
            out.push({
              id: sub.id,
              name: sub.name,
              muscleGroup: sub.muscleGroup,
              equipment: sub.equipment,
              instructions: sub.instructions,
              sets: sub.sets,
              repsMin: sub.repsMin,
              repsMax: sub.repsMax,
              restSecs: sub.restSecs,
              recommendedWeightKg: rec,
              orderInWorkout: out.length,
              isWarmUp: false,
              videoUrl: sub.videoUrl,
            });
            break;
          }
        }
      }
      continue;
    }
    if (skip) continue;
    used.add(ex.id);
    const rec = await getRecommendedWeight(userId, ex);
    out.push({
      id: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      instructions: ex.instructions,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      restSecs: ex.restSecs,
      recommendedWeightKg: rec,
      orderInWorkout: out.length,
      isWarmUp: false,
      videoUrl: ex.videoUrl,
    });
  }

  return out;
}

/** Get recommended weight for user based on preference history or bodyweight % */
async function getRecommendedWeight(
  userId: string,
  exercise: { id: string; baseWeightPercent: number; weightIncrementKg: number; equipment: string }
): Promise<number> {
  const pref = await prisma.exercisePreference.findUnique({
    where: { userId_exerciseId: { userId, exerciseId: exercise.id } },
  });
  if (pref?.currentWeightKg != null) return pref.currentWeightKg;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentWeight: true, startingWeight: true },
  });
  const bw = user?.currentWeight ?? user?.startingWeight ?? 82;
  const raw = bw * exercise.baseWeightPercent;
  const inc = exercise.weightIncrementKg;
  if (inc <= 0) return 0;
  const rounded = Math.round(raw / inc) * inc;
  return Math.max(inc, rounded);
}

/** Get warm-up exercises in order */
export async function getWarmUpExercises() {
  return prisma.exercise.findMany({
    where: { isWarmUp: true },
    orderBy: { warmUpOrder: "asc" },
  });
}

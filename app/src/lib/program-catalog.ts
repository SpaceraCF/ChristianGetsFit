import type { PrismaClient } from "@prisma/client";

type ExerciseDefinition = {
  key: string;
  name: string;
  muscleGroup: string;
  equipment: "smith_machine" | "dumbbell" | "bodyweight";
  instructions: string;
  weightCue: string;
  baseWeightPercent: number;
  weightIncrementKg: number;
  repsMin: number;
  repsMax: number;
  restSecs: number;
  injuryAreasToSkip: string[];
};

const SMITH_WEIGHT_CUE =
  "Use the same total-load convention for your Smith machine every time.";
const PAIR_WEIGHT_CUE = "Enter the kilograms on each dumbbell.";
const SINGLE_WEIGHT_CUE = "Enter the kilograms on the single dumbbell.";
const BODYWEIGHT_CUE = "Bodyweight — no load entry needed.";

const warmUps = [
  {
    key: "warm-arm-circles",
    name: "Arm circles",
    muscleGroup: "shoulders",
    instructions: "Stand tall. Make small circles, then larger circles for 30 seconds.",
    order: 0,
    injuryAreasToSkip: [] as string[],
  },
  {
    key: "warm-hip-hinge",
    name: "Bodyweight hip hinge",
    muscleGroup: "hips",
    instructions: "Push your hips back with a neutral spine for 8 slow practice reps.",
    order: 1,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "warm-squat-to-bench",
    name: "Bodyweight squat to bench",
    muscleGroup: "legs",
    instructions: "Sit back to a bench and stand smoothly for 8 controlled reps.",
    order: 2,
    injuryAreasToSkip: ["knee", "back", "hip"],
  },
  {
    key: "warm-wall-push-up",
    name: "Wall push-up",
    muscleGroup: "chest",
    instructions: "Complete 8 easy reps, keeping your body in one straight line.",
    order: 3,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
  {
    key: "warm-march",
    name: "March in place",
    muscleGroup: "full",
    instructions: "March comfortably for 45 seconds and let your breathing rise gently.",
    order: 4,
    injuryAreasToSkip: ["knee", "hip"],
  },
] as const;

const exercises: ExerciseDefinition[] = [
  {
    key: "smith-squat",
    name: "Smith Machine Squat",
    muscleGroup: "legs",
    equipment: "smith_machine",
    instructions: "Set the safety stops first. Keep feet planted and descend only as far as you can control without pain.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.4,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "back", "hip"],
  },
  {
    key: "smith-bench",
    name: "Smith Machine Bench Press",
    muscleGroup: "chest",
    equipment: "smith_machine",
    instructions: "Set the safety stops just below chest level. Lower under control and keep shoulders settled on the bench.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.3,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
  {
    key: "db-chest-supported-row",
    name: "Chest-Supported Dumbbell Row",
    muscleGroup: "back",
    equipment: "dumbbell",
    instructions: "Rest your chest on a low incline bench and row toward your hips without shrugging.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.12,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 75,
    injuryAreasToSkip: ["shoulder"],
  },
  {
    key: "db-rdl",
    name: "Dumbbell Romanian Deadlift",
    muscleGroup: "hamstrings",
    equipment: "dumbbell",
    instructions: "Keep a soft knee bend, push hips back, and stop before your back position changes.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.12,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "dead-bug",
    name: "Dead Bug",
    muscleGroup: "core",
    equipment: "bodyweight",
    instructions: "Keep your lower back gently against the floor. Move opposite arm and leg slowly; count reps per side.",
    weightCue: BODYWEIGHT_CUE,
    baseWeightPercent: 0,
    weightIncrementKg: 0,
    repsMin: 6,
    repsMax: 10,
    restSecs: 45,
    injuryAreasToSkip: ["back"],
  },
  {
    key: "db-goblet-squat",
    name: "Dumbbell Goblet Squat",
    muscleGroup: "legs",
    equipment: "dumbbell",
    instructions: "Hold one dumbbell at your chest, sit between your hips, and keep the whole foot planted.",
    weightCue: SINGLE_WEIGHT_CUE,
    baseWeightPercent: 0.18,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "back", "hip"],
  },
  {
    key: "db-seated-shoulder-press",
    name: "Seated Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    equipment: "dumbbell",
    instructions: "Use the bench back for support. Press without leaning back or forcing a painful range.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.09,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["shoulder", "neck"],
  },
  {
    key: "smith-row",
    name: "Smith Machine Bent-Over Row",
    muscleGroup: "back",
    equipment: "smith_machine",
    instructions: "Hinge with a neutral spine and pull the bar toward the lower ribs. Stop if your back position changes.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.25,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["back", "shoulder"],
  },
  {
    key: "db-hip-thrust",
    name: "Dumbbell Hip Thrust",
    muscleGroup: "glutes",
    equipment: "dumbbell",
    instructions: "Support your upper back on the bench, brace, and lift hips without overextending your lower back.",
    weightCue: SINGLE_WEIGHT_CUE,
    baseWeightPercent: 0.25,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 75,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "bird-dog",
    name: "Bird Dog",
    muscleGroup: "core",
    equipment: "bodyweight",
    instructions: "From hands and knees, reach opposite arm and leg without rotating. Count reps per side.",
    weightCue: BODYWEIGHT_CUE,
    baseWeightPercent: 0,
    weightIncrementKg: 0,
    repsMin: 6,
    repsMax: 10,
    restSecs: 45,
    injuryAreasToSkip: ["wrist", "knee"],
  },
  {
    key: "db-reverse-lunge",
    name: "Dumbbell Reverse Lunge",
    muscleGroup: "legs",
    equipment: "dumbbell",
    instructions: "Step backward and lower only as far as stable. Begin bodyweight if balance is uncertain; count reps per side.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.07,
    weightIncrementKg: 1,
    repsMin: 6,
    repsMax: 10,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "hip"],
  },
  {
    key: "smith-incline-bench",
    name: "Smith Machine Incline Bench Press",
    muscleGroup: "chest",
    equipment: "smith_machine",
    instructions: "Use a low incline and set safety stops. Lower under control without letting shoulders roll forward.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.25,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
  {
    key: "db-one-arm-row",
    name: "One-Arm Supported Dumbbell Row",
    muscleGroup: "back",
    equipment: "dumbbell",
    instructions: "Support one hand on the bench, keep your torso still, and row toward your hip; count reps per side.",
    weightCue: SINGLE_WEIGHT_CUE,
    baseWeightPercent: 0.12,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 75,
    injuryAreasToSkip: ["back", "shoulder"],
  },
  {
    key: "smith-rdl",
    name: "Smith Machine Romanian Deadlift",
    muscleGroup: "hamstrings",
    equipment: "smith_machine",
    instructions: "Keep the bar close, push hips back, and stop before your neutral back position changes.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.35,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "db-suitcase-march",
    name: "Dumbbell Suitcase March",
    muscleGroup: "core",
    equipment: "dumbbell",
    instructions: "Hold one dumbbell at your side and march slowly without leaning; count steps per side.",
    weightCue: SINGLE_WEIGHT_CUE,
    baseWeightPercent: 0.1,
    weightIncrementKg: 1,
    repsMin: 10,
    repsMax: 16,
    restSecs: 45,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "smith-box-squat",
    name: "Smith Machine Box Squat",
    muscleGroup: "legs",
    equipment: "smith_machine",
    instructions: "Set safety stops and use a stable bench as a depth target. Touch lightly and stand without rocking.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.35,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "back", "hip"],
  },
  {
    key: "db-floor-press",
    name: "Dumbbell Floor Press",
    muscleGroup: "chest",
    equipment: "dumbbell",
    instructions: "Lie on the floor with knees bent. Lower until upper arms gently touch the floor, then press.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.1,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
  {
    key: "heel-tap",
    name: "Supine Heel Tap",
    muscleGroup: "core",
    equipment: "bodyweight",
    instructions: "Lie on your back with knees bent. Brace and reach toward each heel without pulling your neck.",
    weightCue: BODYWEIGHT_CUE,
    baseWeightPercent: 0,
    weightIncrementKg: 0,
    repsMin: 8,
    repsMax: 12,
    restSecs: 45,
    injuryAreasToSkip: ["back", "neck"],
  },
  {
    key: "db-split-squat",
    name: "Dumbbell Split Squat",
    muscleGroup: "legs",
    equipment: "dumbbell",
    instructions: "Use a stable split stance and hold the Smith upright for balance if needed; count reps per side.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.06,
    weightIncrementKg: 1,
    repsMin: 6,
    repsMax: 10,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "hip"],
  },
  {
    key: "db-farmer-march",
    name: "Dumbbell Farmer March",
    muscleGroup: "core",
    equipment: "dumbbell",
    instructions: "Hold dumbbells at both sides and march slowly while staying tall. Count total steps.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.09,
    weightIncrementKg: 1,
    repsMin: 12,
    repsMax: 20,
    restSecs: 45,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "db-step-up",
    name: "Dumbbell Step-Up",
    muscleGroup: "legs",
    equipment: "dumbbell",
    instructions: "Use a low, stable platform. Master bodyweight first and count controlled reps per side.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.05,
    weightIncrementKg: 1,
    repsMin: 6,
    repsMax: 10,
    restSecs: 90,
    injuryAreasToSkip: ["knee", "hip"],
  },
  {
    key: "smith-hip-thrust",
    name: "Smith Machine Hip Thrust",
    muscleGroup: "glutes",
    equipment: "smith_machine",
    instructions: "Use a pad and set the safety stops. Brace before lifting and avoid overextending at the top.",
    weightCue: SMITH_WEIGHT_CUE,
    baseWeightPercent: 0.4,
    weightIncrementKg: 2.5,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "db-incline-bench",
    name: "Dumbbell Incline Bench Press",
    muscleGroup: "chest",
    equipment: "dumbbell",
    instructions: "Use a low incline, keep shoulder blades settled, and lower only through a comfortable range.",
    weightCue: PAIR_WEIGHT_CUE,
    baseWeightPercent: 0.09,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 90,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
  {
    key: "db-glute-bridge",
    name: "Dumbbell Glute Bridge",
    muscleGroup: "glutes",
    equipment: "dumbbell",
    instructions: "Lie on the floor with the dumbbell padded at your hips. Lift without arching your lower back.",
    weightCue: SINGLE_WEIGHT_CUE,
    baseWeightPercent: 0.2,
    weightIncrementKg: 1,
    repsMin: 8,
    repsMax: 12,
    restSecs: 75,
    injuryAreasToSkip: ["back", "hip"],
  },
  {
    key: "incline-push-up",
    name: "Incline Push-Up",
    muscleGroup: "chest",
    equipment: "bodyweight",
    instructions: "Place hands on the Smith bar locked at a safe height. Keep your body straight and lower under control.",
    weightCue: BODYWEIGHT_CUE,
    baseWeightPercent: 0,
    weightIncrementKg: 0,
    repsMin: 6,
    repsMax: 12,
    restSecs: 75,
    injuryAreasToSkip: ["shoulder", "wrist"],
  },
];

const placements: Record<number, Record<"A" | "B" | "C", string[]>> = {
  1: {
    A: ["smith-squat", "smith-bench", "db-chest-supported-row", "db-rdl", "dead-bug"],
    B: ["db-goblet-squat", "db-seated-shoulder-press", "smith-row", "db-hip-thrust", "bird-dog"],
    C: ["db-reverse-lunge", "smith-incline-bench", "db-one-arm-row", "smith-rdl", "db-suitcase-march"],
  },
  2: {
    A: ["smith-box-squat", "db-floor-press", "db-one-arm-row", "db-hip-thrust", "heel-tap"],
    B: ["db-split-squat", "smith-bench", "db-chest-supported-row", "db-rdl", "db-farmer-march"],
    C: ["db-step-up", "db-seated-shoulder-press", "smith-row", "smith-hip-thrust", "dead-bug"],
  },
  3: {
    A: ["smith-squat", "db-incline-bench", "db-chest-supported-row", "smith-rdl", "db-suitcase-march"],
    B: ["db-reverse-lunge", "smith-incline-bench", "db-one-arm-row", "db-glute-bridge", "heel-tap"],
    C: ["db-goblet-squat", "incline-push-up", "smith-row", "db-rdl", "bird-dog"],
  },
};

const substitutions: Record<string, string[]> = {
  "smith-squat": ["db-goblet-squat", "smith-box-squat"],
  "smith-box-squat": ["db-goblet-squat", "smith-squat"],
  "db-goblet-squat": ["smith-box-squat", "smith-squat"],
  "db-reverse-lunge": ["db-step-up", "db-split-squat"],
  "db-split-squat": ["db-step-up", "db-reverse-lunge"],
  "db-step-up": ["db-split-squat", "db-reverse-lunge"],
  "smith-bench": ["db-floor-press", "incline-push-up"],
  "smith-incline-bench": ["db-incline-bench", "db-floor-press"],
  "db-incline-bench": ["db-floor-press", "incline-push-up"],
  "db-floor-press": ["incline-push-up", "smith-bench"],
  "db-chest-supported-row": ["db-one-arm-row", "smith-row"],
  "db-one-arm-row": ["db-chest-supported-row", "smith-row"],
  "smith-row": ["db-chest-supported-row", "db-one-arm-row"],
  "db-rdl": ["db-hip-thrust", "db-glute-bridge"],
  "smith-rdl": ["smith-hip-thrust", "db-hip-thrust"],
  "db-hip-thrust": ["db-glute-bridge", "smith-hip-thrust"],
};

export async function seedWorkoutProgram(prisma: PrismaClient) {
  for (const warmUp of warmUps) {
    const data = {
      name: warmUp.name,
      muscleGroup: warmUp.muscleGroup,
      equipment: "bodyweight",
      instructions: warmUp.instructions,
      weightCue: BODYWEIGHT_CUE,
      loadMultiplier: 1,
      baseWeightPercent: 0,
      weightIncrementKg: 0,
      substituteExerciseIds: [] as string[],
      warmUpOrder: warmUp.order,
      workoutType: null,
      orderInWorkout: warmUp.order,
      sets: 1,
      repsMin: 1,
      repsMax: 1,
      restSecs: 0,
      isWarmUp: true,
      injuryAreasToSkip: [...warmUp.injuryAreasToSkip],
    };
    await prisma.exercise.upsert({
      where: { programKey: warmUp.key },
      create: { programKey: warmUp.key, ...data },
      update: data,
    });
  }

  const idsByKey = new Map<string, string>();
  for (const exercise of exercises) {
    const data = {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
      weightCue: exercise.weightCue,
      loadMultiplier: exercise.weightCue === PAIR_WEIGHT_CUE ? 2 : 1,
      baseWeightPercent: exercise.baseWeightPercent,
      weightIncrementKg: exercise.weightIncrementKg,
      substituteExerciseIds: [] as string[],
      warmUpOrder: null,
      workoutType: null,
      orderInWorkout: 0,
      sets: 3,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
      restSecs: exercise.restSecs,
      isWarmUp: false,
      injuryAreasToSkip: exercise.injuryAreasToSkip,
    };
    const saved = await prisma.exercise.upsert({
      where: { programKey: exercise.key },
      create: { programKey: exercise.key, ...data },
      update: data,
    });
    idsByKey.set(exercise.key, saved.id);
  }

  for (const [sourceKey, alternativeKeys] of Object.entries(substitutions)) {
    const id = idsByKey.get(sourceKey);
    if (!id) continue;
    await prisma.exercise.update({
      where: { id },
      data: {
        substituteExerciseIds: alternativeKeys.flatMap((key) => {
          const alternativeId = idsByKey.get(key);
          return alternativeId ? [alternativeId] : [];
        }),
      },
    });
  }

  for (const [blockText, workouts] of Object.entries(placements)) {
    const programBlock = Number(blockText);
    for (const [workoutType, exerciseKeys] of Object.entries(workouts)) {
      for (const [orderInWorkout, key] of exerciseKeys.entries()) {
        const exerciseId = idsByKey.get(key);
        if (!exerciseId) throw new Error(`Program exercise ${key} was not seeded`);
        await prisma.programExercise.upsert({
          where: {
            programBlock_workoutType_orderInWorkout: {
              programBlock,
              workoutType,
              orderInWorkout,
            },
          },
          create: { programBlock, workoutType, orderInWorkout, exerciseId },
          update: { exerciseId },
        });
      }
    }
  }

  return {
    exercises: exercises.length,
    warmUps: warmUps.length,
    placements: Object.values(placements).reduce(
      (total, workouts) =>
        total + Object.values(workouts).reduce((sum, list) => sum + list.length, 0),
      0,
    ),
  };
}

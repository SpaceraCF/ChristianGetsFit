import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/seed
 * Seeds the exercises database. Protected by CRON_SECRET.
 * Run once after first deploy or when exercises need resetting.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if exercises already exist
  const existing = await prisma.exercise.count();
  if (existing > 0) {
    return NextResponse.json({ ok: true, message: `Already seeded (${existing} exercises exist).` });
  }

  const warmUpExercises = [
    { name: "Arm circles", muscleGroup: "shoulders", equipment: "bodyweight", instructions: "Stand with arms out to sides. Make small circles, then larger. 30 seconds.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 0, workoutType: null, orderInWorkout: 0, sets: 1, repsMin: 1, repsMax: 1, restSecs: 0, isWarmUp: true, injuryAreasToSkip: [] as string[] },
    { name: "Leg swings", muscleGroup: "hips", equipment: "bodyweight", instructions: "Hold a wall, swing one leg forward and back. 30 sec each leg.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 1, workoutType: null, orderInWorkout: 1, sets: 1, repsMin: 1, repsMax: 1, restSecs: 0, isWarmUp: true, injuryAreasToSkip: ["hip", "knee"] },
    { name: "Bodyweight squats", muscleGroup: "legs", equipment: "bodyweight", instructions: "10 reps. Keep chest up, push knees out.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 2, workoutType: null, orderInWorkout: 2, sets: 1, repsMin: 10, repsMax: 10, restSecs: 0, isWarmUp: true, injuryAreasToSkip: ["knee", "back"] },
    { name: "Push-up to down dog", muscleGroup: "full", equipment: "bodyweight", instructions: "5 reps. Push up, then push hips back to down dog.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 3, workoutType: null, orderInWorkout: 3, sets: 1, repsMin: 5, repsMax: 5, restSecs: 0, isWarmUp: true, injuryAreasToSkip: ["shoulder", "wrist"] },
    { name: "Jumping jacks", muscleGroup: "cardio", equipment: "bodyweight", instructions: "30 seconds. Get the heart rate up.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 4, workoutType: null, orderInWorkout: 4, sets: 1, repsMin: 1, repsMax: 1, restSecs: 0, isWarmUp: true, injuryAreasToSkip: ["knee"] },
    { name: "Light stretch", muscleGroup: "full", equipment: "bodyweight", instructions: "1 minute. Light stretch of chest, shoulders, legs.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [] as string[], warmUpOrder: 5, workoutType: null, orderInWorkout: 5, sets: 1, repsMin: 1, repsMax: 1, restSecs: 0, isWarmUp: true, injuryAreasToSkip: [] as string[] },
  ];

  for (const ex of warmUpExercises) {
    await prisma.exercise.create({ data: ex });
  }

  // Workout A - Push
  const smithBench = await prisma.exercise.create({ data: { name: "Smith Machine Bench Press", muscleGroup: "chest", equipment: "smith_machine", instructions: "Lie on bench, grip bar slightly wider than shoulders. Lower to chest, press up.", baseWeightPercent: 0.3, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 0, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["shoulder", "wrist"] } });
  const smithIncline = await prisma.exercise.create({ data: { name: "Smith Machine Incline Bench Press", muscleGroup: "chest", equipment: "smith_machine", instructions: "Set bench to 30-45°. Same as bench press, targets upper chest.", baseWeightPercent: 0.25, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 1, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["shoulder", "wrist"] } });
  const dbShoulderPress = await prisma.exercise.create({ data: { name: "Dumbbell Shoulder Press", muscleGroup: "shoulders", equipment: "dumbbell", instructions: "Seated or standing. Press dumbbells overhead from shoulder height.", baseWeightPercent: 0.1, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 2, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["shoulder"] } });
  const arnoldPress = await prisma.exercise.create({ data: { name: "Arnold Press", muscleGroup: "shoulders", equipment: "dumbbell", instructions: "Start palms in, rotate out as you press. Lighter than regular press.", baseWeightPercent: 0.08, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 3, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["shoulder"] } });
  const tricepExt = await prisma.exercise.create({ data: { name: "Dumbbell Tricep Extension", muscleGroup: "triceps", equipment: "dumbbell", instructions: "One arm or two. Lower dumbbell behind head, extend up.", baseWeightPercent: 0.06, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 4, sets: 3, repsMin: 8, repsMax: 12, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["elbow", "wrist"] } });
  const lateralRaise = await prisma.exercise.create({ data: { name: "Lateral Raise", muscleGroup: "shoulders", equipment: "dumbbell", instructions: "Arms at sides, raise to shoulder height. Control the negative.", baseWeightPercent: 0.04, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "A", orderInWorkout: 5, sets: 3, repsMin: 10, repsMax: 12, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["shoulder"] } });

  // Workout B - Pull
  const smithRow = await prisma.exercise.create({ data: { name: "Smith Machine Bent-Over Row", muscleGroup: "back", equipment: "smith_machine", instructions: "Hinge at hips, pull bar to lower chest. Squeeze shoulder blades.", baseWeightPercent: 0.25, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 0, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["back"] } });
  const chestRow = await prisma.exercise.create({ data: { name: "Chest-Supported Dumbbell Row", muscleGroup: "back", equipment: "dumbbell", instructions: "Lie chest on incline bench, row dumbbells to hip. Back-supported.", baseWeightPercent: 0.12, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 1, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: [] } });
  const dbCurl = await prisma.exercise.create({ data: { name: "Dumbbell Bicep Curl", muscleGroup: "biceps", equipment: "dumbbell", instructions: "Arms at sides, curl up. Keep elbows still.", baseWeightPercent: 0.06, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 2, sets: 3, repsMin: 8, repsMax: 12, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["elbow", "wrist"] } });
  const smithShrug = await prisma.exercise.create({ data: { name: "Smith Machine Shrug", muscleGroup: "traps", equipment: "smith_machine", instructions: "Bar at arms length. Shrug shoulders up and back.", baseWeightPercent: 0.25, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 3, sets: 3, repsMin: 10, repsMax: 12, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["neck"] } });
  const hammerCurl = await prisma.exercise.create({ data: { name: "Hammer Curl", muscleGroup: "biceps", equipment: "dumbbell", instructions: "Neutral grip (palms in). Curl both arms. Easier on wrists.", baseWeightPercent: 0.06, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 4, sets: 3, repsMin: 8, repsMax: 12, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["elbow", "wrist"] } });
  const facePull = await prisma.exercise.create({ data: { name: "Band or Cable Face Pull", muscleGroup: "rear_delts", equipment: "dumbbell", instructions: "If no cable: bent-over reverse fly with light dumbbells. Pull to face level.", baseWeightPercent: 0.04, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "B", orderInWorkout: 5, sets: 3, repsMin: 12, repsMax: 15, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["shoulder"] } });

  // Workout C - Legs + Core
  const smithSquat = await prisma.exercise.create({ data: { name: "Smith Machine Squat", muscleGroup: "legs", equipment: "smith_machine", instructions: "Bar on upper back. Squat to parallel or below. Knees track over toes.", baseWeightPercent: 0.4, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 0, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["knee", "back"] } });
  const legPress = await prisma.exercise.create({ data: { name: "Smith Machine Leg Press (or Hack Squat)", muscleGroup: "legs", equipment: "smith_machine", instructions: "Feet on platform, lower and press. Back supported.", baseWeightPercent: 0.5, weightIncrementKg: 2.5, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 1, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["knee", "back"] } });
  const dbLunge = await prisma.exercise.create({ data: { name: "Dumbbell Walking Lunge", muscleGroup: "legs", equipment: "dumbbell", instructions: "Hold dumbbells at sides. Lunge forward, alternate legs.", baseWeightPercent: 0.07, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 2, sets: 3, repsMin: 8, repsMax: 10, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["knee", "hip"] } });
  const stepUp = await prisma.exercise.create({ data: { name: "Dumbbell Step-Up", muscleGroup: "legs", equipment: "dumbbell", instructions: "Step onto bench or box with one leg. Drive up. Alternate.", baseWeightPercent: 0.07, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 3, sets: 3, repsMin: 8, repsMax: 10, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["knee", "hip"] } });
  await prisma.exercise.create({ data: { name: "Romanian Deadlift (Dumbbell)", muscleGroup: "hamstrings", equipment: "dumbbell", instructions: "Slight knee bend, hinge at hips. Lower dumbbells along legs, feel hamstring stretch.", baseWeightPercent: 0.12, weightIncrementKg: 1, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 4, sets: 3, repsMin: 8, repsMax: 12, restSecs: 90, isWarmUp: false, injuryAreasToSkip: ["back"] } });
  await prisma.exercise.create({ data: { name: "Plank", muscleGroup: "core", equipment: "bodyweight", instructions: "Forearms on floor, hold 30-60 seconds. Keep hips level.", baseWeightPercent: 0, weightIncrementKg: 0, substituteExerciseIds: [], warmUpOrder: null, workoutType: "C", orderInWorkout: 5, sets: 2, repsMin: 1, repsMax: 1, restSecs: 60, isWarmUp: false, injuryAreasToSkip: ["back"] } });

  // Substitutions
  await prisma.exercise.update({ where: { id: dbShoulderPress.id }, data: { substituteExerciseIds: [arnoldPress.id] } });
  await prisma.exercise.update({ where: { id: arnoldPress.id }, data: { substituteExerciseIds: [dbShoulderPress.id] } });
  await prisma.exercise.update({ where: { id: smithRow.id }, data: { substituteExerciseIds: [chestRow.id] } });
  await prisma.exercise.update({ where: { id: chestRow.id }, data: { substituteExerciseIds: [smithRow.id] } });
  await prisma.exercise.update({ where: { id: dbLunge.id }, data: { substituteExerciseIds: [stepUp.id] } });
  await prisma.exercise.update({ where: { id: stepUp.id }, data: { substituteExerciseIds: [dbLunge.id] } });

  const count = await prisma.exercise.count();
  return NextResponse.json({ ok: true, message: `Seeded ${count} exercises (6 warm-up + 18 workout).` });
}

/** Destructive local reset. Production uses seed-safe.ts instead. */
import { PrismaClient } from "@prisma/client";

import { seedWorkoutProgram } from "../src/lib/program-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.exerciseLog.deleteMany();
  await prisma.exercisePreference.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.programExercise.deleteMany();
  await prisma.exercise.deleteMany();
  const result = await seedWorkoutProgram(prisma);
  console.log("[seed] Local workout data reset", result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

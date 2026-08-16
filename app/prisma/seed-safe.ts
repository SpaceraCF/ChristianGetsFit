/** Safe, repeatable production seed. Existing workout history is never deleted. */
import { PrismaClient } from "@prisma/client";

import { seedWorkoutProgram } from "../src/lib/program-catalog";

const prisma = new PrismaClient();

seedWorkoutProgram(prisma)
  .then((result) => console.log("[seed-safe] Program ready", result))
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("[seed-safe] Error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

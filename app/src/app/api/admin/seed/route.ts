import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { seedWorkoutProgram } from "@/lib/program-catalog";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/** Safely refreshes the program catalogue without touching workout history. */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedWorkoutProgram(prisma);
  return NextResponse.json({ ok: true, ...result });
}

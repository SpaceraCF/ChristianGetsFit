import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { seedWorkoutProgram } from "@/lib/program-catalog";

/** Safely refreshes the program catalogue without touching workout history. */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedWorkoutProgram(prisma);
  return NextResponse.json({ ok: true, ...result });
}

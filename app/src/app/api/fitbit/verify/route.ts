import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyWorkoutWithFitbit } from "@/lib/fitbit";
import { startOfWeek } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const workoutId = body.workoutId as string;
    if (!workoutId) {
      return NextResponse.json({ error: "workoutId required" }, { status: 400 });
    }
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: user.id },
    });
    if (!workout?.completedAt || !user.fitbitAccessToken) {
      return NextResponse.json({ verified: false });
    }
    const verified = await verifyWorkoutWithFitbit(user.fitbitAccessToken, workout.completedAt);
    if (verified && !workout.fitbitVerified) {
      await prisma.workout.update({
        where: { id: workoutId },
        data: { fitbitVerified: true },
      });

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const existing = await prisma.weeklyStat.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
      });
      if (existing) {
        await prisma.weeklyStat.update({
          where: { id: existing.id },
          data: { xpEarned: existing.xpEarned + 25 },
        });
      } else {
        await prisma.weeklyStat.create({
          data: { userId: user.id, weekStart, workoutsCompleted: 0, punishmentActive: true, xpEarned: 25 },
        });
      }
    }
    return NextResponse.json({ verified });
  } catch {
    return NextResponse.json({ verified: false }, { status: 500 });
  }
}

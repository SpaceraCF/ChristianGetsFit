import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyWorkoutWithFitbit } from "@/lib/fitbit";

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
    if (verified) {
      await prisma.workout.update({
        where: { id: workoutId },
        data: { fitbitVerified: true },
      });
    }
    return NextResponse.json({ verified });
  } catch {
    return NextResponse.json({ verified: false }, { status: 500 });
  }
}

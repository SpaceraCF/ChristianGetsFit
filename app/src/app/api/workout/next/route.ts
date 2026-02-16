import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getExercisesForWorkout, getWarmUpExercises } from "@/lib/workout";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const type = (req.nextUrl.searchParams.get("type") ?? "A") as "A" | "B" | "C";
    const express = req.nextUrl.searchParams.get("express") === "true";

    const [exercises, warmUp] = await Promise.all([
      getExercisesForWorkout(user.id, type, express),
      getWarmUpExercises(),
    ]);

    return NextResponse.json({
      workoutType: type,
      isExpress: express,
      warmUp: warmUp.map((e) => ({
        id: e.id,
        name: e.name,
        instructions: e.instructions,
        orderInWorkout: e.warmUpOrder,
        videoUrl: e.videoUrl,
      })),
      exercises,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

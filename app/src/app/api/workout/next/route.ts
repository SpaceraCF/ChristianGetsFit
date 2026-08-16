import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  getExercisesForWorkout,
  getUserProgramState,
  getWarmUpExercises,
} from "@/lib/workout";

const querySchema = z.object({
  type: z.enum(["A", "B", "C"]),
  express: z.enum(["true", "false"]),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const query = querySchema.parse({
      type: req.nextUrl.searchParams.get("type") ?? "A",
      express: req.nextUrl.searchParams.get("express") ?? "false",
    });
    const express = query.express === "true";
    const program = await getUserProgramState(user.id);

    const [exercises, warmUp] = await Promise.all([
      getExercisesForWorkout(user.id, query.type, express, program),
      getWarmUpExercises(),
    ]);

    return NextResponse.json({
      workoutType: query.type,
      isExpress: express,
      program,
      warmUp: warmUp.map((e) => ({
        id: e.id,
        name: e.name,
        instructions: e.instructions,
        orderInWorkout: e.warmUpOrder,
        videoUrl: e.videoUrl,
      })),
      exercises,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid workout request" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Workout could not be loaded" }, { status: 401 });
  }
}

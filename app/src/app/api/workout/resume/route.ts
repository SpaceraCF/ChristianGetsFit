import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const RESUME_WINDOW_HOURS = 6;

/**
 * GET /api/workout/resume
 *
 * Returns the user's most recent in-progress workout if there is one within
 * the resume window (6h since started, at least one exercise saved, not
 * completed). Used by the dashboard to show a "Resume Workout C — 2/3 done"
 * banner after a crash.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const resumeCutoff = new Date(now.getTime() - RESUME_WINDOW_HOURS * 60 * 60 * 1000);

    const inProgress = await prisma.workout.findFirst({
      where: {
        userId: user.id,
        completedAt: null,
        scheduledAt: { gte: resumeCutoff, lte: now },
        exerciseLogs: { some: {} },
      },
      include: { exerciseLogs: { select: { exerciseId: true } } },
      orderBy: { scheduledAt: "desc" },
    });

    if (!inProgress) {
      return NextResponse.json({ inProgress: null });
    }

    return NextResponse.json({
      inProgress: {
        workoutId: inProgress.id,
        workoutType: inProgress.workoutType,
        isExpress: inProgress.isExpress,
        startedAt: inProgress.scheduledAt,
        alreadyLogged: inProgress.exerciseLogs.map((l) => l.exerciseId),
        loggedCount: inProgress.exerciseLogs.length,
      },
    });
  } catch (e) {
    console.error("[workout/resume]", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

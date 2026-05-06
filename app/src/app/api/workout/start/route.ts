import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  workoutType: z.enum(["A", "B", "C"]),
  isExpress: z.boolean(),
});

const RESUME_WINDOW_HOURS = 6;

/**
 * POST /api/workout/start
 *
 * Starts (or resumes) a workout. Behavior:
 *
 *   1. If there's an in-progress workout for this user (completed_at null,
 *      scheduled_at within the last RESUME_WINDOW_HOURS, with at least one
 *      exercise log already saved) — return that one and the list of
 *      already-logged exercise IDs. The client uses this to skip past
 *      exercises that were saved before the crash.
 *
 *   2. Else if there's a pre-scheduled workout for today matching the
 *      requested type (e.g. one written by the calendar mirror), claim
 *      it by setting scheduled_at to now and returning that ID. This
 *      consumes the cal.com / M365-mirror placeholder rows.
 *
 *   3. Else create a brand-new Workout row with scheduled_at = now and
 *      completed_at = null.
 *
 * Returns: { workoutId, alreadyLogged: string[], resumed: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    const now = new Date();
    const resumeCutoff = new Date(now.getTime() - RESUME_WINDOW_HOURS * 60 * 60 * 1000);

    // 1. Resume an in-progress workout (any type — user picked it earlier).
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
    if (inProgress) {
      return NextResponse.json({
        workoutId: inProgress.id,
        workoutType: inProgress.workoutType,
        isExpress: inProgress.isExpress,
        alreadyLogged: inProgress.exerciseLogs.map((l) => l.exerciseId),
        resumed: true,
      });
    }

    // 2. Claim a pre-scheduled (mirror) row for today, matching type.
    const todayStart = startOfTodaySydney(now);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const scheduled = await prisma.workout.findFirst({
      where: {
        userId: user.id,
        workoutType: body.workoutType,
        completedAt: null,
        scheduledAt: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { scheduledAt: "asc" },
    });
    if (scheduled) {
      const claimed = await prisma.workout.update({
        where: { id: scheduled.id },
        data: { scheduledAt: now, isExpress: body.isExpress },
      });
      return NextResponse.json({
        workoutId: claimed.id,
        workoutType: claimed.workoutType,
        isExpress: claimed.isExpress,
        alreadyLogged: [] as string[],
        resumed: false,
      });
    }

    // 3. Create a fresh Workout row.
    const created = await prisma.workout.create({
      data: {
        userId: user.id,
        workoutType: body.workoutType,
        isExpress: body.isExpress,
        scheduledAt: now,
      },
    });
    return NextResponse.json({
      workoutId: created.id,
      workoutType: created.workoutType,
      isExpress: created.isExpress,
      alreadyLogged: [] as string[],
      resumed: false,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error("[workout/start]", e);
    return NextResponse.json({ error: "Failed to start workout" }, { status: 500 });
  }
}

/**
 * Compute today's start in Australia/Sydney time as a UTC Date.
 * Render runs UTC, so naive `new Date(now.toDateString())` would slip a day.
 */
function startOfTodaySydney(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // AEST is UTC+10, AEDT is UTC+11. Use Sydney's wall-clock midnight by
  // formatting the Sydney midnight string and parsing back through Date.
  // Letting JS infer the offset via locale would be flaky; safer to
  // bracket within ±24h and let the caller's range filter handle it.
  return new Date(ymd + "T00:00:00+10:00");
}

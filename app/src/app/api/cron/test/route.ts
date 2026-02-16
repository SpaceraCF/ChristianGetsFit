import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { sendTelegram } from "@/lib/telegram";
import { getMorningInspiration } from "@/lib/inspiration";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL, DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/config";
import { prisma } from "@/lib/db";

/**
 * POST /api/cron/test
 * Send a test inspirational message to the logged-in user's Telegram.
 * Requires session auth (not cron secret).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { telegramChatId: true },
    });

    if (!fullUser?.telegramChatId) {
      return NextResponse.json({ error: "Telegram not linked. Link it first in settings." }, { status: 400 });
    }

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: DEFAULT_SCHEDULE_TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const aedtTime = `${hour}:${String(minute).padStart(2, "0")}`;

    const stats = await getDashboardStats(user.id);
    const inspiration = getMorningInspiration();

    await sendTelegram(
      fullUser.telegramChatId,
      `[Test] ${inspiration}\n\nToday: Workout ${stats.nextWorkoutType}. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK} (min ${MIN_WORKOUTS_FOR_GOAL}).`
    );

    return NextResponse.json({ ok: true, aedtTime, message: "Test message sent to Telegram!" });
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

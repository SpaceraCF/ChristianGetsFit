import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/dashboard";
import { sendTelegram } from "@/lib/telegram";
import { startOfWeek, subWeeks } from "date-fns";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day = now.getDay();
  if (day !== 0) {
    return NextResponse.json({ ok: true, message: "Only run on Sunday" });
  }

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true },
  });

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);

  for (const user of users) {
    const chatId = user.telegramChatId!;
    try {
      const stats = await getDashboardStats(user.id);
      const workoutsLastWeek = await prisma.workout.count({
        where: {
          userId: user.id,
          completedAt: {
            gte: lastWeekStart,
            lt: weekStart,
          },
        },
      });
      const punishment = workoutsLastWeek < MIN_WORKOUTS_FOR_GOAL;
      const msg = [
        "Week recap:",
        `Workouts: ${workoutsLastWeek}/${PLANNED_WORKOUTS_PER_WEEK} planned`,
        punishment ? `⚠️ Alcohol ban active this weekend (fewer than ${MIN_WORKOUTS_FOR_GOAL} workouts).` : "✓ No punishment.",
        `Weight: ${stats.currentWeight}kg → goal ${stats.targetWeight}kg`,
        `Level ${stats.level} · ${stats.xp} XP`,
      ].join("\n");
      await sendTelegram(chatId, msg);
    } catch (e) {
      console.error("[cron weekly]", user.id, e);
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/dashboard";
import { getSlotsTodayBetween11and4 } from "@/lib/calcom";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";
import { sendTelegram } from "@/lib/telegram";
import { startOfWeek, format } from "date-fns";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true, calcomApiKey: true },
  });

  for (const user of users) {
    const chatId = user.telegramChatId!;
    try {
      const stats = await getDashboardStats(user.id);
      const workedOutToday = await prisma.workout.findFirst({
        where: {
          userId: user.id,
          completedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      });

      let slots: string[] = [];
      const apiKey = user.calcomApiKey ?? process.env.CALCOM_API_KEY;
      if (apiKey) {
        slots = await getSlotsTodayBetween11and4(apiKey);
      }

      const hour = now.getHours();
      if (hour >= 7 && hour < 9) {
        await sendTelegram(
          chatId,
          `Good morning! Today: Workout ${stats.nextWorkoutType}. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK} planned (min ${MIN_WORKOUTS_FOR_GOAL}). Your workout window (11am–4pm AEDT) ${slots.length > 0 ? `has free slots.` : "— check your calendar."}`
        );
      } else if (hour >= 11 && hour < 12 && !workedOutToday) {
        await sendTelegram(chatId, "Your workout window is open (11am–4pm). Time for Workout " + stats.nextWorkoutType + "?");
      } else if (hour >= 15 && hour < 16 && !workedOutToday) {
        await sendTelegram(chatId, "Last call — get your workout in before 4pm AEDT! " + stats.workoutsThisWeek + "/" + PLANNED_WORKOUTS_PER_WEEK + " this week (need " + MIN_WORKOUTS_FOR_GOAL + " for goal).");
      }
    } catch (e) {
      console.error("[cron daily]", user.id, e);
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/dashboard";
import { getSlotsTodayBetween11and4, getTodaysWorkoutBookings } from "@/lib/calcom";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";
import { sendTelegram } from "@/lib/telegram";
import { getMorningInspiration, getPumpUpMessage } from "@/lib/inspiration";
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

      // Fetch today's actual booked workout time from Cal.com
      let todaysBookings: Date[] = [];
      if (apiKey) {
        todaysBookings = await getTodaysWorkoutBookings(apiKey);
      }
      const nextBooking = todaysBookings.find((b) => b.getTime() > now.getTime());

      const hour = now.getHours();
      const mins = now.getMinutes();
      const nowMs = now.getTime();

      // 7:00am — Morning inspiration + daily status
      if (hour === 7 && mins < 30) {
        const inspiration = getMorningInspiration();
        const bookingInfo = todaysBookings.length > 0
          ? `Workout booked at ${todaysBookings.map((b) => format(b, "h:mma")).join(", ")}.`
          : slots.length > 0 ? "Slots available — book one." : "No workout booked — check calendar.";
        await sendTelegram(
          chatId,
          `${inspiration}\n\nToday: Workout ${stats.nextWorkoutType}. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK} (min ${MIN_WORKOUTS_FOR_GOAL}). ${bookingInfo}`
        );
      }

      // 5 mins before booked workout — Pump-up message
      if (nextBooking && !workedOutToday) {
        const minsUntilBooking = (nextBooking.getTime() - nowMs) / (60 * 1000);
        if (minsUntilBooking > 0 && minsUntilBooking <= 10) {
          const pumpUp = getPumpUpMessage();
          const bookingTime = format(nextBooking, "h:mma");
          await sendTelegram(chatId, `${pumpUp}\n\nYour Workout ${stats.nextWorkoutType} is booked at ${bookingTime}. Get ready!`);
        }
      }

      // 11am — Workout window open (only if no pump-up was sent and no booking coming soon)
      if (hour >= 11 && hour < 12 && !workedOutToday) {
        const minsToNext = nextBooking ? (nextBooking.getTime() - nowMs) / (60 * 1000) : Infinity;
        if (minsToNext > 10) {
          await sendTelegram(chatId, "Your workout window is open (11am–4pm). Time for Workout " + stats.nextWorkoutType + "?");
        }
      }

      // 3pm — Last call
      if (hour >= 15 && hour < 16 && !workedOutToday) {
        await sendTelegram(chatId, "Last call — get your workout in before 4pm AEDT! " + stats.workoutsThisWeek + "/" + PLANNED_WORKOUTS_PER_WEEK + " this week (need " + MIN_WORKOUTS_FOR_GOAL + " for goal).");
      }

      // 6pm — Daily summary
      if (hour >= 18 && hour < 19) {
        const dayName = format(now, "EEEE");
        if (workedOutToday) {
          await sendTelegram(chatId, `${dayName} done! You worked out today. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK}. ${stats.workoutsThisWeek >= MIN_WORKOUTS_FOR_GOAL ? "Goal hit — enjoy the weekend!" : `${MIN_WORKOUTS_FOR_GOAL - stats.workoutsThisWeek} more to clear the alcohol ban.`}`);
        } else {
          await sendTelegram(chatId, `${dayName} wrap-up: No workout today. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK}. ${stats.workoutsThisWeek >= MIN_WORKOUTS_FOR_GOAL ? "Goal already hit — rest easy." : `Still need ${MIN_WORKOUTS_FOR_GOAL - stats.workoutsThisWeek} more this week.`}`);
        }
      }
    } catch (e) {
      console.error("[cron daily]", user.id, e);
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/dashboard";
import { getSlotsTodayBetween11and4, getTodaysWorkoutBookings } from "@/lib/calcom";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL, DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/config";
import { sendTelegram } from "@/lib/telegram";
import { getMorningInspiration, getPumpUpMessage } from "@/lib/inspiration";
import { format } from "date-fns";

export const maxDuration = 60;

/** Get current hour and minute in AEDT/AEST (handles DST automatically). */
function getAEDTTime(date: Date): { hour: number; minute: number; dayName: string } {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: DEFAULT_SCHEDULE_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const dayName = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
  return { hour, minute, dayName };
}

/** Get start of "today" in AEDT as a UTC Date. */
function getAEDTTodayStart(): Date {
  const nowStr = new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_SCHEDULE_TIMEZONE });
  return new Date(nowStr + "T00:00:00+11:00");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { hour, minute, dayName } = getAEDTTime(now);
  const todayStart = getAEDTTodayStart();
  const nowMs = now.getTime();

  console.log(`[cron daily] AEDT time: ${dayName} ${hour}:${String(minute).padStart(2, "0")}`);

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true, calcomApiKey: true },
  });

  let sent = 0;

  for (const user of users) {
    const chatId = user.telegramChatId!;
    try {
      const stats = await getDashboardStats(user.id);
      const workedOutToday = await prisma.workout.findFirst({
        where: {
          userId: user.id,
          completedAt: { gte: todayStart },
        },
      });

      let slots: string[] = [];
      const apiKey = user.calcomApiKey ?? process.env.CALCOM_API_KEY;
      if (apiKey) {
        slots = await getSlotsTodayBetween11and4(apiKey);
      }

      let todaysBookings: Date[] = [];
      if (apiKey) {
        todaysBookings = await getTodaysWorkoutBookings(apiKey);
      }
      const nextBooking = todaysBookings.find((b) => b.getTime() > nowMs);

      // 7:00am AEDT — Morning inspiration + daily status
      if (hour === 7 && minute < 30) {
        const inspiration = getMorningInspiration();
        const bookingInfo = todaysBookings.length > 0
          ? `Workout booked at ${todaysBookings.map((b) => {
              const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: DEFAULT_SCHEDULE_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
              return fmt.format(b);
            }).join(", ")}.`
          : slots.length > 0 ? "Slots available — book one." : "No workout booked — check calendar.";
        await sendTelegram(
          chatId,
          `${inspiration}\n\nToday: Workout ${stats.nextWorkoutType}. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK} (min ${MIN_WORKOUTS_FOR_GOAL}). ${bookingInfo}`
        );
        sent++;
      }

      // 5-10 mins before booked workout — Pump-up message
      if (nextBooking && !workedOutToday) {
        const minsUntilBooking = (nextBooking.getTime() - nowMs) / (60 * 1000);
        if (minsUntilBooking > 0 && minsUntilBooking <= 10) {
          const pumpUp = getPumpUpMessage();
          const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: DEFAULT_SCHEDULE_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
          const bookingTime = fmt.format(nextBooking);
          await sendTelegram(chatId, `${pumpUp}\n\nYour Workout ${stats.nextWorkoutType} is booked at ${bookingTime}. Get ready!`);
          sent++;
        }
      }

      // 11am AEDT — Workout window open
      if (hour === 11 && minute < 30 && !workedOutToday) {
        const minsToNext = nextBooking ? (nextBooking.getTime() - nowMs) / (60 * 1000) : Infinity;
        if (minsToNext > 10) {
          await sendTelegram(chatId, "Your workout window is open (11am–4pm). Time for Workout " + stats.nextWorkoutType + "?");
          sent++;
        }
      }

      // 3pm AEDT — Last call
      if (hour === 15 && minute < 30 && !workedOutToday) {
        await sendTelegram(chatId, "Last call — get your workout in before 4pm AEDT! " + stats.workoutsThisWeek + "/" + PLANNED_WORKOUTS_PER_WEEK + " this week (need " + MIN_WORKOUTS_FOR_GOAL + " for goal).");
        sent++;
      }

      // 6pm AEDT — Daily summary
      if (hour === 18 && minute < 30) {
        if (workedOutToday) {
          await sendTelegram(chatId, `${dayName} done! You worked out today. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK}. ${stats.workoutsThisWeek >= MIN_WORKOUTS_FOR_GOAL ? "Goal hit — enjoy the weekend!" : `${MIN_WORKOUTS_FOR_GOAL - stats.workoutsThisWeek} more to clear the alcohol ban.`}`);
        } else {
          await sendTelegram(chatId, `${dayName} wrap-up: No workout today. This week: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK}. ${stats.workoutsThisWeek >= MIN_WORKOUTS_FOR_GOAL ? "Goal already hit — rest easy." : `Still need ${MIN_WORKOUTS_FOR_GOAL - stats.workoutsThisWeek} more this week.`}`);
        }
        sent++;
      }
    } catch (e) {
      console.error("[cron daily]", user.id, e);
    }
  }

  return NextResponse.json({ ok: true, aedtTime: `${hour}:${String(minute).padStart(2, "0")}`, users: users.length, sent });
}

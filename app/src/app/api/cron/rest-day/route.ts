import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFitbitSleep } from "@/lib/fitbit";
import { sendTelegram } from "@/lib/telegram";
import { format, subDays } from "date-fns";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const users = await prisma.user.findMany({
    where: {
      fitbitAccessToken: { not: null },
      telegramChatId: { not: null },
    },
    select: { id: true, fitbitAccessToken: true, telegramChatId: true },
  });

  for (const user of users) {
    const token = user.fitbitAccessToken!;
    const chatId = user.telegramChatId!;
    try {
      const sleep = await getFitbitSleep(token, yesterday);
      if (!sleep) continue;
      const rec = sleep.recommendation;
      await prisma.fitbitDaily.upsert({
        where: {
          userId_date: { userId: user.id, date: new Date(yesterday) },
        },
        create: {
          userId: user.id,
          date: new Date(yesterday),
          sleepDurationMins: sleep.durationMins,
          recoveryRecommendation: rec,
        },
        update: {
          sleepDurationMins: sleep.durationMins,
          recoveryRecommendation: rec,
        },
      });
      if (rec === "rest") {
        await sendTelegram(
          chatId,
          "Rest day suggested: your sleep was short or low quality. Consider light stretching or a walk instead of a full workout."
        );
      } else if (rec === "push") {
        await sendTelegram(chatId, "You slept well — good day to push a bit harder in your workout!");
      }
    } catch (e) {
      console.error("[cron rest-day]", user.id, e);
    }
  }

  return NextResponse.json({ ok: true });
}

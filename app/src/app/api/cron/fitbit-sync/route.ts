import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFitbitDailySummary, getFitbitSleep, refreshFitbitToken } from "@/lib/fitbit";
import { format, subDays } from "date-fns";

export const maxDuration = 60;

/**
 * GET /api/cron/fitbit-sync
 * Runs daily — syncs yesterday's Fitbit data (sleep, steps, HR, active minutes)
 * for all users with linked Fitbit accounts.
 * Also refreshes tokens automatically if they're expired.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const users = await prisma.user.findMany({
    where: { fitbitAccessToken: { not: null } },
    select: {
      id: true,
      fitbitAccessToken: true,
      fitbitRefreshToken: true,
      fitbitTokenExpiresAt: true,
    },
  });

  let synced = 0;
  let errors = 0;

  for (const user of users) {
    try {
      let accessToken = user.fitbitAccessToken!;

      if (user.fitbitRefreshToken && user.fitbitTokenExpiresAt && user.fitbitTokenExpiresAt < new Date()) {
        const refreshed = await refreshFitbitToken(user.fitbitRefreshToken);
        if (!refreshed) {
          console.warn("[fitbit-sync cron] token refresh failed for", user.id);
          errors++;
          continue;
        }
        accessToken = refreshed.accessToken;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            fitbitAccessToken: refreshed.accessToken,
            fitbitRefreshToken: refreshed.refreshToken,
            fitbitTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          },
        });
      }

      const [activity, sleep] = await Promise.all([
        getFitbitDailySummary(accessToken, yesterday),
        getFitbitSleep(accessToken, yesterday),
      ]);

      if (!activity && !sleep) continue;

      await prisma.fitbitDaily.upsert({
        where: { userId_date: { userId: user.id, date: new Date(yesterday) } },
        create: {
          userId: user.id,
          date: new Date(yesterday),
          steps: activity?.steps ?? null,
          activeMinutes: activity?.activeMinutes ?? null,
          restingHr: activity?.restingHr ?? null,
          sleepDurationMins: sleep?.durationMins ?? null,
          sleepScore: sleep?.efficiency ?? null,
          recoveryRecommendation: sleep?.recommendation ?? null,
        },
        update: {
          steps: activity?.steps ?? undefined,
          activeMinutes: activity?.activeMinutes ?? undefined,
          restingHr: activity?.restingHr ?? undefined,
          sleepDurationMins: sleep?.durationMins ?? undefined,
          sleepScore: sleep?.efficiency ?? undefined,
          recoveryRecommendation: sleep?.recommendation ?? undefined,
        },
      });
      synced++;
    } catch (e) {
      console.error("[fitbit-sync cron]", user.id, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, synced, errors });
}

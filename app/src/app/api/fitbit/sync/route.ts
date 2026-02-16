import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFitbitDailySummary, getFitbitSleep, refreshFitbitToken } from "@/lib/fitbit";
import { format, subDays } from "date-fns";

/**
 * POST /api/fitbit/sync
 * Syncs the last 7 days of Fitbit data (sleep, steps, HR, active minutes).
 * Automatically refreshes the token if expired.
 */
export async function POST() {
  try {
    const user = await requireUser();

    if (!user.fitbitAccessToken || !user.fitbitRefreshToken) {
      return NextResponse.json({ error: "Fitbit not linked" }, { status: 400 });
    }

    let accessToken = user.fitbitAccessToken;

    // Refresh token if expired
    if (user.fitbitTokenExpiresAt && user.fitbitTokenExpiresAt < new Date()) {
      const refreshed = await refreshFitbitToken(user.fitbitRefreshToken);
      if (!refreshed) {
        return NextResponse.json(
          { error: "Fitbit token expired. Please relink in Settings." },
          { status: 401 }
        );
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

    const synced: string[] = [];
    const errors: string[] = [];

    for (let i = 1; i <= 7; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      try {
        const [activity, sleep] = await Promise.all([
          getFitbitDailySummary(accessToken, date),
          getFitbitSleep(accessToken, date),
        ]);

        if (!activity && !sleep) continue;

        await prisma.fitbitDaily.upsert({
          where: { userId_date: { userId: user.id, date: new Date(date) } },
          create: {
            userId: user.id,
            date: new Date(date),
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
        synced.push(date);
      } catch (e) {
        errors.push(`${date}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      synced: synced.length,
      errors: errors.length ? errors : undefined,
      message: `Synced ${synced.length} day(s) of Fitbit data.`,
    });
  } catch (e) {
    console.error("[fitbit sync]", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

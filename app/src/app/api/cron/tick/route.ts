import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * GET /api/cron/tick
 * 
 * Unified cron endpoint — call every 15 minutes from an external cron service.
 * Internally calls /api/cron/daily and /api/cron/rest-day.
 * This keeps the free Render tier working with a single external cron job.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const headers: Record<string, string> = {};
  if (cronSecret) headers["authorization"] = `Bearer ${cronSecret}`;

  const results: Record<string, unknown> = {};

  // Call daily notifications
  try {
    const dailyRes = await fetch(`${appUrl}/api/cron/daily`, { headers });
    results.daily = await dailyRes.json();
  } catch (e) {
    results.daily = { error: String(e) };
  }

  // Call rest-day check
  try {
    const restRes = await fetch(`${appUrl}/api/cron/rest-day`, { headers });
    results.restDay = await restRes.json();
  } catch (e) {
    results.restDay = { error: String(e) };
  }

  return NextResponse.json({ ok: true, results });
}

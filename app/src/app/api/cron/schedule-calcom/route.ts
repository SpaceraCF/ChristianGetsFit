import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createWorkoutSlotsForWeek } from "@/lib/calcom";

export const maxDuration = 60;

/**
 * Run at midnight Sunday night (start of Monday) every week, e.g. Monday 00:00 AEDT (Sunday 13:00 UTC).
 * Creates 5 workout slots in Cal.com for each user.
 * Call with: Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = process.env.CALCOM_USERNAME;
  const eventTypeSlug = process.env.CALCOM_EVENT_TYPE_SLUG ?? "workout";

  if (!username) {
    return NextResponse.json({ ok: true, message: "CALCOM_USERNAME not set" });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [{ calcomApiKey: { not: null } }, {}],
    },
    select: { id: true, email: true, calcomApiKey: true },
  });

  const results: { userId: string; created: number; errors?: string[] }[] = [];

  for (const user of users) {
    const apiKey = user.calcomApiKey ?? process.env.CALCOM_API_KEY;
    if (!apiKey) continue;
    try {
      const result = await createWorkoutSlotsForWeek(apiKey, {
        username,
        eventTypeSlug,
        attendeeEmail: user.email,
      });
      results.push({
        userId: user.id,
        created: result.created,
        errors: result.errors.length ? result.errors : undefined,
      });
    } catch (e) {
      results.push({
        userId: user.id,
        created: 0,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

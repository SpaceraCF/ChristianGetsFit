import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createWorkoutSlotsForWeek } from "@/lib/calcom";

/**
 * Create 5 workout slots in Cal.com for the current week (Mon–Fri 12:00 AEDT).
 * Requires CALCOM_API_KEY (or user's calcomApiKey), CALCOM_USERNAME, CALCOM_EVENT_TYPE_SLUG.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const apiKey = user.calcomApiKey ?? process.env.CALCOM_API_KEY;
    const username = process.env.CALCOM_USERNAME;
    const eventTypeSlug = process.env.CALCOM_EVENT_TYPE_SLUG ?? "workout";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Cal.com not configured. Set CALCOM_API_KEY or add your API key in Settings." },
        { status: 400 }
      );
    }
    if (!username) {
      return NextResponse.json(
        { error: "CALCOM_USERNAME not set. Set it in environment." },
        { status: 400 }
      );
    }

    const result = await createWorkoutSlotsForWeek(apiKey, {
      username,
      eventTypeSlug,
      attendeeEmail: user.email,
      attendeeName: user.email.split("@")[0],
    });

    return NextResponse.json({
      created: result.created,
      total: 5,
      errors: result.errors.length ? result.errors : undefined,
      message: result.created > 0
        ? `Created ${result.created} workout slots in your calendar (12:00 AEDT).`
        : `Failed to create slots. ${result.errors[0] ?? "Check Cal.com config."}`,
    });
  } catch (e) {
    console.error("[Cal.com schedule-week]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to schedule" },
      { status: 500 }
    );
  }
}

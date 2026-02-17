import { PLANNED_WORKOUTS_PER_WEEK } from "@/lib/config";
import { startOfWeek } from "date-fns";

/**
 * Cal.com API: get bookable slots for a date between 11:00 and 16:00 (user's workout window).
 */
export async function getSlotsTodayBetween11and4(
  apiKey: string,
  timeZone: string = "Australia/Sydney" // AEDT
): Promise<string[]> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const startTime = `${dateStr}T11:00:00`;
  const endTime = `${dateStr}T16:00:00`;

  const url = new URL("https://api.cal.com/v1/slots/available");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("startTime", startTime);
  url.searchParams.set("endTime", endTime);
  url.searchParams.set("timeZone", timeZone);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("[Cal.com] slots fetch failed", res.status);
    return [];
  }
  const data = await res.json();
  const slots: string[] = [];
  if (data.slots && typeof data.slots === "object") {
    for (const dateKey of Object.keys(data.slots)) {
      const daySlots = data.slots[dateKey];
      if (Array.isArray(daySlots)) {
        for (const s of daySlots) {
          const t = s?.time ?? s;
          if (typeof t === "string") slots.push(t);
        }
      }
    }
  }
  return slots;
}

/**
 * Fetch today's confirmed Cal.com bookings for the workout event type.
 * Uses AEDT date boundaries so "today" matches the user's local day.
 * Returns the start times as Date objects, sorted ascending.
 */
export async function getTodaysWorkoutBookings(
  apiKey: string,
): Promise<Date[]> {
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const afterStart = `${dateStr}T00:00:00.000Z`;
  const beforeEnd = `${dateStr}T23:59:59.999Z`;

  const eventTypeSlug = process.env.CALCOM_EVENT_TYPE_SLUG ?? "workout";

  try {
    const url = new URL("https://api.cal.com/v2/bookings");
    url.searchParams.set("afterStart", afterStart);
    url.searchParams.set("beforeEnd", beforeEnd);
    url.searchParams.set("status", "accepted");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
      },
    });
    if (!res.ok) {
      console.warn("[Cal.com] bookings fetch failed", res.status);
      return [];
    }
    const data = await res.json();
    const bookings: Array<{ start: string; eventType?: { slug?: string }; title?: string }> =
      data.data ?? data.bookings ?? [];

    return bookings
      .filter((b) => {
        const slug = b.eventType?.slug ?? "";
        const title = (b.title ?? "").toLowerCase();
        return slug === eventTypeSlug || title.includes("workout");
      })
      .map((b) => new Date(b.start))
      .sort((a, b) => a.getTime() - b.getTime());
  } catch (e) {
    console.error("[Cal.com] getTodaysWorkoutBookings error", e);
    return [];
  }
}

/** AEDT = UTC+11. Noon (12:00) AEDT = 01:00 UTC. */
const NOON_AEDT_UTC_HOUR = 1;

/**
 * Get 5 workout slot start times for the week (Mon–Fri), 12:00 AEDT each day.
 * weekStart = Monday 00:00 UTC; we want Mon 01:00, Tue 01:00, ... Fri 01:00 UTC.
 * Skips days that are already in the past.
 */
function getWorkoutSlotTimesForWeek(weekStart: Date): string[] {
  const slots: string[] = [];
  const msPerHour = 60 * 60 * 1000;
  const now = new Date();
  for (let i = 0; i < PLANNED_WORKOUTS_PER_WEEK; i++) {
    const utc = new Date(
      weekStart.getTime() + (i * 24 + NOON_AEDT_UTC_HOUR) * msPerHour
    );
    if (utc.getTime() > now.getTime()) {
      slots.push(utc.toISOString().slice(0, 19) + "Z");
    }
  }
  return slots;
}

/**
 * Create workout bookings in Cal.com for the current week (Mon-Fri, 12:00 AEDT).
 * Uses Cal.com v2 API (2024-08-13).
 * v2 requires `attendee` object (not array), `start`, and `lengthInMinutes`.
 */
const WORKOUT_DURATION_MINS = 30;

export async function createWorkoutSlotsForWeek(
  apiKey: string,
  options: {
    username?: string;
    eventTypeSlug?: string;
    eventTypeId?: number;
    attendeeEmail: string;
    attendeeName?: string;
  }
): Promise<{ created: number; errors: string[] }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const slotTimes = getWorkoutSlotTimesForWeek(weekStart);
  const errors: string[] = [];
  let created = 0;

  if (slotTimes.length === 0) {
    errors.push("All workout slots for this week are in the past.");
    return { created, errors };
  }

  for (const startTime of slotTimes) {
    try {
      const body: Record<string, unknown> = {
        start: startTime,
        attendee: {
          name: options.attendeeName ?? options.attendeeEmail.split("@")[0],
          email: options.attendeeEmail,
          timeZone: "Australia/Sydney",
        },
        metadata: { source: "christiangetsfit" },
      };

      if (options.eventTypeId) {
        body.eventTypeId = options.eventTypeId;
      } else if (options.username && options.eventTypeSlug) {
        body.eventTypeSlug = options.eventTypeSlug;
        body.username = options.username;
      } else {
        errors.push("Missing eventTypeId or username+eventTypeSlug");
        continue;
      }

      console.log("[Cal.com] Creating booking:", JSON.stringify(body));

      const res = await fetch("https://api.cal.com/v2/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": "2024-08-13",
        },
        body: JSON.stringify(body),
      });

      const responseText = await res.text();
      console.log("[Cal.com] Response:", res.status, responseText);

      if (!res.ok) {
        errors.push(`${startTime}: ${res.status} ${responseText}`);
        continue;
      }
      created++;
    } catch (e) {
      errors.push(`${startTime}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { created, errors };
}

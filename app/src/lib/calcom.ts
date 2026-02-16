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

/** AEDT = UTC+11. Noon (12:00) AEDT = 01:00 UTC. */
const AEDT_OFFSET_HOURS = 11;
const NOON_AEDT_UTC_HOUR = 1;

/**
 * Get 5 workout slot start times for the week (Mon–Fri), 12:00 AEDT each day.
 * weekStart = Monday 00:00 UTC; we want Mon 01:00, Tue 01:00, ... Fri 01:00 UTC.
 */
function getWorkoutSlotTimesForWeek(weekStart: Date): string[] {
  const slots: string[] = [];
  const msPerHour = 60 * 60 * 1000;
  for (let i = 0; i < PLANNED_WORKOUTS_PER_WEEK; i++) {
    const utc = new Date(
      weekStart.getTime() + (i * 24 + NOON_AEDT_UTC_HOUR) * msPerHour
    );
    slots.push(utc.toISOString().slice(0, 19) + "Z");
  }
  return slots;
}

/**
 * Create 5 workout bookings in Cal.com for the current week (11am–4pm AEDT window).
 * Uses Cal.com v2 API. Requires CALCOM_USERNAME and CALCOM_EVENT_TYPE_SLUG (e.g. "workout") or eventTypeId.
 */
const WORKOUT_DURATION_MINS = 30;

export async function createWorkoutSlotsForWeek(
  apiKey: string,
  options: {
    username?: string;
    eventTypeSlug?: string;
    eventTypeId?: number;
    attendeeEmail: string;
  }
): Promise<{ created: number; errors: string[] }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const slotTimes = getWorkoutSlotTimesForWeek(weekStart);
  const errors: string[] = [];
  let created = 0;

  for (const startTime of slotTimes) {
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + WORKOUT_DURATION_MINS * 60 * 1000);
      const endTime = endDate.toISOString().slice(0, 19) + "Z";

      const body: Record<string, unknown> = {
        start: startTime,
        end: endTime,
        responses: {},
        metadata: {},
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
      body.attendees = [{ email: options.attendeeEmail }];

      const res = await fetch("https://api.cal.com/v2/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "cal-api-version": "2024-06-11",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        errors.push(`${startTime}: ${res.status} ${err}`);
        continue;
      }
      created++;
    } catch (e) {
      errors.push(`${startTime}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { created, errors };
}

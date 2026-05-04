/**
 * Time helpers anchored to Australia/Sydney, regardless of the server's
 * local timezone. Render runs UTC, so naive `new Date()` arithmetic
 * gives the wrong day at the AEST/AEDT date rollover.
 */

const SYDNEY = "Australia/Sydney";

/** Returns yesterday's date as `yyyy-MM-dd` in Sydney time. */
export function yesterdayInSydney(): string {
  return ymdInSydney(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/** Returns today's date as `yyyy-MM-dd` in Sydney time. */
export function todayInSydney(): string {
  return ymdInSydney(new Date());
}

function ymdInSydney(d: Date): string {
  // en-CA's date format is yyyy-MM-dd, which is exactly what we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

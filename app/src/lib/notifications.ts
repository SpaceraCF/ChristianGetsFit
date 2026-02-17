import { prisma } from "@/lib/db";
import { DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/config";

export type NotificationType = "morning" | "pumpup" | "window" | "lastcall" | "summary" | "restday";

/** Get today's date in AEDT as a Date (midnight). */
function getAEDTToday(): Date {
  const nowStr = new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_SCHEDULE_TIMEZONE });
  return new Date(nowStr);
}

/** Check if a notification type was already sent today (AEDT) for a user. */
export async function wasSentToday(userId: string, type: NotificationType): Promise<boolean> {
  const today = getAEDTToday();
  const existing = await prisma.sentNotification.findUnique({
    where: { userId_date_type: { userId, date: today, type } },
  });
  return !!existing;
}

/** Mark a notification type as sent today (AEDT) for a user. */
export async function markSent(userId: string, type: NotificationType): Promise<void> {
  const today = getAEDTToday();
  await prisma.sentNotification.upsert({
    where: { userId_date_type: { userId, date: today, type } },
    create: { userId, date: today, type },
    update: {},
  });
}

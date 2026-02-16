import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";

const EVENT_TYPE_SLUG = process.env.CALCOM_EVENT_TYPE_SLUG ?? "workout";

/**
 * Cal.com webhook: on BOOKING_CANCELLED for workout event type, send Telegram reminder to rebook.
 * In Cal.com: Settings → Developer → Webhooks → Subscriber URL: https://cgf.one22.me/api/webhooks/calcom
 * Trigger: Booking Cancelled. Optional: set a Secret and CALCOM_WEBHOOK_SECRET in env to verify payloads.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let body: { triggerEvent?: string; payload?: { type?: string; attendees?: Array<{ email?: string }> } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get("x-cal-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody);
    const digest = hmac.digest("hex");
    if (signature !== digest) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  if (body.triggerEvent !== "BOOKING_CANCELLED") {
    return NextResponse.json({ ok: true });
  }

  const payload = body.payload;
  const eventType = payload?.type;
  if (eventType !== EVENT_TYPE_SLUG) {
    return NextResponse.json({ ok: true });
  }

  const attendeeEmail = payload?.attendees?.[0]?.email;
  if (!attendeeEmail) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findFirst({
    where: { email: attendeeEmail },
    select: { id: true, telegramChatId: true },
  });

  if (!user?.telegramChatId) {
    return NextResponse.json({ ok: true });
  }

  await sendTelegram(
    user.telegramChatId,
    "You cancelled a workout slot. Rebook it in your calendar to stay on track."
  );

  return NextResponse.json({ ok: true });
}

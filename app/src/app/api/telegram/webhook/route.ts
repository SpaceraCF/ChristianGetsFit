import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/dashboard";
import { startOfWeek } from "date-fns";
import { PLANNED_WORKOUTS_PER_WEEK, MIN_WORKOUTS_FOR_GOAL } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message ?? body.edited_message;
    if (!message?.from?.id || !message?.text) {
      return NextResponse.json({ ok: true });
    }
    const chatId = String(message.chat.id);
    const text = (message.text as string).trim();
    const fromId = message.from.id;

    let user = await prisma.user.findFirst({
      where: { telegramChatId: chatId },
    });
    if (!user && text.startsWith("/link ")) {
      const code = text.replace("/link", "").trim().toUpperCase();
      const byCode = await prisma.user.findFirst({
        where: { telegramLinkCode: code },
      });
      if (byCode) {
        await prisma.user.update({
          where: { id: byCode.id },
          data: { telegramChatId: chatId, telegramLinkCode: null },
        });
        user = await prisma.user.findUnique({ where: { id: byCode.id } });
        await send(chatId, "Telegram linked! You can use /status, /done, /weight, /punishment.");
      }
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
    }
    if (!user) {
      if (text === "/start") {
        await send(chatId, "To link: open the app → Settings → Link Telegram, then send /link YOUR_CODE here.");
      }
      return NextResponse.json({ ok: true });
    }

    if (text === "/status") {
      const stats = await getDashboardStats(user.id);
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const msg = [
        `<b>This week</b> (started ${weekStart.toLocaleDateString()})`,
        `Workouts: ${stats.workoutsThisWeek}/${PLANNED_WORKOUTS_PER_WEEK} planned (min ${MIN_WORKOUTS_FOR_GOAL})`,
        stats.punishmentActive ? "⚠️ Alcohol ban active this weekend." : "✓ No punishment.",
        `Level ${stats.level} · ${stats.xp} XP · ${stats.streak} week streak`,
        `Weight: ${stats.currentWeight}kg → goal ${stats.targetWeight}kg`,
      ].join("\n");
      await send(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    if (text === "/punishment") {
      const stats = await getDashboardStats(user.id);
      const msg = stats.punishmentActive
        ? `⚠️ Yes — you did fewer than ${MIN_WORKOUTS_FOR_GOAL} workouts this week. Alcohol ban is active for the weekend.`
        : `✓ No punishment. You hit your ${MIN_WORKOUTS_FOR_GOAL} workouts.`;
      await send(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/weight ")) {
      const part = text.replace("/weight", "").trim();
      const w = parseFloat(part);
      if (Number.isNaN(w) || w < 30 || w > 200) {
        await send(chatId, "Usage: /weight 81.5 (kg)");
        return NextResponse.json({ ok: true });
      }
      await prisma.weightLog.create({ data: { userId: user.id, weightKg: w } });
      await prisma.user.update({ where: { id: user.id }, data: { currentWeight: w } });
      await send(chatId, `Weight logged: ${w}kg`);
      return NextResponse.json({ ok: true });
    }

    if (text === "/done") {
      const stats = await getDashboardStats(user.id);
      const nextType = stats.nextWorkoutType;
      const workout = await prisma.workout.create({
        data: {
          userId: user.id,
          workoutType: nextType,
          isExpress: false,
          completedAt: new Date(),
          durationMins: 30,
        },
      });
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const count = await prisma.workout.count({
        where: {
          userId: user.id,
          completedAt: { gte: weekStart },
        },
      });
      const existing = await prisma.weeklyStat.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
      });
      if (existing) {
        await prisma.weeklyStat.update({
          where: { id: existing.id },
          data: { workoutsCompleted: count, punishmentActive: count < MIN_WORKOUTS_FOR_GOAL, xpEarned: existing.xpEarned + 50 },
        });
      } else {
        await prisma.weeklyStat.create({
          data: {
            userId: user.id,
            weekStart,
workoutsCompleted: count,
          punishmentActive: count < MIN_WORKOUTS_FOR_GOAL,
            xpEarned: 50,
          },
        });
      }
      await send(chatId, `Workout ${nextType} logged! ${count}/${PLANNED_WORKOUTS_PER_WEEK} this week (need ${MIN_WORKOUTS_FOR_GOAL} for goal).`);
      return NextResponse.json({ ok: true });
    }

    if (text === "/skip") {
      await send(chatId, "Intentional rest noted. Max 2 skip days per week to still hit your goal.");
      return NextResponse.json({ ok: true });
    }

    await send(chatId, "Commands: /status, /done, /weight 81.5, /punishment, /skip");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Telegram webhook]", e);
    return NextResponse.json({ ok: true });
  }
}

async function send(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

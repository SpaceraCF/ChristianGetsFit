import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek } from "date-fns";
import { checkAndAwardAchievements } from "@/lib/gamification";

const bodySchema = z.object({ weightKg: z.number().min(30).max(200) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    await prisma.weightLog.create({
      data: { userId: user.id, weightKg: body.weightKg },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { currentWeight: body.weightKg },
    });
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const existing = await prisma.weeklyStat.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    });
    if (existing) {
      await prisma.weeklyStat.update({
        where: { id: existing.id },
        data: { xpEarned: existing.xpEarned + 10 },
      });
    } else {
      await prisma.weeklyStat.create({
        data: {
          userId: user.id,
          weekStart,
          workoutsCompleted: 0,
          punishmentActive: true,
          xpEarned: 10,
        },
      });
    }
    await checkAndAwardAchievements(user.id, "weight");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to log weight" }, { status: 500 });
  }
}

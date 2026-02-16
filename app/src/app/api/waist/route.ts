import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardAchievements } from "@/lib/gamification";

const bodySchema = z.object({ waistCm: z.number().min(50).max(200) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    await prisma.waistLog.create({
      data: { userId: user.id, waistCm: body.waistCm },
    });
    await checkAndAwardAchievements(user.id, "waist");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to log waist" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const logs = await prisma.waistLog.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: "desc" },
      take: 90,
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

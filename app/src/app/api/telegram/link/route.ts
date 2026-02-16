import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST() {
  try {
    const user = await requireUser();
    const code = randomCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLinkCode: code },
    });
    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

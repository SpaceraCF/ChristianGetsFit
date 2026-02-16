import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const logs = await prisma.weightLog.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: "asc" },
      take: 365,
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

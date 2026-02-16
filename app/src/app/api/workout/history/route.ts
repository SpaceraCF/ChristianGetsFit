import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek, format } from "date-fns";

export async function GET() {
  try {
    const user = await requireUser();
    const workouts = await prisma.workout.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: "asc" },
    });
    const byWeek: Record<string, number> = {};
    for (const w of workouts) {
      const completed = w.completedAt!;
      const weekStart = startOfWeek(completed, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      byWeek[key] = (byWeek[key] ?? 0) + 1;
    }
    const weeks = Object.entries(byWeek)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);
    return NextResponse.json(weeks);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

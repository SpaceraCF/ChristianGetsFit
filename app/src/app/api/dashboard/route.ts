import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek, subWeeks } from "date-fns";
import { MIN_WORKOUTS_FOR_GOAL, PLANNED_WORKOUTS_PER_WEEK } from "@/lib/config";

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const weekStat = await prisma.weeklyStat.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
    });

    const workoutsThisWeek = await prisma.workout.count({
      where: {
        userId: user.id,
        completedAt: { not: null, gte: weekStart },
      },
    });

    const totalXp = await prisma.weeklyStat.aggregate({
      where: { userId: user.id },
      _sum: { xpEarned: true },
    });
    const xp = totalXp._sum.xpEarned ?? 0;
    const level = Math.floor(xp / 500) + 1;

    let streak = 0;
    let check = weekStart;
    for (let i = 0; i < 52; i++) {
      const ws = await prisma.weeklyStat.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart: check } },
      });
      const count = ws?.workoutsCompleted ?? await prisma.workout.count({
        where: {
          userId: user.id,
          completedAt: {
            gte: check,
            lt: new Date(check.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      });
      if (count >= MIN_WORKOUTS_FOR_GOAL) {
        streak++;
        check = subWeeks(check, 1);
      } else break;
    }

    const lastWorkout = await prisma.workout.findFirst({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
    });
    const order: Array<"A" | "B" | "C"> = ["A", "B", "C"];
    const nextWorkoutType = lastWorkout
      ? order[(order.indexOf(lastWorkout.workoutType as "A" | "B" | "C") + 1) % 3]
      : "A";

    const count = weekStat?.workoutsCompleted ?? workoutsThisWeek;
    return NextResponse.json({
      workoutsThisWeek: count,
      plannedWorkoutsPerWeek: PLANNED_WORKOUTS_PER_WEEK,
      minWorkoutsForGoal: MIN_WORKOUTS_FOR_GOAL,
      punishmentActive: (weekStat?.punishmentActive ?? count < MIN_WORKOUTS_FOR_GOAL) && new Date() >= weekStart,
      xp,
      level,
      streak,
      nextWorkoutType,
      currentWeight: user.currentWeight ?? user.startingWeight ?? 82,
      targetWeight: user.targetWeight ?? 75,
      startingWeight: user.startingWeight ?? 82,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

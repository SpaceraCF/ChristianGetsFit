import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek, format, subWeeks } from "date-fns";

export async function GET() {
  try {
    const user = await requireUser();
    const userId = user.id;

    const [weightLogs, waistLogs, workouts, exerciseLogs, fitbitDays] = await Promise.all([
      prisma.weightLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "asc" },
      }),
      prisma.waistLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "asc" },
      }),
      prisma.workout.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: "asc" },
      }),
      prisma.exerciseLog.findMany({
        where: { workout: { userId } },
        include: {
          exercise: { select: { name: true, muscleGroup: true } },
          workout: { select: { completedAt: true } },
        },
        orderBy: { workout: { completedAt: "asc" } },
      }),
      prisma.fitbitDaily.findMany({
        where: { userId },
        orderBy: { date: "asc" },
      }),
    ]);

    // Weight trend
    const weightTrend = weightLogs.map((l) => ({
      date: format(l.loggedAt, "MMM d"),
      weight: l.weightKg,
    }));

    // Waist trend
    const waistTrend = waistLogs.map((l) => ({
      date: format(l.loggedAt, "MMM d"),
      waist: l.waistCm,
    }));

    // Workouts per week (last 12 weeks)
    const byWeek: Record<string, { total: number; A: number; B: number; C: number }> = {};
    for (const w of workouts) {
      const ws = startOfWeek(w.completedAt!, { weekStartsOn: 1 });
      const key = format(ws, "MMM d");
      if (!byWeek[key]) byWeek[key] = { total: 0, A: 0, B: 0, C: 0 };
      byWeek[key].total++;
      const t = w.workoutType as "A" | "B" | "C";
      if (t in byWeek[key]) byWeek[key][t]++;
    }
    const workoutsPerWeek = Object.entries(byWeek)
      .map(([week, data]) => ({ week, ...data }))
      .slice(-12);

    // Workout type distribution (pie data)
    const typeCounts = { A: 0, B: 0, C: 0 };
    for (const w of workouts) {
      const t = w.workoutType as "A" | "B" | "C";
      if (t in typeCounts) typeCounts[t]++;
    }
    const workoutTypes = [
      { name: "Push (A)", value: typeCounts.A, fill: "#0ea5e9" },
      { name: "Pull (B)", value: typeCounts.B, fill: "#8b5cf6" },
      { name: "Legs (C)", value: typeCounts.C, fill: "#f59e0b" },
    ];

    // Strength progression: top exercises by total sessions
    const exerciseProgress: Record<string, Array<{ date: string; weight: number }>> = {};
    for (const log of exerciseLogs) {
      const name = log.exercise?.name ?? "Unknown";
      if (!exerciseProgress[name]) exerciseProgress[name] = [];
      const logDate = log.workout?.completedAt ?? new Date();
      exerciseProgress[name].push({
        date: format(logDate, "MMM d"),
        weight: log.weightKg,
      });
    }
    // Top 6 exercises by frequency
    const topExercises = Object.entries(exerciseProgress)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([name, data]) => ({ name, data }));

    // Fitbit data
    const fitbitTrend = fitbitDays.map((d) => ({
      date: format(d.date, "MMM d"),
      restingHr: d.restingHr,
      steps: d.steps,
      sleepMins: d.sleepDurationMins,
      sleepScore: d.sleepScore,
      activeMinutes: d.activeMinutes,
    }));

    // Stats summary
    const totalWorkouts = workouts.length;
    const currentWeight = user.currentWeight ?? user.startingWeight ?? 82;
    const targetWeight = user.targetWeight ?? 75;
    const startingWeight = user.startingWeight ?? 82;
    const weightLost = startingWeight - currentWeight;
    const progressPct = startingWeight !== targetWeight
      ? Math.round(((startingWeight - currentWeight) / (startingWeight - targetWeight)) * 100)
      : 0;

    // Current streak
    let streak = 0;
    let check = startOfWeek(new Date(), { weekStartsOn: 1 });
    for (let i = 0; i < 52; i++) {
      const count = workouts.filter((w) => {
        const ws = startOfWeek(w.completedAt!, { weekStartsOn: 1 });
        return ws.getTime() === check.getTime();
      }).length;
      if (count >= 3) { streak++; check = subWeeks(check, 1); }
      else break;
    }

    // Fitbit linked?
    const fitbitLinked = !!user.fitbitAccessToken;

    return NextResponse.json({
      weightTrend,
      waistTrend,
      workoutsPerWeek,
      workoutTypes,
      topExercises,
      fitbitTrend,
      fitbitLinked,
      stats: {
        totalWorkouts,
        currentWeight,
        targetWeight,
        startingWeight,
        weightLost: Math.round(weightLost * 10) / 10,
        progressPct: Math.max(0, Math.min(100, progressPct)),
        streak,
      },
    });
  } catch (e) {
    console.error("[analytics]", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

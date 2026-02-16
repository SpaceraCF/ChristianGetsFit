import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfWeek, format, subWeeks, subDays, differenceInWeeks } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const userId = user.id;

    const range = req.nextUrl.searchParams.get("range") ?? "3M";
    const now = new Date();
    const rangeStart = getRangeStart(range, now);

    const [weightLogs, waistLogs, workouts, allWorkouts, exerciseLogs, fitbitDays, milestones] = await Promise.all([
      prisma.weightLog.findMany({
        where: { userId, loggedAt: { gte: rangeStart } },
        orderBy: { loggedAt: "asc" },
      }),
      prisma.waistLog.findMany({
        where: { userId, loggedAt: { gte: rangeStart } },
        orderBy: { loggedAt: "asc" },
      }),
      prisma.workout.findMany({
        where: { userId, completedAt: { not: null, gte: rangeStart } },
        orderBy: { completedAt: "asc" },
      }),
      prisma.workout.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: "asc" },
        select: { completedAt: true },
      }),
      prisma.exerciseLog.findMany({
        where: { workout: { userId, completedAt: { gte: rangeStart } } },
        include: {
          exercise: { select: { name: true, muscleGroup: true } },
          workout: { select: { completedAt: true } },
        },
        orderBy: { workout: { completedAt: "asc" } },
      }),
      prisma.fitbitDaily.findMany({
        where: { userId, date: { gte: rangeStart } },
        orderBy: { date: "asc" },
      }),
      prisma.weightMilestone.findMany({
        where: { userId },
        orderBy: { achievedAt: "asc" },
      }),
    ]);

    // Weight trend with 7-day moving average
    const weightTrend = weightLogs.map((l, i) => {
      const window = weightLogs.slice(Math.max(0, i - 6), i + 1);
      const ma = window.reduce((s, w) => s + w.weightKg, 0) / window.length;
      return {
        date: format(l.loggedAt, "MMM d"),
        weight: l.weightKg,
        ma: Math.round(ma * 10) / 10,
      };
    });

    // Waist trend
    const waistTrend = waistLogs.map((l) => ({
      date: format(l.loggedAt, "MMM d"),
      waist: l.waistCm,
    }));

    // Workouts per week (within range)
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

    // Workout type distribution
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

    // Strength progression
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

    // Heatmap: last 365 days of workout completions
    const heatmap: Array<{ date: string; count: number }> = [];
    const dateCountMap: Record<string, number> = {};
    for (const w of allWorkouts) {
      if (!w.completedAt) continue;
      const key = format(w.completedAt, "yyyy-MM-dd");
      dateCountMap[key] = (dateCountMap[key] ?? 0) + 1;
    }
    for (let i = 364; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, "yyyy-MM-dd");
      heatmap.push({ date: key, count: dateCountMap[key] ?? 0 });
    }

    // Milestone annotations for weight chart
    const milestoneAnnotations = milestones.map((m) => ({
      date: format(m.achievedAt, "MMM d"),
      label: m.milestoneType,
      weight: m.targetKg,
    }));

    // Stats summary
    const totalWorkouts = allWorkouts.length;
    const currentWeight = user.currentWeight ?? user.startingWeight ?? 82;
    const targetWeight = user.targetWeight ?? 75;
    const startingWeight = user.startingWeight ?? 82;
    const weightLost = startingWeight - currentWeight;
    const progressPct = startingWeight !== targetWeight
      ? Math.round(((startingWeight - currentWeight) / (startingWeight - targetWeight)) * 100)
      : 0;

    // Streak
    let streak = 0;
    let check = startOfWeek(now, { weekStartsOn: 1 });
    for (let i = 0; i < 52; i++) {
      const count = allWorkouts.filter((w) => {
        const ws = startOfWeek(w.completedAt!, { weekStartsOn: 1 });
        return ws.getTime() === check.getTime();
      }).length;
      if (count >= 3) { streak++; check = subWeeks(check, 1); }
      else break;
    }

    // Projected weeks
    let projectedWeeksLeft: number | null = null;
    if (weightLost > 0 && user.goalStartedAt) {
      const weeksElapsed = Math.max(1, differenceInWeeks(now, user.goalStartedAt));
      const ratePerWeek = weightLost / weeksElapsed;
      const remaining = currentWeight - targetWeight;
      if (remaining > 0 && ratePerWeek > 0) {
        projectedWeeksLeft = Math.ceil(remaining / ratePerWeek);
      }
    }

    const fitbitLinked = !!user.fitbitAccessToken;

    return NextResponse.json({
      weightTrend,
      waistTrend,
      workoutsPerWeek,
      workoutTypes,
      topExercises,
      fitbitTrend,
      fitbitLinked,
      heatmap,
      milestoneAnnotations,
      stats: {
        totalWorkouts,
        currentWeight,
        targetWeight,
        startingWeight,
        weightLost: Math.round(weightLost * 10) / 10,
        progressPct: Math.max(0, Math.min(100, progressPct)),
        streak,
        projectedWeeksLeft,
      },
    });
  } catch (e) {
    console.error("[analytics]", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

function getRangeStart(range: string, now: Date): Date {
  switch (range) {
    case "1W": return subDays(now, 7);
    case "1M": return subDays(now, 30);
    case "3M": return subDays(now, 90);
    case "6M": return subDays(now, 180);
    case "1Y": return subDays(now, 365);
    default: return subDays(now, 90);
  }
}

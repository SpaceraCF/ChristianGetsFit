import { prisma } from "@/lib/db";
import { startOfWeek, subWeeks, differenceInWeeks } from "date-fns";
import { MIN_WORKOUTS_FOR_GOAL, PLANNED_WORKOUTS_PER_WEEK } from "@/lib/config";

export async function getDashboardStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentWeight: true, startingWeight: true, targetWeight: true, goalStartedAt: true, fitbitAccessToken: true },
  });
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const weekStat = await prisma.weeklyStat.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });

  const workoutsThisWeek = await prisma.workout.count({
    where: {
      userId,
      completedAt: { not: null, gte: weekStart },
    },
  });

  const totalXp = await prisma.weeklyStat.aggregate({
    where: { userId },
    _sum: { xpEarned: true },
  });
  const xp = totalXp._sum.xpEarned ?? 0;
  const level = Math.floor(xp / 500) + 1;

  let streak = 0;
  let check = weekStart;
  for (let i = 0; i < 52; i++) {
    const ws = await prisma.weeklyStat.findUnique({
      where: { userId_weekStart: { userId, weekStart: check } },
    });
    const count =
      ws?.workoutsCompleted ??
      (await prisma.workout.count({
        where: {
          userId,
          completedAt: {
            gte: check,
            lt: new Date(check.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }));
    if (count >= MIN_WORKOUTS_FOR_GOAL) {
      streak++;
      check = subWeeks(check, 1);
    } else break;
  }

  const lastWorkout = await prisma.workout.findFirst({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  const order: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  const nextWorkoutType = lastWorkout
    ? order[(order.indexOf(lastWorkout.workoutType as "A" | "B" | "C") + 1) % 3]
    : "A";

  const count = weekStat?.workoutsCompleted ?? workoutsThisWeek;
  const punishmentActive = count < MIN_WORKOUTS_FOR_GOAL && now >= weekStart;

  const currentWeight = user?.currentWeight ?? user?.startingWeight ?? 82;
  const startingWeight = user?.startingWeight ?? 82;
  const targetWeight = user?.targetWeight ?? 75;

  // Recovery status from latest Fitbit daily data
  let recoveryStatus: "well_rested" | "take_it_easy" | "normal" | null = null;
  if (user?.fitbitAccessToken) {
    const latest = await prisma.fitbitDaily.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { recoveryRecommendation: true },
    });
    if (latest?.recoveryRecommendation === "push") recoveryStatus = "well_rested";
    else if (latest?.recoveryRecommendation === "rest") recoveryStatus = "take_it_easy";
    else if (latest?.recoveryRecommendation === "normal") recoveryStatus = "normal";
  }

  // Projected goal date
  let projectedWeeksLeft: number | null = null;
  const totalToLose = startingWeight - targetWeight;
  const lost = startingWeight - currentWeight;
  if (lost > 0 && user?.goalStartedAt) {
    const weeksElapsed = Math.max(1, differenceInWeeks(now, user.goalStartedAt));
    const ratePerWeek = lost / weeksElapsed;
    const remaining = currentWeight - targetWeight;
    if (remaining > 0 && ratePerWeek > 0) {
      projectedWeeksLeft = Math.ceil(remaining / ratePerWeek);
    }
  }

  // Next milestone
  const milestones = [
    { type: "first_drop", target: startingWeight - 1, label: "First Kilo Down" },
    { type: "25%", target: startingWeight - totalToLose * 0.25, label: "25% There" },
    { type: "halfway", target: startingWeight - totalToLose * 0.5, label: "Halfway" },
    { type: "75%", target: startingWeight - totalToLose * 0.75, label: "75% There" },
    { type: "goal", target: targetWeight, label: "GOAL" },
  ];
  const nextMilestone = milestones.find((m) => currentWeight > m.target) ?? null;

  return {
    workoutsThisWeek: count,
    plannedWorkoutsPerWeek: PLANNED_WORKOUTS_PER_WEEK,
    minWorkoutsForGoal: MIN_WORKOUTS_FOR_GOAL,
    punishmentActive,
    xp,
    level,
    streak,
    nextWorkoutType,
    currentWeight,
    targetWeight,
    startingWeight,
    recoveryStatus,
    projectedWeeksLeft,
    nextMilestone: nextMilestone ? { label: nextMilestone.label, targetKg: Math.round(nextMilestone.target * 10) / 10 } : null,
  };
}

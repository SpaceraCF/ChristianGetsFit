import { prisma } from "@/lib/db";
import { startOfWeek, subWeeks } from "date-fns";

export type Quest = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  xp: number;
};

const QUEST_DEFINITIONS = [
  {
    id: "try_new_exercise",
    title: "Try a new exercise",
    description: "Complete an exercise you haven't done before",
  },
  {
    id: "beat_last_week",
    title: "Beat last week's weight",
    description: "Increase weight on any exercise vs last week",
  },
  {
    id: "log_weight_2x",
    title: "Log weight twice",
    description: "Log your body weight at least 2 times this week",
  },
  {
    id: "complete_3_workouts",
    title: "Hit the minimum",
    description: "Complete at least 3 workouts this week",
  },
  {
    id: "no_skips",
    title: "Full commitment",
    description: "Don't skip any warm-up exercises this week",
  },
  {
    id: "log_waist",
    title: "Measure up",
    description: "Log a waist measurement this week",
  },
];

const QUEST_XP = 30;

function getWeeklyQuestIds(weekStart: Date): string[] {
  const seed = weekStart.getTime();
  const shuffled = [...QUEST_DEFINITIONS].sort(
    (a, b) => hashCode(a.id + seed) - hashCode(b.id + seed)
  );
  return shuffled.slice(0, 3).map((q) => q.id);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export async function getWeeklyQuests(userId: string): Promise<Quest[]> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);
  const questIds = getWeeklyQuestIds(weekStart);

  const results: Quest[] = [];

  for (const qid of questIds) {
    const def = QUEST_DEFINITIONS.find((q) => q.id === qid)!;
    let completed = false;

    if (qid === "try_new_exercise") {
      const thisWeekLogs = await prisma.exerciseLog.findMany({
        where: { workout: { userId, completedAt: { gte: weekStart } } },
        select: { exerciseId: true },
      });
      const prevLogs = await prisma.exerciseLog.findMany({
        where: { workout: { userId, completedAt: { lt: weekStart } } },
        select: { exerciseId: true },
      });
      const prevIds = new Set(prevLogs.map((l) => l.exerciseId));
      completed = thisWeekLogs.some((l) => !prevIds.has(l.exerciseId));
    } else if (qid === "beat_last_week") {
      const lastWeekLogs = await prisma.exerciseLog.findMany({
        where: {
          workout: { userId, completedAt: { gte: lastWeekStart, lt: weekStart } },
        },
        select: { exerciseId: true, weightKg: true },
      });
      const maxByExercise: Record<string, number> = {};
      for (const l of lastWeekLogs) {
        maxByExercise[l.exerciseId] = Math.max(maxByExercise[l.exerciseId] ?? 0, l.weightKg);
      }
      const thisWeekLogs = await prisma.exerciseLog.findMany({
        where: { workout: { userId, completedAt: { gte: weekStart } } },
        select: { exerciseId: true, weightKg: true },
      });
      completed = thisWeekLogs.some(
        (l) => l.exerciseId in maxByExercise && l.weightKg > maxByExercise[l.exerciseId]
      );
    } else if (qid === "log_weight_2x") {
      const count = await prisma.weightLog.count({
        where: { userId, loggedAt: { gte: weekStart } },
      });
      completed = count >= 2;
    } else if (qid === "complete_3_workouts") {
      const count = await prisma.workout.count({
        where: { userId, completedAt: { gte: weekStart } },
      });
      completed = count >= 3;
    } else if (qid === "no_skips") {
      completed = false; // tracked client-side; stays false server-side
    } else if (qid === "log_waist") {
      const count = await prisma.waistLog.count({
        where: { userId, loggedAt: { gte: weekStart } },
      });
      completed = count >= 1;
    }

    results.push({
      id: qid,
      title: def.title,
      description: def.description,
      completed,
      xp: QUEST_XP,
    });
  }

  return results;
}

export async function awardQuestXp(userId: string): Promise<number> {
  const quests = await getWeeklyQuests(userId);
  const completedCount = quests.filter((q) => q.completed).length;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const stat = await prisma.weeklyStat.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });
  const alreadyAwarded = stat?.questsCompleted ?? 0;

  if (completedCount > alreadyAwarded) {
    const newQuests = completedCount - alreadyAwarded;
    const xpToAdd = newQuests * QUEST_XP;
    if (stat) {
      await prisma.weeklyStat.update({
        where: { id: stat.id },
        data: {
          questsCompleted: completedCount,
          xpEarned: stat.xpEarned + xpToAdd,
        },
      });
    } else {
      await prisma.weeklyStat.create({
        data: {
          userId,
          weekStart,
          workoutsCompleted: 0,
          punishmentActive: true,
          xpEarned: xpToAdd,
          questsCompleted: completedCount,
        },
      });
    }
    return xpToAdd;
  }
  return 0;
}

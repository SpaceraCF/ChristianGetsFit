import { prisma } from "@/lib/db";
import { startOfWeek, subWeeks } from "date-fns";

const ACHIEVEMENT_TYPES = [
  "first_blood",
  "consistency_king",
  "scale_warrior",
  "down_5",
  "pr_breaker",
  "first_kilo_down",
  "goal_crusher",
  "belt_notch",
  "healthy_zone",
] as const;

export async function checkAndAwardAchievements(
  userId: string,
  event: "workout" | "weight" | "waist"
): Promise<void> {
  const existing = await prisma.achievement.findMany({
    where: { userId },
    select: { achievementType: true },
  });
  const have = new Set(existing.map((a) => a.achievementType));

  if (event === "workout") {
    if (!have.has("first_blood")) {
      const count = await prisma.workout.count({ where: { userId, completedAt: { not: null } } });
      if (count >= 1) {
        await prisma.achievement.create({
          data: { userId, achievementType: "first_blood" },
        });
        await addXp(userId, 50);
      }
    }
    if (!have.has("consistency_king")) {
      let streak = 0;
      let check = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (let i = 0; i < 4; i++) {
        const c = await prisma.workout.count({
          where: {
            userId,
            completedAt: {
              gte: check,
              lt: new Date(check.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        });
        if (c >= 3) {
          streak++;
          check = subWeeks(check, 1);
        } else break;
      }
      if (streak >= 4) {
        await prisma.achievement.create({
          data: { userId, achievementType: "consistency_king" },
        });
        await addXp(userId, 100);
      }
    }
  }

  if (event === "weight") {
    const logs = await prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      take: 8,
    });
    if (!have.has("scale_warrior") && logs.length >= 8) {
      await prisma.achievement.create({
        data: { userId, achievementType: "scale_warrior" },
      });
      await addXp(userId, 50);
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { startingWeight: true, currentWeight: true, targetWeight: true },
    });
    const start = user?.startingWeight ?? 82;
    const current = user?.currentWeight ?? start;
    if (!have.has("first_kilo_down") && start - current >= 1) {
      await prisma.achievement.create({
        data: { userId, achievementType: "first_kilo_down" },
      });
      await addXp(userId, 100);
    }
    if (!have.has("down_5") && start - current >= 5) {
      await prisma.achievement.create({
        data: { userId, achievementType: "down_5" },
      });
      await addXp(userId, 200);
    }
    const target = user?.targetWeight ?? 75;
    if (!have.has("goal_crusher") && current <= target) {
      await prisma.achievement.create({
        data: { userId, achievementType: "goal_crusher" },
      });
      await addXp(userId, 1000);
    }
  }

  if (event === "waist") {
    const logs = await prisma.waistLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      take: 1,
    });
    const current = logs[0]?.waistCm;
    if (!have.has("healthy_zone") && current != null && current < 90) {
      await prisma.achievement.create({
        data: { userId, achievementType: "healthy_zone" },
      });
      await addXp(userId, 150);
    }
  }
}

async function addXp(userId: string, xp: number): Promise<void> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const existing = await prisma.weeklyStat.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });
  if (existing) {
    await prisma.weeklyStat.update({
      where: { id: existing.id },
      data: { xpEarned: existing.xpEarned + xp },
    });
  } else {
    await prisma.weeklyStat.create({
      data: {
        userId,
        weekStart,
        workoutsCompleted: 0,
        punishmentActive: true,
        xpEarned: xp,
      },
    });
  }
}

export function getAchievementLabel(type: string): string {
  const labels: Record<string, string> = {
    first_blood: "First Blood",
    consistency_king: "Consistency King",
    scale_warrior: "Scale Warrior",
    down_5: "Down 5",
    pr_breaker: "PR Breaker",
    first_kilo_down: "First Kilo Down",
    goal_crusher: "Goal Crusher",
    belt_notch: "Belt Notch",
    healthy_zone: "Healthy Zone",
  };
  return labels[type] ?? type;
}

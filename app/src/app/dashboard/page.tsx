import { redirect } from "next/navigation";
import { getUserOrNull } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUserOrNull();
  if (!user) redirect("/");

  const data = await getDashboardStats(user.id);
  const currentWeight = data.currentWeight ?? 82;
  const targetWeight = data.targetWeight ?? 75;
  const startWeight = data.startingWeight ?? 82;
  const totalToLose = startWeight - targetWeight;
  const lost = startWeight - currentWeight;
  const pct = totalToLose > 0 ? Math.round((lost / totalToLose) * 100) : 0;
  const {
    workoutsThisWeek,
    plannedWorkoutsPerWeek = 5,
    minWorkoutsForGoal = 3,
    punishmentActive,
    xp,
    level,
    streak,
    nextWorkoutType,
  } = data;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{startWeight}kg</span>
            <span>{targetWeight}kg</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {currentWeight}kg ({pct}% there)
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild className="flex-1">
          <Link href="/dashboard/workout">Start workout</Link>
        </Button>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/log-weight">Log weight</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/log-waist">Log waist</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            Workouts: {workoutsThisWeek}/{plannedWorkoutsPerWeek} planned
            {workoutsThisWeek >= minWorkoutsForGoal
              ? " — Goal hit (min 3)!"
              : ` — Do at least ${minWorkoutsForGoal} to avoid the weekend alcohol ban.`}
          </p>
          {punishmentActive && workoutsThisWeek < minWorkoutsForGoal && (
            <p className="text-sm font-medium text-destructive">Alcohol ban active this weekend.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Next: Workout {nextWorkoutType} · Streak: {streak} week{streak !== 1 ? "s" : ""} · Level {level} ({xp} XP)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

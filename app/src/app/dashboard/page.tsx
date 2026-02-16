import { redirect } from "next/navigation";
import { getUserOrNull } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { getWeeklyQuests } from "@/lib/quests";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUserOrNull();
  if (!user) redirect("/");

  const data = await getDashboardStats(user.id);
  const quests = await getWeeklyQuests(user.id);
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
    recoveryStatus,
    projectedWeeksLeft,
    nextMilestone,
  } = data;

  const recoveryLabel =
    recoveryStatus === "well_rested" ? "Well rested — push harder today!"
    : recoveryStatus === "take_it_easy" ? "Take it easy — your body needs recovery"
    : recoveryStatus === "normal" ? "Normal recovery — good to go"
    : null;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Recovery status */}
      {recoveryLabel && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          recoveryStatus === "well_rested" ? "bg-green-50 text-green-700 border border-green-200" :
          recoveryStatus === "take_it_easy" ? "bg-amber-50 text-amber-700 border border-amber-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {recoveryLabel}
        </div>
      )}

      {/* Weight goal */}
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
            Current: {currentWeight}kg ({pct}% there) · Lost {Math.round(lost * 10) / 10}kg
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {nextMilestone && (
              <span>Next milestone: {nextMilestone.targetKg}kg ({nextMilestone.label})</span>
            )}
            {projectedWeeksLeft != null && (
              <span>~{projectedWeeksLeft} week{projectedWeeksLeft !== 1 ? "s" : ""} to go</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
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

      {/* This week */}
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

      {/* Weekly quests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly quests</CardTitle>
          <p className="text-xs text-muted-foreground">30 XP each</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {quests.map((q) => (
            <div key={q.id} className="flex items-start gap-3">
              <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                q.completed ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}>
                {q.completed && (
                  <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${q.completed ? "line-through text-muted-foreground" : ""}`}>{q.title}</p>
                <p className="text-xs text-muted-foreground">{q.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

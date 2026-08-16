import { redirect } from "next/navigation";
import { getUserOrNull } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKOUT_LABELS } from "@/lib/program";

export default async function WorkoutPage() {
  const user = await getUserOrNull();
  if (!user) redirect("/");

  const stats = await getDashboardStats(user.id);
  const next = stats.nextWorkoutType;
  const label = WORKOUT_LABELS[next] ?? WORKOUT_LABELS.A;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Workout</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Block {stats.program.block}: {stats.program.blockName} · Week {stats.program.week}: {stats.program.weekName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{stats.program.weekDescription}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(stats.program.sessionInBlock / 12) * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Session {stats.program.sessionInBlock} of 12 · Exercise selection changes after this four-week block.
          </p>
        </CardContent>
      </Card>

      {/* Recommended next */}
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="text-base">Up next: Workout {next} — {label.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{label.focus}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button asChild className="flex-1" size="lg">
              <Link href={`/dashboard/workout/do?type=${next}&express=false`}>
                Full (30 min)
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1" size="lg">
              <Link href={`/dashboard/workout/do?type=${next}&express=true`}>
                Express (15 min)
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Training week session {stats.program.sessionInWeek}/3 · Target: stop with about {stats.program.targetRir} good reps available
          </p>
        </CardContent>
      </Card>

      {/* Rotation explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Three full-body sessions make one training week. Week 1 is light,
            each week adds an available weight step, and Week 4 is the heaviest
            without being a max test. Progress advances only when you finish a session.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(["A", "B", "C"] as const).map((t) => {
              const l = WORKOUT_LABELS[t];
              return (
                <div key={t} className={`rounded-lg p-2 text-xs ${t === next ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                  <p className="font-semibold">{t}: {l.name.replace("Full Body ", "")}</p>
                  <p className="text-muted-foreground">{l.focus}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Manual pick */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Pick a different workout
        </summary>
        <div className="mt-3 grid gap-2">
          {(["A", "B", "C"] as const).filter((t) => t !== next).map((type) => (
            <div key={type} className="flex gap-2">
              <Button asChild variant="outline" className="flex-1" size="sm">
                <Link href={`/dashboard/workout/do?type=${type}&express=false`}>
                  {type}: {WORKOUT_LABELS[type].name} (Full)
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex-1" size="sm">
                <Link href={`/dashboard/workout/do?type=${type}&express=true`}>
                  {type}: {WORKOUT_LABELS[type].name} (Express)
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

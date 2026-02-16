import { redirect } from "next/navigation";
import { getUserOrNull } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WorkoutPage() {
  const user = await getUserOrNull();
  if (!user) redirect("/");

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Choose workout</h1>
      <p className="text-muted-foreground text-sm">
        Full = 30 min (5–6 exercises). Express = 15 min (3 exercises). Both count toward your 3/week.
      </p>

      <div className="grid gap-3">
        {(["A", "B", "C"] as const).map((type) => (
          <div key={type} className="flex gap-2">
            <Button asChild className="flex-1" size="lg">
              <Link href={`/dashboard/workout/do?type=${type}&express=false`}>
                Workout {type} (Full)
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1" size="lg">
              <Link href={`/dashboard/workout/do?type=${type}&express=true`}>
                Workout {type} (Express)
              </Link>
            </Button>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A = Push (chest, shoulders, triceps). B = Pull (back, biceps). C = Legs + core.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

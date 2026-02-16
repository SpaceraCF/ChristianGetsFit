import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <h1 className="text-2xl font-bold">ChristianGetsFit</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        5 workouts planned per week (min 3 to hit goal). Smith machine & dumbbells. We keep you accountable.
      </p>
      <Button asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    </div>
  );
}

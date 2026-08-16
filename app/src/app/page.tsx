import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <h1 className="text-2xl font-bold">ChristianGetsFit</h1>
      <p className="text-muted-foreground text-center max-w-sm">
        Three beginner-friendly full-body sessions per training week. The load builds across four weeks, then the exercises change.
      </p>
      <Button asChild size="lg">
        <a href="/api/auth/google">Sign in with Google</a>
      </Button>
    </div>
  );
}

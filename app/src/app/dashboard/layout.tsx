import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold">
          ChristianGetsFit
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <Link href="/dashboard/workout" className="text-muted-foreground hover:text-foreground">
            Workout
          </Link>
          <Link href="/dashboard/analytics" className="text-muted-foreground hover:text-foreground">
            Analytics
          </Link>
          <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">
            Settings
          </Link>
          <a href="/api/auth/logout" className="text-muted-foreground hover:text-foreground">
            Logout
          </a>
        </nav>
      </header>
      <main className="p-4 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card flex justify-around py-2 safe-area-pb md:hidden">
        <Link href="/dashboard" className="p-2 text-muted-foreground hover:text-foreground">
          Home
        </Link>
        <Link href="/dashboard/workout" className="p-2 text-muted-foreground hover:text-foreground">
          Workout
        </Link>
        <Link href="/dashboard/analytics" className="p-2 text-muted-foreground hover:text-foreground">
          Analytics
        </Link>
        <Link href="/dashboard/settings" className="p-2 text-muted-foreground hover:text-foreground">
          Settings
        </Link>
      </nav>
    </div>
  );
}

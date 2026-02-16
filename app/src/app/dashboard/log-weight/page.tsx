"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogWeightPage() {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (Number.isNaN(w) || w <= 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: w }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/dashboard");
      router.refresh();
    } catch {
      alert("Failed to log weight");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Log weight</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s weigh-in</CardTitle>
          <p className="text-sm text-muted-foreground">Same day and time each week for best accuracy.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="200"
                placeholder="82"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-lg"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Button variant="ghost" asChild>
        <Link href="/dashboard">Cancel</Link>
      </Button>
    </div>
  );
}

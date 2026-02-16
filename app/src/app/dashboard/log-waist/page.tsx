"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogWaistPage() {
  const router = useRouter();
  const [waist, setWaist] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(waist);
    if (Number.isNaN(w) || w <= 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waistCm: w }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/dashboard");
      router.refresh();
    } catch {
      alert("Failed to log waist");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Log waist</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waist (cm)</CardTitle>
          <p className="text-sm text-muted-foreground">Measure at navel, relaxed. Same day as weigh-in for consistency.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="number"
              step="0.1"
              min="50"
              max="200"
              placeholder="92"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg"
            />
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

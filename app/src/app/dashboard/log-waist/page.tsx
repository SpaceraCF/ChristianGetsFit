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
      {/* How-to guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to measure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center justify-center">
              <svg viewBox="0 0 120 160" className="w-24 h-32 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                {/* Simple body outline */}
                <ellipse cx="60" cy="20" rx="15" ry="18" />
                <line x1="60" y1="38" x2="60" y2="100" />
                <line x1="60" y1="55" x2="30" y2="80" />
                <line x1="60" y1="55" x2="90" y2="80" />
                <line x1="60" y1="100" x2="40" y2="150" />
                <line x1="60" y1="100" x2="80" y2="150" />
                {/* Tape measure line at navel */}
                <ellipse cx="60" cy="85" rx="22" ry="8" strokeDasharray="4 2" stroke="#f59e0b" strokeWidth="3" />
                <circle cx="60" cy="85" r="2" fill="#f59e0b" />
                <text x="88" y="88" fontSize="8" fill="#f59e0b" fontWeight="bold">navel</text>
              </svg>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Stand upright and relaxed — don&apos;t suck in</li>
              <li>Find your navel (belly button)</li>
              <li>Wrap a tape measure around at navel level</li>
              <li>Keep the tape snug but not tight</li>
              <li>Breathe out normally, then read the number</li>
              <li>Measure in the morning for consistency</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Target: under 90cm (healthy range for men). Every 2cm lost earns the &quot;Belt Notch&quot; achievement!
          </p>
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waist (cm)</CardTitle>
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

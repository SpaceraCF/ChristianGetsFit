"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WeightPoint = { date: string; weight: number };
type WeekBar = { week: string; count: number };

export default function AnalyticsPage() {
  const [weightData, setWeightData] = useState<WeightPoint[]>([]);
  const [weekData, setWeekData] = useState<WeekBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [wRes, workoutsRes] = await Promise.all([
          fetch("/api/weight/history"),
          fetch("/api/workout/history"),
        ]);
        if (wRes.ok) {
          const logs = await wRes.json();
          setWeightData(
            logs.map((l: { loggedAt: string; weightKg: number }) => ({
              date: new Date(l.loggedAt).toLocaleDateString(),
              weight: l.weightKg,
            }))
          );
        }
        if (workoutsRes.ok) {
          const weeks = await workoutsRes.json();
          setWeekData(weeks);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight trend</CardTitle>
          <p className="text-sm text-muted-foreground">Target: 75kg</p>
        </CardHeader>
        <CardContent>
          {weightData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log weight to see your trend.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  <ReferenceLine y={75} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workouts per week</CardTitle>
          <p className="text-sm text-muted-foreground">Goal: 3 per week</p>
        </CardHeader>
        <CardContent>
          {weekData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Complete workouts to see history.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine y={3} stroke="var(--destructive)" strokeDasharray="2 2" />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

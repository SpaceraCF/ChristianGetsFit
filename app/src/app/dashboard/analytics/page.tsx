"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Analytics = {
  weightTrend: Array<{ date: string; weight: number; ma: number }>;
  waistTrend: Array<{ date: string; waist: number }>;
  workoutsPerWeek: Array<{ week: string; total: number; A: number; B: number; C: number }>;
  workoutTypes: Array<{ name: string; value: number; fill: string }>;
  topExercises: Array<{ name: string; data: Array<{ date: string; weight: number }> }>;
  fitbitTrend: Array<{
    date: string; restingHr: number | null; steps: number | null;
    sleepMins: number | null; sleepScore: number | null; activeMinutes: number | null;
  }>;
  fitbitLinked: boolean;
  heatmap: Array<{ date: string; count: number }>;
  milestoneAnnotations: Array<{ date: string; label: string; weight: number }>;
  stats: {
    totalWorkouts: number; currentWeight: number; targetWeight: number;
    startingWeight: number; weightLost: number; progressPct: number; streak: number;
    projectedWeeksLeft: number | null;
  };
};

const COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
const RANGES = ["1W", "1M", "3M", "6M", "1Y"] as const;
type Range = typeof RANGES[number];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "strength" | "fitbit">("overview");
  const [range, setRange] = useState<Range>("3M");

  const fetchData = useCallback((r: Range) => {
    return fetch(`/api/analytics?range=${r}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d));
  }, []);

  function refreshData() {
    fetchData(range);
  }

  useEffect(() => {
    setLoading(true);
    fetchData(range).finally(() => setLoading(false));
  }, [range, fetchData]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-destructive">Failed to load analytics.</p>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Workouts" value={stats.totalWorkouts.toString()} />
        <SummaryCard label="Streak" value={`${stats.streak}w`} />
        <SummaryCard label="Lost" value={`${stats.weightLost}kg`} />
        <SummaryCard
          label="Progress"
          value={`${stats.progressPct}%`}
          sub={stats.projectedWeeksLeft != null ? `~${stats.projectedWeeksLeft}w to goal` : `${stats.currentWeight}kg / ${stats.targetWeight}kg`}
        />
      </div>

      {/* Time range selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              range === r ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {(["overview", "strength", "fitbit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "overview" ? "Overview" : t === "strength" ? "Strength" : "Fitbit"}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "strength" && <StrengthTab data={data} />}
      {tab === "fitbit" && <FitbitTab data={data} onRefresh={refreshData} />}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Heatmap ─── */
function WorkoutHeatmap({ data }: { data: Array<{ date: string; count: number }> }) {
  const weeks: Array<Array<{ date: string; count: number }>> = [];
  let week: Array<{ date: string; count: number }> = [];
  for (const d of data) {
    const dayOfWeek = new Date(d.date).getDay();
    if (dayOfWeek === 1 && week.length > 0) {
      weeks.push(week);
      week = [];
    }
    week.push(d);
  }
  if (week.length > 0) weeks.push(week);

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-green-300";
    return "bg-green-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workout heatmap</CardTitle>
        <p className="text-sm text-muted-foreground">Last 52 weeks</p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-[2px] overflow-x-auto pb-2">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {w.map((d) => (
                <div
                  key={d.date}
                  className={`w-[10px] h-[10px] rounded-[2px] ${getColor(d.count)}`}
                  title={`${d.date}: ${d.count} workout${d.count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="w-[10px] h-[10px] rounded-[2px] bg-muted" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-green-300" />
          <div className="w-[10px] h-[10px] rounded-[2px] bg-green-500" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ data }: { data: Analytics }) {
  return (
    <div className="space-y-6">
      {/* Weight trend with moving average */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight trend</CardTitle>
          <p className="text-sm text-muted-foreground">
            {data.stats.startingWeight}kg &rarr; {data.stats.targetWeight}kg goal
            {data.stats.projectedWeeksLeft != null && ` · ~${data.stats.projectedWeeksLeft} weeks to go`}
          </p>
        </CardHeader>
        <CardContent>
          {data.weightTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Log your weight to see the trend.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weightTrend}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={data.stats.targetWeight} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Goal", fontSize: 11 }} />
                  {data.milestoneAnnotations.map((m, i) => (
                    <ReferenceLine key={i} y={m.weight} stroke="#f59e0b" strokeDasharray="2 2" label={{ value: m.label, fontSize: 9, fill: "#f59e0b" }} />
                  ))}
                  <Area type="monotone" dataKey="weight" stroke="#0ea5e9" strokeWidth={2} fill="url(#weightGrad)" dot={{ r: 3, fill: "#0ea5e9" }} name="Weight" />
                  <Line type="monotone" dataKey="ma" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="7-day avg" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waist trend */}
      {data.waistTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waist measurement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.waistTrend}>
                  <defs>
                    <linearGradient id="waistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Healthy <90", fontSize: 10 }} />
                  <Area type="monotone" dataKey="waist" stroke="#8b5cf6" strokeWidth={2} fill="url(#waistGrad)" dot={{ r: 3, fill: "#8b5cf6" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workout heatmap */}
      <WorkoutHeatmap data={data.heatmap} />

      {/* Workouts per week */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workouts per week</CardTitle>
          <p className="text-sm text-muted-foreground">Min 3 to hit goal (red line)</p>
        </CardHeader>
        <CardContent>
          {data.workoutsPerWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Complete workouts to see history.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workoutsPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="3 3" />
                  <Bar dataKey="A" name="Push" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="B" name="Pull" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="C" name="Legs" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout type split */}
      {data.workoutTypes.some((t) => t.value > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workout type split</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.workoutTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.workoutTypes.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StrengthTab({ data }: { data: Analytics }) {
  return (
    <div className="space-y-6">
      {data.topExercises.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Complete workouts to track strength progression.</p>
          </CardContent>
        </Card>
      ) : (
        data.topExercises.map((ex, idx) => (
          <Card key={ex.name}>
            <CardHeader>
              <CardTitle className="text-base">{ex.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{ex.data.length} sessions logged</p>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ex.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="kg" />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                    <Line type="monotone" dataKey="weight" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function FitbitSyncInline({ onSynced }: { onSynced: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/fitbit/sync", { method: "POST" });
      const d = await res.json();
      setMsg(d.message ?? d.error ?? "Done");
      if (res.ok && d.synced > 0) {
        setTimeout(onSynced, 500);
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button onClick={sync} disabled={loading} variant="outline" size="sm">
        {loading ? "Syncing…" : "Sync Fitbit now"}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

function FitbitTab({ data: initialData, onRefresh }: { data: Analytics; onRefresh: () => void }) {
  const data = initialData;

  if (!data.fitbitLinked) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">Fitbit not linked. Connect in Settings to see heart rate, sleep, and activity data.</p>
          <a href="/dashboard/settings" className="text-primary underline text-sm">Go to Settings</a>
        </CardContent>
      </Card>
    );
  }

  if (data.fitbitTrend.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">No Fitbit data yet. Sync now or wait for the daily automatic sync.</p>
          <FitbitSyncInline onSynced={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  const hasHr = data.fitbitTrend.some((d) => d.restingHr != null);
  const hasSteps = data.fitbitTrend.some((d) => d.steps != null);
  const hasSleep = data.fitbitTrend.some((d) => d.sleepMins != null);
  const hasActive = data.fitbitTrend.some((d) => d.activeMinutes != null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FitbitSyncInline onSynced={onRefresh} />
      </div>
      {hasHr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resting heart rate</CardTitle>
            <p className="text-sm text-muted-foreground">Lower is better as fitness improves</p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.fitbitTrend.filter((d) => d.restingHr != null)}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10 }} unit="bpm" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Area type="monotone" dataKey="restingHr" stroke="#ef4444" strokeWidth={2} fill="url(#hrGrad)" name="Resting HR" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {hasSteps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.fitbitTrend.filter((d) => d.steps != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="steps" fill="#10b981" radius={[4, 4, 0, 0]} name="Steps" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {hasSleep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sleep duration</CardTitle>
            <p className="text-sm text-muted-foreground">Hours per night</p>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.fitbitTrend.filter((d) => d.sleepMins != null).map((d) => ({ ...d, sleepHours: Math.round((d.sleepMins ?? 0) / 6) / 10 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="h" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <ReferenceLine y={7} stroke="#f59e0b" strokeDasharray="3 3" />
                  <Bar dataKey="sleepHours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Sleep" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {hasActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active minutes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.fitbitTrend.filter((d) => d.activeMinutes != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="m" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Bar dataKey="activeMinutes" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Active min" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

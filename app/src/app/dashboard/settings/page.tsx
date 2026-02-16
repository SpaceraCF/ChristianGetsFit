"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fitbitMsg, setFitbitMsg] = useState<string | null>(null);

  useEffect(() => {
    const fitbit = searchParams.get("fitbit");
    if (fitbit === "ok") setFitbitMsg("Fitbit linked.");
    if (fitbit === "error") setFitbitMsg("Fitbit link failed.");
  }, [searchParams]);

  async function handleLinkTelegram() {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (data.code) setLinkCode(data.code);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telegram</CardTitle>
          <p className="text-sm text-muted-foreground">
            Link your Telegram to get reminders and use /status, /done, /weight from the bot.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {linkCode ? (
            <p className="text-sm font-mono bg-muted p-3 rounded">
              In Telegram, send: <strong>/link {linkCode}</strong>
            </p>
          ) : (
            <Button onClick={handleLinkTelegram} disabled={loading}>
              {loading ? "Generating…" : "Link Telegram"}
            </Button>
          )}
        </CardContent>
      </Card>

      {fitbitMsg && <p className="text-sm text-muted-foreground">{fitbitMsg}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cal.com (calendar)</CardTitle>
          <p className="text-sm text-muted-foreground">
            5 workouts are planned per week (min 3 to hit goal). Add them to your calendar between 11am–4pm AEDT.
          </p>
        </CardHeader>
        <CardContent>
          <CalComScheduleButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fitbit</CardTitle>
          <p className="text-sm text-muted-foreground">
            Link Fitbit to verify workouts with heart rate and use rest-day suggestions.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/fitbit/auth">Link Fitbit</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Injuries / pain</CardTitle>
          <p className="text-sm text-muted-foreground">
            If something hurts, log it here. Workouts will skip or substitute exercises for that area until you mark it resolved.
          </p>
        </CardHeader>
        <CardContent>
          <InjuryForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Height and weight goals are set from the plan (172cm, 82kg → 75kg). Edit in database or add a profile form later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto p-6">Loading…</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function CalComScheduleButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function schedule() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calcom/schedule-week", { method: "POST" });
      const data = await res.json();
      if (data.created != null)
        setMessage(data.message ?? `Created ${data.created}/5 slots.`);
      else setMessage(data.error ?? "Failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button onClick={schedule} disabled={loading}>
        {loading ? "Scheduling…" : "Schedule this week's 5 workouts"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function InjuryForm() {
  const [area, setArea] = useState("");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Array<{ id: string; bodyArea: string; severity: string }>>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/injuries");
    if (res.ok) {
      const data = await res.json();
      setList(data);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!area || !severity) return;
    setLoading(true);
    try {
      await fetch("/api/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyArea: area, severity }),
      });
      setArea("");
      setSeverity("");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function resolve(id: string) {
    await fetch(`/api/injuries/${id}/resolve`, { method: "POST" });
    load();
  }

  const areas = ["shoulder", "back", "knee", "wrist", "elbow", "hip", "neck", "other"];
  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Area</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Severity</option>
          <option value="mild">Mild</option>
          <option value="moderate">Moderate</option>
          <option value="bad">Bad</option>
        </select>
        <Button type="submit" size="sm" disabled={loading || !area || !severity}>
          Log
        </Button>
      </form>
      {list.length > 0 && (
        <ul className="text-sm space-y-1">
          {list.map((i) => (
            <li key={i.id} className="flex justify-between items-center">
              <span>{i.bodyArea} ({i.severity})</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => resolve(i.id)}>
                Resolved
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

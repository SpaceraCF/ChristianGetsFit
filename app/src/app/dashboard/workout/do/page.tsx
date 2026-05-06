"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WarmUpItem = { id: string; name: string; instructions: string | null; orderInWorkout: number | null; videoUrl: string | null };
type ExerciseItem = {
  id: string;
  name: string;
  equipment: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSecs: number;
  recommendedWeightKg: number;
  orderInWorkout: number;
  videoUrl: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function getYouTubeEmbedId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function VideoEmbed({ videoUrl, name }: { videoUrl: string | null; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const embedId = videoUrl ? getYouTubeEmbedId(videoUrl) : null;

  if (embedId) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-primary underline"
        >
          {expanded ? "Hide video" : "Watch how to do this"}
        </button>
        {expanded && (
          <div className="relative w-full pb-[56.25%] rounded-lg overflow-hidden bg-black">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${embedId}?rel=0`}
              title={`How to: ${name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={videoUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " form")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary underline"
    >
      {videoUrl ? "Watch how (YouTube)" : "Search YouTube for form"}
    </a>
  );
}

function DoWorkoutPageInner() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") ?? "A";
  const express = searchParams.get("express") === "true";

  const [warmUp, setWarmUp] = useState<WarmUpItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Crash-recovery: workoutId is the in-progress Workout row this session
  // is writing to. Persists across exercises.
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const startedRef = useRef(false);

  const [phase, setPhase] = useState<"warmup" | "exercise" | "feedback" | "done">("warmup");
  const [warmUpCountdown, setWarmUpCountdown] = useState<number | null>(null);
  const [warmUpIndex, setWarmUpIndex] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [restSecsLeft, setRestSecsLeft] = useState(0);
  const [setsDone, setSetsDone] = useState(0);
  const [repsThisSet, setRepsThisSet] = useState<number[]>([]);
  const [weightUsed, setWeightUsed] = useState(0);
  const [difficulty, setDifficulty] = useState<"too_light" | "just_right" | "too_heavy" | null>(null);
  const [enjoyed, setEnjoyed] = useState<boolean | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitting, setSubmitting] = useState(false);

  const fetchWorkout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workout/next?type=${type}&express=${express}`);
      if (!res.ok) throw new Error("Failed to load workout");
      const data = await res.json();
      setWarmUp(data.warmUp ?? []);
      setExercises(data.exercises ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [type, express]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  // Once exercises load, start (or resume) the workout. Skips the warm-up
  // automatically if we're resuming a workout that was already underway.
  useEffect(() => {
    if (loading || exercises.length === 0 || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/workout/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workoutType: type, isExpress: express }),
        });
        if (!res.ok) throw new Error("Failed to start workout");
        const data = await res.json();
        setWorkoutId(data.workoutId);
        setResumed(!!data.resumed);
        const alreadyLogged: string[] = data.alreadyLogged ?? [];
        if (alreadyLogged.length > 0) {
          // Find the index of the first un-logged exercise so we resume there.
          const firstPending = exercises.findIndex((e) => !alreadyLogged.includes(e.id));
          const resumeAt = firstPending === -1 ? exercises.length - 1 : firstPending;
          setExerciseIndex(resumeAt);
          setPhase("exercise"); // skip warm-up on resume
        }
      } catch (e) {
        console.error("workout/start failed", e);
        // Continue without crash recovery — the legacy /complete fallback at end will still try to save.
      }
    })();
  }, [loading, exercises, type, express]);

  useEffect(() => {
    if (phase !== "exercise" || exercises.length === 0) return;
    const ex = exercises[exerciseIndex];
    if (!ex) return;
    setWeightUsed(ex.recommendedWeightKg);
    setRestSecsLeft(ex.restSecs);
    setSetsDone(0);
    setRepsThisSet([]);
  }, [phase, exerciseIndex, exercises]);

  useEffect(() => {
    if (phase !== "exercise" || restSecsLeft <= 0) return;
    const t = setInterval(() => setRestSecsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, restSecsLeft]);

  // Warm-up countdown
  useEffect(() => {
    if (warmUpCountdown === null) return;
    if (warmUpCountdown <= 0) {
      setWarmUpCountdown(null);
      if (warmUpIndex >= warmUp.length - 1) setPhase("exercise");
      else setWarmUpIndex((i) => i + 1);
      return;
    }
    const id = setInterval(() => {
      setWarmUpCountdown((c) => {
        if (c == null || c <= 0) return null;
        const next = c - 1;
        if (next <= 3 && next >= 1) playBeep();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [warmUpCountdown, warmUpIndex, warmUp.length]);

  // Screen wake lock during workout
  useEffect(() => {
    if (phase !== "warmup" && phase !== "exercise") return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) {
        try {
          wakeLock = await nav.wakeLock.request("screen");
        } catch {
          // ignore
        }
      }
    };
    request();
    return () => {
      wakeLock?.release?.().catch(() => {});
    };
  }, [phase]);

  const currentWarmUp = warmUp[warmUpIndex];
  const currentExercise = exercises[exerciseIndex];

  const handleSkipWarmUp = () => {
    if (warmUp.length === 0) setPhase("exercise");
    else if (warmUpIndex >= warmUp.length - 1) setPhase("exercise");
    else setWarmUpIndex((i) => i + 1);
  };

  function playBeep() {
    try {
      const C = typeof window !== "undefined" ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext : null;
      if (!C) return;
      const ctx = new C();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }

  const handleNextWarmUp = () => {
    setWarmUpCountdown(5);
  };

  const handleCompleteSet = () => {
    if (!currentExercise) return;
    // Capture reps for this set. Default to repsMin in the middle of the
    // recommended range so the rep cap can fire when the user hits it.
    const repsForSet = Math.round((currentExercise.repsMin + currentExercise.repsMax) / 2);
    const newReps = [...repsThisSet, repsForSet];
    setRepsThisSet(newReps);
    const nextSets = setsDone + 1;
    setSetsDone(nextSets);
    if (nextSets >= currentExercise.sets) {
      setPhase("feedback");
    } else {
      setRestSecsLeft(currentExercise.restSecs);
    }
  };

  /** Persist this exercise's results to the server. Idempotent on retry. */
  const saveExerciseLog = useCallback(
    async (payload: {
      exerciseId: string;
      weightKg: number;
      setsCompleted: number;
      repsCompleted: number[];
      difficultyFeedback: "too_light" | "just_right" | "too_heavy";
      enjoyed: boolean;
    }): Promise<boolean> => {
      if (!workoutId) return false;
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/workout/exercise-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workoutId, ...payload }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStatus("saved");
        return true;
      } catch (e) {
        console.error("exercise-log failed", e);
        setSaveStatus("error");
        return false;
      }
    },
    [workoutId]
  );

  const handleFeedbackSubmit = async () => {
    if (difficulty === null || enjoyed === null || !currentExercise) return;
    const repsCompleted = repsThisSet.length === currentExercise.sets
      ? repsThisSet
      : Array(currentExercise.sets).fill(Math.round((currentExercise.repsMin + currentExercise.repsMax) / 2));
    const payload = {
      exerciseId: currentExercise.id,
      weightKg: weightUsed,
      setsCompleted: currentExercise.sets,
      repsCompleted,
      difficultyFeedback: difficulty,
      enjoyed,
    };

    // Persist NOW so a crash here doesn't lose the exercise.
    const ok = await saveExerciseLog(payload);
    if (!ok) {
      // Leave UI in error state with a retry button instead of advancing.
      return;
    }

    setDifficulty(null);
    setEnjoyed(null);

    if (exerciseIndex >= exercises.length - 1) {
      // Final exercise — finalize the workout.
      setSubmitting(true);
      try {
        if (workoutId) {
          await fetch("/api/workout/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workoutId }),
          });
        }
      } catch (e) {
        console.error("complete failed", e);
      }
      setSubmitting(false);
      setPhase("done");
    } else {
      setExerciseIndex((i) => i + 1);
      setPhase("exercise");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading workout…</p>
      </div>
    );
  }
  if (error || exercises.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? "No exercises found."}</p>
        <Button asChild><Link href="/dashboard/workout">Back</Link></Button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center py-8">
        <h2 className="text-2xl font-bold">Workout complete!</h2>
        <p className="text-muted-foreground">You crushed it. That counts toward your 3/week.</p>
        <Button asChild size="lg">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (phase === "warmup" && warmUpCountdown !== null) {
    return (
      <div className="max-w-lg mx-auto space-y-6 flex flex-col items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Next in</p>
        <p className="text-6xl font-mono font-bold tabular-nums">{warmUpCountdown}</p>
      </div>
    );
  }

  if (phase === "warmup" && currentWarmUp) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        {resumed && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Resuming an in-progress workout. Pick up where you left off.
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          Warm-up {warmUpIndex + 1} of {warmUp.length}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{currentWarmUp.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentWarmUp.instructions && (
              <p className="text-sm text-muted-foreground">{currentWarmUp.instructions}</p>
            )}
            <VideoEmbed videoUrl={currentWarmUp.videoUrl} name={currentWarmUp.name} />
            <div className="flex gap-2">
              <Button onClick={handleNextWarmUp} className="flex-1">
                Done
              </Button>
              <Button variant="outline" onClick={handleSkipWarmUp}>
                Skip warm-up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "feedback" && currentExercise) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h3 className="text-lg font-semibold">How was {weightUsed}kg for {currentExercise.name}?</h3>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {(["too_heavy", "just_right", "too_light"] as const).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? "default" : "outline"}
                onClick={() => setDifficulty(d)}
              >
                {d === "too_heavy" ? "Too heavy" : d === "just_right" ? "Just right" : "Too light"}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground pt-2">Enjoy this exercise?</p>
          <div className="flex gap-2">
            <Button
              variant={enjoyed === false ? "destructive" : "outline"}
              onClick={() => setEnjoyed(false)}
            >
              Don&apos;t show again
            </Button>
            <Button variant={enjoyed === true ? "default" : "outline"} onClick={() => setEnjoyed(true)}>
              Keep it
            </Button>
          </div>
          <Button
            className="w-full mt-4"
            disabled={difficulty === null || enjoyed === null || submitting || saveStatus === "saving"}
            onClick={handleFeedbackSubmit}
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "error"
              ? "Retry save"
              : exerciseIndex >= exercises.length - 1
              ? "Finish workout"
              : "Next exercise"}
          </Button>
          {saveStatus === "error" && (
            <p className="text-sm text-destructive">Couldn&apos;t reach the server. Tap Retry — your reps and feedback are still here.</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "exercise" && currentExercise) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        {resumed && exerciseIndex > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Resumed from a previous session. {exerciseIndex} {exerciseIndex === 1 ? "exercise" : "exercises"} already saved.
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          Exercise {exerciseIndex + 1} of {exercises.length}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{currentExercise.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Recommended: {currentExercise.recommendedWeightKg}kg · Sets: {currentExercise.sets} × {currentExercise.repsMin}
              –{currentExercise.repsMax} reps
            </p>
            <VideoEmbed videoUrl={currentExercise.videoUrl} name={currentExercise.name} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm">Weight (kg)</label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-lg"
                  onClick={() => setWeightUsed((w) => Math.max(0, w - (currentExercise.equipment === "smith_machine" ? 2.5 : 1)))}
                >
                  −
                </button>
                <span className="w-12 text-center font-medium">{weightUsed}</span>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-lg"
                  onClick={() => setWeightUsed((w) => w + (currentExercise.equipment === "smith_machine" ? 2.5 : 1))}
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-sm">
              Sets completed: {setsDone} / {currentExercise.sets}
            </p>
            {restSecsLeft > 0 ? (
              <p className="text-lg font-mono">Rest: {restSecsLeft}s</p>
            ) : (
              <Button className="w-full" size="lg" onClick={handleCompleteSet}>
                Complete set
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <Button asChild><Link href="/dashboard/workout">Back</Link></Button>
    </div>
  );
}

export default function DoWorkoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading…</p></div>}>
      <DoWorkoutPageInner />
    </Suspense>
  );
}

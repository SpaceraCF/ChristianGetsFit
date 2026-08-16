export type WorkoutType = "A" | "B" | "C";
export type DifficultyFeedback = "too_light" | "just_right" | "too_heavy";

export const WORKOUTS_PER_TRAINING_WEEK = 3;
export const TRAINING_WEEKS_PER_BLOCK = 4;
export const SESSIONS_PER_BLOCK =
  WORKOUTS_PER_TRAINING_WEEK * TRAINING_WEEKS_PER_BLOCK;
export const PROGRAM_BLOCK_COUNT = 3;

export const WORKOUT_LABELS: Record<
  WorkoutType,
  { name: string; focus: string }
> = {
  A: { name: "Full Body A", focus: "Squat, push, pull, hinge and core" },
  B: { name: "Full Body B", focus: "Legs, shoulders, back, glutes and core" },
  C: { name: "Full Body C", focus: "Single-leg work, push, pull, hinge and core" },
};

export const PROGRAM_BLOCKS = [
  {
    id: 1,
    name: "Foundation",
    description: "Learn repeatable technique with stable Smith and dumbbell movements.",
  },
  {
    id: 2,
    name: "Control",
    description: "Use supported and single-leg variations without chasing maximal loads.",
  },
  {
    id: 3,
    name: "Build",
    description: "Return to familiar patterns with fresh variations and a stronger baseline.",
  },
] as const;

export const TRAINING_WEEKS = [
  {
    week: 1,
    name: "Technique",
    description: "Light practice. Finish each set with about four good reps available.",
    targetRir: 4,
    sets: 2,
    loadStepsFromPeak: -3,
  },
  {
    week: 2,
    name: "Build",
    description: "Add one available weight step while keeping every rep controlled.",
    targetRir: 3,
    sets: 3,
    loadStepsFromPeak: -2,
  },
  {
    week: 3,
    name: "Progress",
    description: "Add another weight step and stop before technique changes.",
    targetRir: 2,
    sets: 3,
    loadStepsFromPeak: -1,
  },
  {
    week: 4,
    name: "Strong week",
    description: "The heaviest week, not a max test. Keep about two good reps available.",
    targetRir: 2,
    sets: 3,
    loadStepsFromPeak: 0,
  },
] as const;

export type ProgramState = {
  completedSessions: number;
  cycle: number;
  block: number;
  blockName: string;
  blockDescription: string;
  week: number;
  weekName: string;
  weekDescription: string;
  targetRir: number;
  prescribedSets: number;
  sessionInWeek: number;
  sessionInBlock: number;
  sessionsRemainingInBlock: number;
  nextWorkoutType: WorkoutType;
};

export function programStateFromCompletedSessions(
  completedSessions: number,
): ProgramState {
  const safeSessions = Math.max(0, Math.floor(completedSessions));
  const zeroBasedCycle = Math.floor(safeSessions / SESSIONS_PER_BLOCK);
  const sessionOffset = safeSessions % SESSIONS_PER_BLOCK;
  const weekOffset = Math.floor(sessionOffset / WORKOUTS_PER_TRAINING_WEEK);
  const block = (zeroBasedCycle % PROGRAM_BLOCK_COUNT) + 1;
  const blockInfo = PROGRAM_BLOCKS[block - 1];
  const weekInfo = TRAINING_WEEKS[weekOffset];
  const sessionInWeek = (sessionOffset % WORKOUTS_PER_TRAINING_WEEK) + 1;

  return {
    completedSessions: safeSessions,
    cycle: zeroBasedCycle + 1,
    block,
    blockName: blockInfo.name,
    blockDescription: blockInfo.description,
    week: weekInfo.week,
    weekName: weekInfo.name,
    weekDescription: weekInfo.description,
    targetRir: weekInfo.targetRir,
    prescribedSets: weekInfo.sets,
    sessionInWeek,
    sessionInBlock: sessionOffset + 1,
    sessionsRemainingInBlock: SESSIONS_PER_BLOCK - sessionOffset,
    nextWorkoutType: (["A", "B", "C"] as const)[sessionInWeek - 1],
  };
}

export function roundToIncrement(value: number, increment: number) {
  if (increment <= 0) return 0;
  return Math.round(value / increment) * increment;
}

export function recommendedWeightForWeek(input: {
  peakWeightKg: number;
  incrementKg: number;
  week: number;
}) {
  const week = TRAINING_WEEKS[Math.min(4, Math.max(1, input.week)) - 1];
  if (input.incrementKg <= 0 || input.peakWeightKg <= 0) return 0;
  return Math.max(
    input.incrementKg,
    roundToIncrement(
      input.peakWeightKg + week.loadStepsFromPeak * input.incrementKg,
      input.incrementKg,
    ),
  );
}

/**
 * Convert the load actually used in a lighter week back to its week-four
 * equivalent, then move that target only when feedback calls for it.
 */
export function nextPeakWeight(input: {
  performedWeightKg: number;
  incrementKg: number;
  week: number;
  feedback: DifficultyFeedback;
}) {
  if (input.incrementKg <= 0) return 0;
  const week = TRAINING_WEEKS[Math.min(4, Math.max(1, input.week)) - 1];
  const equivalentPeak = roundToIncrement(
    input.performedWeightKg - week.loadStepsFromPeak * input.incrementKg,
    input.incrementKg,
  );
  const feedbackSteps =
    input.feedback === "too_light"
      ? 1
      : input.feedback === "too_heavy"
        ? -1
        : 0;
  return Math.max(
    input.incrementKg,
    equivalentPeak + feedbackSteps * input.incrementKg,
  );
}

import { describe, expect, it } from "vitest";

import {
  nextPeakWeight,
  programStateFromCompletedSessions,
  recommendedWeightForWeek,
} from "./program";

describe("four-week workout program", () => {
  it("advances by completed sessions and changes block after twelve", () => {
    expect(programStateFromCompletedSessions(0)).toMatchObject({
      block: 1,
      week: 1,
      nextWorkoutType: "A",
    });
    expect(programStateFromCompletedSessions(3)).toMatchObject({
      block: 1,
      week: 2,
      nextWorkoutType: "A",
    });
    expect(programStateFromCompletedSessions(11)).toMatchObject({
      block: 1,
      week: 4,
      nextWorkoutType: "C",
    });
    expect(programStateFromCompletedSessions(12)).toMatchObject({
      block: 2,
      week: 1,
      nextWorkoutType: "A",
    });
    expect(programStateFromCompletedSessions(36)).toMatchObject({
      cycle: 4,
      block: 1,
      week: 1,
    });
  });

  it("uses a light-to-heavy equipment-step wave", () => {
    const weights = [1, 2, 3, 4].map((week) =>
      recommendedWeightForWeek({ peakWeightKg: 25, incrementKg: 2.5, week }),
    );
    expect(weights).toEqual([17.5, 20, 22.5, 25]);
  });

  it("recalibrates the peak target from feedback without blind increases", () => {
    expect(
      nextPeakWeight({
        performedWeightKg: 17.5,
        incrementKg: 2.5,
        week: 1,
        feedback: "just_right",
      }),
    ).toBe(25);
    expect(
      nextPeakWeight({
        performedWeightKg: 17.5,
        incrementKg: 2.5,
        week: 1,
        feedback: "too_heavy",
      }),
    ).toBe(22.5);
    expect(
      nextPeakWeight({
        performedWeightKg: 25,
        incrementKg: 2.5,
        week: 4,
        feedback: "too_light",
      }),
    ).toBe(27.5);
  });
});

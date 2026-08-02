import { describe, expect, it } from "vitest";
import { Habit } from "@/store/types";
import {
  describeFrequency,
  isDueOn,
  periodKeyBack,
  periodKeyFor,
  streakOf,
  weekProgress,
} from "@/lib/habits";

// Verified fixture week (2026-07-06 is a Monday):
// Mon 07-06, Tue 07-07, Wed 07-08, Thu 07-09, Fri 07-10, Sat 07-11, Sun 07-12, Mon 07-13, Tue 07-14

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Test",
    createdAt: "2026-07-01T00:00:00.000Z",
    frequency: "daily",
    completions: {},
    ...overrides,
  };
}

describe("isDueOn (weekdays)", () => {
  it("is true only on the chosen ISO weekdays", () => {
    const h = makeHabit({ frequency: "weekdays", weekdays: [2, 4] }); // Tue, Thu
    expect(isDueOn(h, new Date(2026, 6, 6))).toBe(false); // Mon
    expect(isDueOn(h, new Date(2026, 6, 7))).toBe(true); // Tue
    expect(isDueOn(h, new Date(2026, 6, 8))).toBe(false); // Wed
    expect(isDueOn(h, new Date(2026, 6, 9))).toBe(true); // Thu
  });
});

describe("periodKeyFor / periodKeyBack (every_n_days)", () => {
  it("keys by the cycle's start date, anchored to anchorDate", () => {
    const h = makeHabit({ frequency: "every_n_days", intervalDays: 15, anchorDate: "2026-07-01" });
    expect(periodKeyFor(h, new Date(2026, 6, 1))).toBe("2026-07-01");
    expect(periodKeyFor(h, new Date(2026, 6, 15))).toBe("2026-07-01"); // still inside cycle 0
    expect(periodKeyFor(h, new Date(2026, 6, 16))).toBe("2026-07-16"); // cycle 1 begins
  });

  it("walks back N cycles", () => {
    const h = makeHabit({ frequency: "every_n_days", intervalDays: 15, anchorDate: "2026-07-01" });
    expect(periodKeyBack(h, 1, new Date(2026, 6, 16))).toBe("2026-07-01");
  });
});

describe("periodKeyBack (weekdays)", () => {
  it("n=0 is today's own key regardless of due-ness", () => {
    const h = makeHabit({ frequency: "weekdays", weekdays: [2, 4] });
    expect(periodKeyBack(h, 0, new Date(2026, 6, 8))).toBe("2026-07-08"); // Wednesday, not due
  });

  it("n>=1 walks back N DUE days, skipping non-due days entirely", () => {
    const h = makeHabit({ frequency: "weekdays", weekdays: [2, 4] });
    const from = new Date(2026, 6, 14); // Tuesday
    expect(periodKeyBack(h, 1, from)).toBe("2026-07-09"); // previous due day: Thursday
    expect(periodKeyBack(h, 2, from)).toBe("2026-07-07"); // before that: Tuesday
  });
});

describe("streakOf (weekdays)", () => {
  it("counts consecutive completed due-days, unaffected by non-due gaps", () => {
    const h = makeHabit({
      frequency: "weekdays",
      weekdays: [2, 4],
      completions: { "2026-07-07": true, "2026-07-09": true, "2026-07-14": true },
    });
    expect(streakOf(h, new Date(2026, 6, 14))).toBe(3);
  });

  it("breaks on a missed DUE day (not a mere non-due gap)", () => {
    const h = makeHabit({
      frequency: "weekdays",
      weekdays: [2, 4],
      completions: { "2026-07-07": true, "2026-07-14": true }, // 07-09 (Thu) missing
    });
    expect(streakOf(h, new Date(2026, 6, 14))).toBe(1);
  });
});

describe("streakOf / weekProgress (times_per_week)", () => {
  it("treats the current week as in-progress and counts satisfied prior weeks", () => {
    const target = 3;
    const completions: Record<string, boolean> = {
      "2026-06-29": true,
      "2026-06-30": true,
      "2026-07-01": true, // last week: 3 check-ins, meets target
      "2026-07-06": true, // this week so far: only 1 check-in
    };
    const h = makeHabit({ frequency: "times_per_week", timesPerWeek: target, completions });
    const now = new Date(2026, 6, 8); // Wednesday, same week as 07-06
    expect(weekProgress(h, now)).toEqual({ count: 1, target });
    expect(streakOf(h, now)).toBe(1);
  });
});

describe("describeFrequency", () => {
  it("describes the new kinds in plain language", () => {
    expect(describeFrequency({ frequency: "every_n_days", intervalDays: 15 })).toBe("A cada 15 dias");
    expect(describeFrequency({ frequency: "times_per_week", timesPerWeek: 3 })).toBe("3x por semana");
    expect(describeFrequency({ frequency: "weekdays", weekdays: [2, 4, 7] })).toBe("Ter, Qui, Dom");
  });
});

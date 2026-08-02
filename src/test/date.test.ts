import { describe, expect, it } from "vitest";
import { isoWeekday, nextRecurrenceDate } from "@/lib/date";

// Verified fixture week (2026-07-06 is a Monday):
// Mon 07-06, Tue 07-07, Wed 07-08, Thu 07-09, Fri 07-10, Sat 07-11, Sun 07-12, Mon 07-13, Tue 07-14

describe("nextRecurrenceDate", () => {
  it("advances by one day for daily", () => {
    expect(nextRecurrenceDate("2026-07-10", "daily")).toBe("2026-07-11");
  });

  it("advances by seven days for weekly", () => {
    expect(nextRecurrenceDate("2026-07-10", "weekly")).toBe("2026-07-17");
  });

  it("clamps to the last day of the target month", () => {
    expect(nextRecurrenceDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("advances by the configured interval for every_n_days", () => {
    expect(nextRecurrenceDate("2026-07-01", "every_n_days", { intervalDays: 15 })).toBe("2026-07-16");
  });

  it("finds the next chosen weekday within the same week", () => {
    // Mon 07-06 -> next Tue/Thu is Tue 07-07
    expect(nextRecurrenceDate("2026-07-06", "weekdays", { weekdays: [2, 4] })).toBe("2026-07-07");
  });

  it("wraps into the following week when no chosen weekday remains", () => {
    // Thu 07-09 -> next Tue/Thu is Tue 07-14 (wraps past the weekend)
    expect(nextRecurrenceDate("2026-07-09", "weekdays", { weekdays: [2, 4] })).toBe("2026-07-14");
  });
});

describe("isoWeekday", () => {
  it("maps Sunday to 7 and Monday to 1 (ISO, not JS's 0-indexed Sunday)", () => {
    expect(isoWeekday(new Date(2026, 6, 6))).toBe(1); // Monday
    expect(isoWeekday(new Date(2026, 6, 12))).toBe(7); // Sunday
  });
});

import { expect, it } from "vitest";
import { dailySeries } from "../src/web/stats-chart";

it("keeps one recorded day in a full 30-day window and combines sources", () => {
  const days = dailySeries(
    [
      { day: "2026-10-17", clicks: 1 },
      { day: "2026-10-17", clicks: 1 },
    ],
    "2026-09-18",
  );
  expect(days).toHaveLength(30);
  expect(days[0]).toEqual(["2026-09-18", 0]);
  expect(days[29]).toEqual(["2026-10-17", 2]);
  expect(days.filter(([, n]) => n > 0)).toHaveLength(1);
  expect(days.reduce((sum, [, n]) => sum + n, 0)).toBe(2);
});

it("retains missing days between sparse records, including a year boundary", () => {
  const days = dailySeries(
    [
      { day: "2027-01-02", clicks: 5 },
      { day: "2026-12-30", clicks: 3 },
    ],
    "2026-12-15",
  );
  expect(days[15]).toEqual(["2026-12-30", 3]);
  expect(days[16]).toEqual(["2026-12-31", 0]);
  expect(days[17]).toEqual(["2027-01-01", 0]);
  expect(days[18]).toEqual(["2027-01-02", 5]);
  expect(days[29][0]).toBe("2027-01-13");
});

it("keeps an empty period at zero and handles leap days", () => {
  const days = dailySeries([], "2028-02-01");
  expect(days[28]).toEqual(["2028-02-29", 0]);
  expect(days[29]).toEqual(["2028-03-01", 0]);
  expect(days.every(([, n]) => n === 0)).toBe(true);
});

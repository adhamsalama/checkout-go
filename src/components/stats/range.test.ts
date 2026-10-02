import { describe, expect, it } from "vitest";
import { bucketFor, comparisonRange, initialRange, resolveRange, stepRange, weekdayCounts } from "./range";

const at = (preset: Parameters<typeof initialRange>[0], anchor: string) => ({
  ...initialRange(preset),
  anchor,
});

describe("stats range", () => {
  it("resolves presets to calendar periods", () => {
    expect(resolveRange(at("month", "2026-02-14"))).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolveRange(at("3m", "2026-02-14"))).toMatchObject({ from: "2025-12-01", to: "2026-02-28" });
    expect(resolveRange(at("year", "2026-02-14"))).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(resolveRange(at("all", "2026-02-14"))).toEqual({ label: "All time" });
  });

  it("steps by the period length", () => {
    expect(resolveRange(stepRange(at("month", "2026-03-31"), -1))).toMatchObject({ from: "2026-02-01" });
    expect(resolveRange(stepRange(at("3m", "2026-02-14"), 1))).toMatchObject({ from: "2026-03-01", to: "2026-05-31" });
    const custom = { ...initialRange("custom"), from: "2026-03-01", to: "2026-03-10" };
    expect(stepRange(custom, -1)).toMatchObject({ from: "2026-02-19", to: "2026-02-28" });
  });

  it("compares a running period with the same elapsed days before it", () => {
    expect(comparisonRange(at("month", "2026-10-02"), "2026-10-02")).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-02",
    });
    // A finished period compares with the whole previous one.
    expect(comparisonRange(at("month", "2026-09-10"), "2026-10-02")).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    // March 31st so far vs February: capped at February's end.
    expect(comparisonRange(at("month", "2026-03-31"), "2026-03-31")).toMatchObject({ to: "2026-02-28" });
    expect(comparisonRange(at("all", "2026-10-02"), "2026-10-02")).toBeNull();
  });

  it("picks a bucket size and counts weekdays", () => {
    expect(bucketFor("2026-02-01", "2026-02-28")).toBe("day");
    expect(bucketFor("2026-01-01", "2026-03-31")).toBe("week");
    expect(bucketFor("2026-01-01", "2026-12-31")).toBe("month");
    expect(bucketFor("2020-01-01", "2026-12-31")).toBe("year");
    // 2026-02-02 is a Monday; nine days cover Mon and Tue twice.
    expect(weekdayCounts("2026-02-02", "2026-02-10")).toEqual([2, 2, 1, 1, 1, 1, 1]);
  });
});

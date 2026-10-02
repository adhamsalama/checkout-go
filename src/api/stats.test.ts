import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import * as tx from "./transactions";
import * as stats from "./stats";

beforeEach(async () => {
  setDb(createNodeDb());
  // 2025-02-03 is a Monday.
  await tx.createExpense({ name: "Coffee", price: 4, tags: ["food"], date: "2025-02-03T08:00:00" });
  await tx.createExpense({ name: "coffee ", price: 6, tags: ["food", "work"], date: "2025-02-03T15:00:00" });
  await tx.createExpense({ name: "Lunch", price: 20, tags: ["work", "food"], date: "2025-02-05", comment: "team" });
  await tx.createExpense({ name: "Cinema", price: 15, tags: ["fun"], date: "2025-02-16", sellerName: "Odeon" });
  await tx.createExpense({ name: "Rent", price: 500, tags: [], date: "2025-03-01" });
  await tx.createPayment({ name: "Salary", price: 1000, date: "2025-02-01" });
});

const FEB = { from: "2025-02-01", to: "2025-02-28" };

describe("stats", () => {
  it("summarizes a range", async () => {
    expect(await stats.getStatsSummary(FEB)).toEqual({
      spent: 45,
      count: 4,
      activeDays: 3,
      firstDay: "2025-02-03",
      biggestDay: { day: "2025-02-05", spent: 20 },
      income: 1000,
    });
    // The last day of the range is included.
    expect((await stats.getStatsSummary({ from: "2025-02-16", to: "2025-02-16" })).spent).toBe(15);
    expect(await stats.getStatsSummary({ from: "2024-01-01", to: "2024-01-31" })).toMatchObject({
      spent: 0,
      count: 0,
      firstDay: null,
      biggestDay: null,
    });
  });

  it("filters by name, seller or comment, and by all given tags", async () => {
    expect((await stats.getStatsSummary({ query: "COFFEE" })).count).toBe(2);
    expect((await stats.getStatsSummary({ query: "odeon" })).spent).toBe(15);
    expect((await stats.getStatsSummary({ query: "team" })).spent).toBe(20);
    expect((await stats.getStatsSummary({ tags: ["food", "work"] })).spent).toBe(26);
    expect((await stats.getStatsSummary({ tags: ["food"], query: "lunch" })).spent).toBe(20);
    // Income ignores the search and tag filter.
    expect((await stats.getStatsSummary({ ...FEB, query: "coffee" })).income).toBe(1000);
  });

  it("buckets spending and fills gaps", async () => {
    const weeks = await stats.getSpendingSeries(FEB, "week");
    expect(weeks.map((w) => w.start)).toEqual(["2025-01-27", "2025-02-03", "2025-02-10", "2025-02-17", "2025-02-24"]);
    expect(weeks.map((w) => w.spent)).toEqual([0, 30, 15, 0, 0]);

    const days = await stats.getSpendingSeries(FEB, "day");
    expect(days).toHaveLength(28);
    expect(days[2]).toEqual({ start: "2025-02-03", spent: 10, count: 2 });

    const months = await stats.getSpendingSeries({ from: "2025-01-15", to: "2025-03-31" }, "month");
    expect(months.map((m) => [m.start, m.spent])).toEqual([
      ["2025-01-01", 0],
      ["2025-02-01", 45],
      ["2025-03-01", 500],
    ]);
    expect(await stats.getSpendingSeries({ from: "2024-06-01", to: "2025-12-31" }, "year")).toEqual([
      { start: "2024-01-01", spent: 0, count: 0 },
      { start: "2025-01-01", spent: 545, count: 5 },
    ]);
  });

  it("totals spending per weekday, Monday first", async () => {
    // Mon 3rd: 10, Wed 5th: 20, Sun 16th: 15.
    expect(await stats.getWeekdaySpending(FEB)).toEqual([10, 0, 20, 0, 0, 0, 15]);
  });

  it("groups by exact tag set, or counts under each tag", async () => {
    expect(await stats.getTagSpending({})).toEqual([
      { tags: [], spent: 500, count: 1 },
      // ["food", "work"] and ["work", "food"] are the same set.
      { tags: ["food", "work"], spent: 26, count: 2 },
      { tags: ["fun"], spent: 15, count: 1 },
      { tags: ["food"], spent: 4, count: 1 },
    ]);
    expect(await stats.getTagSpending({}, true)).toEqual([
      { tags: [], spent: 500, count: 1 },
      { tags: ["food"], spent: 30, count: 3 },
      { tags: ["work"], spent: 26, count: 2 },
      { tags: ["fun"], spent: 15, count: 1 },
    ]);
    expect(await stats.getTagSpending({ ...FEB, tags: ["work"] }, true)).toEqual([
      { tags: ["food"], spent: 26, count: 2 },
      { tags: ["work"], spent: 26, count: 2 },
    ]);
  });

  it("ranks names by frequency, ignoring case and spaces", async () => {
    expect(await stats.getTopNames(FEB, 2)).toEqual([
      { name: "Coffee", spent: 10, count: 2 },
      { name: "Lunch", spent: 20, count: 1 },
    ]);
  });

  it("pages expenses by amount", async () => {
    const names = async (page: { limit?: number; offset?: number }) =>
      (await stats.listLargestExpenses(FEB, page)).map((e) => e.name);
    expect(await names({})).toEqual(["Lunch", "Cinema", "coffee ", "Coffee"]);
    expect(await names({ limit: 2, offset: 2 })).toEqual(["coffee ", "Coffee"]);
  });

  it("finds bucket boundaries", () => {
    expect(stats.bucketStart("2025-02-16", "week")).toBe("2025-02-10");
    expect(stats.bucketStart("2025-02-10", "week")).toBe("2025-02-10");
    expect(stats.bucketStart("2025-02-16", "month")).toBe("2025-02-01");
    expect(stats.nextBucket("2025-01-01", "month")).toBe("2025-02-01");
    expect(stats.nextBucket("2025-02-24", "week")).toBe("2025-03-03");
  });
});

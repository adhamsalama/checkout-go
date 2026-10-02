import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import * as tx from "./transactions";
import * as budgets from "./budgets";

beforeEach(() => setDb(createNodeDb()));

describe("transactions", () => {
  it("stores expenses negative and payments positive", async () => {
    const e = await tx.createExpense({ name: "Coffee", price: 30, tags: [" food ", ""], date: "2025-03-04" });
    expect(e).toMatchObject({ price: -30, tags: ["food"], date: "2025-03-04T00:00:00" });
    const p = await tx.createPayment({ name: "Salary", price: 1000, date: "2025-03-01" });
    expect(p.price).toBe(1000);
    await expect(tx.createPayment({ name: "x", price: 0 })).rejects.toThrow();
    expect(await tx.getBalance()).toBe(970);
    expect((await tx.listExpenses()).map((t) => t.name)).toEqual(["Coffee"]);
    expect((await tx.listPayments()).map((t) => t.name)).toEqual(["Salary"]);
  });

  it("updates all fields and validates sign", async () => {
    const e = await tx.createExpense({ name: "a", price: 5, date: "2025-01-01" });
    const u = await tx.updateExpense(e.id, { name: "b", price: -7, sellerName: "s", comment: "c", tags: ["x"], date: "2025-02-02" });
    expect(u).toMatchObject({ name: "b", price: -7, sellerName: "s", comment: "c", tags: ["x"], date: "2025-02-02T00:00:00" });
    await expect(tx.updateExpense(e.id, { price: 3 })).rejects.toThrow();
    await expect(tx.updateExpense(999, { name: "z" })).rejects.toThrow("not found");
    expect(await tx.deleteTransaction(e.id)).toMatchObject({ id: e.id });
    expect(await tx.getTransaction(e.id)).toBeNull();
  });

  it("filters expenses", async () => {
    await tx.createExpense({ name: "Groceries", price: 100, tags: ["food"], date: "2025-05-01T10:00:00" });
    await tx.createExpense({ name: "Taxi", price: 20, tags: ["transport"], date: "2025-05-03T23:30:00" });
    await tx.createExpense({ name: "Dinner", price: 60, tags: ["food", "fun"], date: "2025-05-04" });
    const names = async (f: tx.ExpenseFilters) => (await tx.listExpenses(f)).map((t) => t.name);
    expect(await names({})).toEqual(["Dinner", "Taxi", "Groceries"]);
    expect(await names({ name: "tax" })).toEqual(["Taxi"]);
    expect(await names({ tags: ["fun", "transport"] })).toEqual(["Dinner", "Taxi"]);
    expect(await names({ minAmount: 50, maxAmount: 80 })).toEqual(["Dinner"]);
    // End date is inclusive of the whole day.
    expect(await names({ startDate: new Date(2025, 4, 2), endDate: new Date(2025, 4, 3) })).toEqual(["Taxi"]);
    expect(await names({ limit: 1, offset: 1 })).toEqual(["Taxi"]);
  });

  it("computes statistics", async () => {
    await tx.createExpense({ name: "a", price: 10, tags: ["food"], date: "2025-02-03" });
    await tx.createExpense({ name: "b", price: 30, tags: ["food", "fun"], date: "2025-02-03" });
    await tx.createExpense({ name: "c", price: 5, tags: ["fun"], date: "2025-04-28" });
    await tx.createPayment({ name: "salary", price: 100, date: "2025-02-01" });

    const months = await tx.getMonthlyExpenseStats(2025);
    expect(months).toHaveLength(12);
    expect(months[1]).toMatchObject({ month: 2, count: 2, sum: -40 });
    expect(months[2]).toMatchObject({ month: 3, count: 0, sum: 0 });
    expect(months[3]).toMatchObject({ month: 4, sum: -5 });

    const days = await tx.getDailyExpenseStats(2025, 2);
    expect(days).toHaveLength(28);
    expect(days[2]).toMatchObject({ day: 3, count: 2, sum: -40 });

    expect(await tx.getTagsStatistics()).toMatchObject([
      { tag: "food", count: 2, sum: -40 },
      { tag: "fun", count: 2, sum: -35 },
    ]);
    expect(await tx.getCurrentMonthExpensesSum(new Date(2025, 1, 15))).toBe(-40);
    expect(await tx.getIncomeSpentPercentage()).toEqual([
      { month: "2025-02", total_income: 100, total_spent: 40, spent_percentage: 40 },
      { month: "2025-04", total_income: 0, total_spent: 5, spent_percentage: 0 },
    ]);
    expect(await tx.getCumulativeBalancePerMonth()).toEqual([
      { year_month: "2025-02", cumulative_balance: 60 },
      { year_month: "2025-04", cumulative_balance: 55 },
    ]);
  });
});

describe("budgets", () => {
  it("keeps a single monthly budget", async () => {
    expect(await budgets.getMonthlyBudget()).toBeNull();
    await budgets.saveMonthlyBudget({ name: "Month", value: 500 });
    const b = await budgets.saveMonthlyBudget({ name: "Month 2", value: 600 });
    expect(b).toMatchObject({ name: "Month 2", value: 600 });
    await budgets.deleteMonthlyBudget();
    expect(await budgets.getMonthlyBudget()).toBeNull();
  });

  it("reports this month's spend per tagged budget", async () => {
    const food = await budgets.createTaggedBudget({ name: "Food", value: 200, tag: "food" });
    await budgets.createTaggedBudget({ name: "Fun", value: 50, tag: "fun" });
    await tx.createExpense({ name: "a", price: 40, tags: ["food"], date: "2025-06-10" });
    await tx.createExpense({ name: "b", price: 15, tags: ["food", "x"], date: "2025-06-11" });
    await tx.createExpense({ name: "old", price: 99, tags: ["food"], date: "2025-05-31" });
    expect(await budgets.getTaggedBudgetStats(new Date(2025, 5, 20))).toMatchObject([
      { id: food.id, tag: "food", totalPrice: -55 },
      { tag: "fun", totalPrice: 0 },
    ]);
    await expect(budgets.createTaggedBudget({ name: "x", value: 1, tag: " " })).rejects.toThrow();
  });
});

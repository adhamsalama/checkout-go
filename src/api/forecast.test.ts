import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import { createAccount } from "./accounts";
import { getBalanceForecast, shiftMonth } from "./forecast";
import * as tx from "./transactions";
import { createTransfer } from "./transfers";

const TODAY = "2025-05-10";

beforeEach(() => {
  setDb(createNodeDb());
});

async function seed() {
  const cash = await createAccount({ name: "Cash", openingBalance: 100 });
  await tx.createPayment({ name: "Salary", price: 1000, date: "2025-02-01" });
  await tx.createExpense({ name: "Rent", price: 400, date: "2025-02-10" });
  // Nothing in March.
  await tx.createPayment({ name: "Salary", price: 1000, date: "2025-04-01" });
  await tx.createExpense({ name: "Rent", price: 700, date: "2025-04-10" });
  await tx.createExpense({ name: "Coffee", price: 50, date: "2025-05-10T18:00:00" });
  // After today, so not part of today's balance.
  await tx.createExpense({ name: "Trip", price: 999, date: "2025-05-11" });
  await createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 300 });
}

describe("balance forecast", () => {
  it("moves months across years", () => {
    expect(shiftMonth("2025-01", -1)).toBe("2024-12");
    expect(shiftMonth("2024-12", 1)).toBe("2025-01");
    expect(shiftMonth("2025-05", -12)).toBe("2024-05");
  });

  it("is null without transactions", async () => {
    await createAccount({ name: "Cash", openingBalance: 100 });
    expect(await getBalanceForecast(TODAY)).toBeNull();
  });

  it("charts month-end balances and projects the average net of complete months", async () => {
    await seed();
    expect(await getBalanceForecast(TODAY, { ahead: 2 })).toEqual({
      history: [
        { month: "2025-02", balance: 700 },
        { month: "2025-03", balance: 700 },
        { month: "2025-04", balance: 1000 },
        { month: "2025-05", balance: 950 },
      ],
      // Feb, Mar (empty) and Apr: (600 + 0 + 300) / 3.
      averageNet: 300,
      months: 3,
      projection: [
        { month: "2025-05", balance: 950 },
        { month: "2025-06", balance: 1250 },
        { month: "2025-07", balance: 1550 },
      ],
    });
  });

  it("limits the history and the averaging window", async () => {
    await seed();
    const short = await getBalanceForecast(TODAY, { history: 2, window: 2, ahead: 1 });
    expect(short?.history).toEqual([
      { month: "2025-04", balance: 1000 },
      { month: "2025-05", balance: 950 },
    ]);
    expect(short).toMatchObject({ averageNet: 150, months: 2 });
    expect(short?.projection.at(-1)).toEqual({ month: "2025-06", balance: 1100 });
  });

  it("doesn't project with only the current month", async () => {
    await tx.createPayment({ name: "Salary", price: 1000, date: "2025-05-01" });
    expect(await getBalanceForecast(TODAY)).toEqual({
      history: [{ month: "2025-05", balance: 1000 }],
      projection: [],
      averageNet: null,
      months: 0,
    });
  });
});

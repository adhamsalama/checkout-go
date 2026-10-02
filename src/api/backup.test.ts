import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import { counts, exportBackup, parseBackup, restoreBackup } from "./backup";
import { openLegacyDatabase } from "./legacy";
import * as tx from "./transactions";
import * as budgets from "./budgets";

const wasm = () => join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");

beforeEach(() => setDb(createNodeDb()));

/** A database shaped like the Go backend's, with the date formats it actually wrote. */
function legacyDbBytes(): Uint8Array {
  const path = join(mkdtempSync(join(tmpdir(), "checkout-")), "sqlite3.db");
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT);
    CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT,
      price REAL, date TEXT, tags, seller TEXT, note TEXT);
    CREATE TABLE monthly_budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      name TEXT NOT NULL, value REAL NOT NULL, date TEXT NOT NULL);
    CREATE TABLE tagged_budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      name TEXT NOT NULL, value REAL NOT NULL, tag TEXT NOT NULL, date TEXT NOT NULL);
    INSERT INTO users (id, username) VALUES (1, 'adham'), (2, 'other');
    INSERT INTO transactions (id, user_id, name, price, date, tags, seller, note) VALUES
      (3, 1, 'Mongo era', -12.5, '2023-11-30 22:15:00+02:00', NULL, NULL, NULL),
      (7, 1, 'Groceries', -250, '2024-05-03 00:00:00+00:00', '["food","home"]', 'Market', 'weekly'),
      (8, 1, 'Edited', -40, '2024-05-04T00:00:00Z', '["food"]', '', ''),
      (9, 1, 'Salary', 5000, '2024-05-01 00:00:00.123456789+00:00', '[]', '', ''),
      (10, 2, 'Not mine', -1, '2024-05-01 00:00:00+00:00', '[]', '', '');
    INSERT INTO monthly_budgets VALUES (1, 1, 'Monthly', 3000, '2024-01-01T10:00:00+02:00');
    INSERT INTO tagged_budgets VALUES (4, 1, 'Food', 800, 'food', '2024-01-01T10:00:00+02:00'),
      (5, 2, 'Theirs', 1, 'x', '2024-01-01T10:00:00+02:00');
  `);
  db.close();
  return new Uint8Array(readFileSync(path));
}

describe("legacy import", () => {
  it("imports one user's data from a Go backend database, keeping wall-clock dates", async () => {
    const legacy = await openLegacyDatabase(legacyDbBytes(), wasm);
    expect(legacy.users).toEqual([
      { userId: 1, username: "adham", transactions: 4 },
      { userId: 2, username: "other", transactions: 1 },
    ]);
    const summary = await restoreBackup(legacy.toBackup(1));
    legacy.close();
    expect(summary).toEqual({ transactions: 4, monthlyBudgets: 1, taggedBudgets: 1 });

    expect(await tx.getTransaction(3)).toMatchObject({ date: "2023-11-30T22:15:00", tags: [], sellerName: "" });
    expect(await tx.getTransaction(7)).toMatchObject({
      date: "2024-05-03T00:00:00",
      tags: ["food", "home"],
      sellerName: "Market",
      comment: "weekly",
    });
    expect((await tx.getTransaction(8))!.date).toBe("2024-05-04T00:00:00");
    expect((await tx.getTransaction(9))!.date).toBe("2024-05-01T00:00:00");
    expect(await tx.getTransaction(10)).toBeNull();
    expect(await tx.getBalance()).toBe(4697.5);
    expect(await budgets.getMonthlyBudget()).toMatchObject({ id: 1, value: 3000 });
    expect(await budgets.getTaggedBudgets()).toMatchObject([{ id: 4, tag: "food" }]);

    // New rows continue after imported ids.
    const created = await tx.createExpense({ name: "new", price: 1 });
    expect(created.id).toBe(10);
  });

  it("rejects files that are not Go backend databases", async () => {
    await expect(openLegacyDatabase(new TextEncoder().encode("hello"), wasm)).rejects.toThrow("Not a SQLite");
  });
});

describe("backup", () => {
  it("round-trips through JSON and replaces existing data", async () => {
    await tx.createExpense({ name: "a", price: 10, tags: ["t"], date: "2025-01-01" });
    await budgets.saveMonthlyBudget({ name: "m", value: 100 });
    await budgets.createTaggedBudget({ name: "b", value: 50, tag: "t" });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));

    setDb(createNodeDb());
    await tx.createExpense({ name: "will be replaced", price: 1 });
    await restoreBackup(parseBackup(backup));
    expect(await counts()).toEqual({ transactions: 1, monthlyBudgets: 1, taggedBudgets: 1 });
    expect((await tx.listExpenses())[0]).toMatchObject({ name: "a", tags: ["t"] });
  });

  it("leaves data untouched when a restore fails midway", async () => {
    await tx.createExpense({ name: "keep", price: 1 });
    const bad = parseBackup({
      app: "checkout",
      version: 1,
      transactions: [
        { id: 1, name: "x", price: -1, date: "2025-01-01", tags: [] },
        { id: 1, name: "duplicate id", price: -1, date: "2025-01-01", tags: [] },
      ],
    });
    await expect(restoreBackup(bad)).rejects.toThrow();
    expect((await tx.listExpenses()).map((t) => t.name)).toEqual(["keep"]);
  });

  it("rejects invalid files", () => {
    expect(() => parseBackup({ foo: 1 })).toThrow("Not a Checkout backup");
    expect(() =>
      parseBackup({ app: "checkout", version: 1, transactions: [{ id: 1, price: "abc", date: "2025-01-01" }] })
    ).toThrow("Invalid price");
  });
});

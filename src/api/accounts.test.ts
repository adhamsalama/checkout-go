import { beforeEach, describe, expect, it } from "vitest";
import { getDb, setDb } from "../db";
import { LATEST_VERSION, migrate } from "../db/migrations";
import { createNodeDb, createRawNodeDb } from "../test/nodeDb";
import * as accounts from "./accounts";
import { exportBackup, parseBackup, restoreBackup } from "./backup";
import * as tx from "./transactions";

beforeEach(() => setDb(createNodeDb()));

async function nullAccountIds() {
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE account_id IS NULL");
  return n;
}

describe("migrations", () => {
  it("brings a pre-migrations database with rows to the latest version, keeping its rows", async () => {
    const db = createRawNodeDb();
    // What installs from before the migration runner have: the v1 tables and no version table.
    await db.run(`CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      price REAL NOT NULL, date TEXT NOT NULL, tags TEXT, seller TEXT, note TEXT)`);
    await db.run("INSERT INTO transactions (name, price, date, tags) VALUES ('a', -5, '2025-01-01T00:00:00', '[]')");
    await db.run("INSERT INTO transactions (name, price, date, tags) VALUES ('b', 100, '2025-01-02T00:00:00', '[]')");
    await migrate(db);
    await migrate(db); // no-op the second time
    setDb(db);

    const [{ version }] = await db.query<{ version: number }>("SELECT version FROM schema_version");
    expect(version).toBe(LATEST_VERSION);
    expect(await tx.getBalance()).toBe(95);
    expect(await accounts.listAccounts()).toMatchObject([{ id: 1, name: "Main", isDefault: true, balance: 95 }]);
    expect((await tx.listExpenses()).map((t) => t.accountId)).toEqual([1]);
    expect(await nullAccountIds()).toBe(0);
  });
});

describe("accounts", () => {
  it("puts new transactions in the default account unless told otherwise", async () => {
    const cash = await accounts.createAccount({ name: " Cash ", openingBalance: 50 });
    expect(cash).toMatchObject({ name: "Cash", isDefault: false, balance: 50 });
    expect((await tx.createExpense({ name: "a", price: 1 })).accountId).toBe(1);
    expect((await tx.createExpense({ name: "b", price: 2, accountId: cash.id })).accountId).toBe(cash.id);

    await accounts.setDefaultAccount(cash.id);
    expect((await accounts.getDefaultAccount()).id).toBe(cash.id);
    expect((await tx.createPayment({ name: "c", price: 10 })).accountId).toBe(cash.id);
    expect((await accounts.listAccounts()).filter((a) => a.isDefault).map((a) => a.id)).toEqual([cash.id]);
    await expect(tx.createExpense({ name: "x", price: 1, accountId: 99 })).rejects.toThrow("not found");
    expect(await nullAccountIds()).toBe(0);
  });

  it("computes balances from opening balances and transactions", async () => {
    const bank = await accounts.createAccount({ name: "Bank", openingBalance: 1000 });
    await tx.createExpense({ name: "a", price: 30 });
    await tx.createExpense({ name: "b", price: 200, accountId: bank.id });
    await tx.createPayment({ name: "c", price: 50, accountId: bank.id });
    const list = await accounts.listAccounts();
    expect(list.map((a) => [a.name, a.balance])).toEqual([["Main", -30], ["Bank", 850]]);
    expect(await tx.getBalance()).toBe(820);
    expect((await tx.listExpenses({ accountIds: [bank.id] })).map((t) => t.name)).toEqual(["b"]);
    expect((await tx.listPayments({ accountIds: [1] })).length).toBe(0);
  });

  it("moves a transaction between accounts, but not into an archived one", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    const e = await tx.createExpense({ name: "a", price: 5 });
    expect((await tx.updateExpense(e.id, { accountId: cash.id })).accountId).toBe(cash.id);
    await accounts.updateAccount(cash.id, { archived: true });
    // Editing other fields while staying in an archived account is fine.
    expect((await tx.updateExpense(e.id, { name: "b", accountId: cash.id })).name).toBe("b");
    expect((await tx.updateExpense(e.id, { accountId: 1 })).accountId).toBe(1);
    await expect(tx.updateExpense(e.id, { accountId: cash.id })).rejects.toThrow("archived");
    await expect(tx.createExpense({ name: "x", price: 1, accountId: cash.id })).rejects.toThrow("archived");
    expect((await accounts.listAccounts()).map((a) => a.name)).toEqual(["Main"]);
    expect((await accounts.listAccounts({ includeArchived: true })).length).toBe(2);
  });

  it("protects the default account and accounts with transactions", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    await expect(accounts.updateAccount(1, { archived: true })).rejects.toThrow("default");
    await expect(accounts.deleteAccount(1)).rejects.toThrow("default");
    await accounts.updateAccount(cash.id, { archived: true });
    await expect(accounts.setDefaultAccount(cash.id)).rejects.toThrow("archived");
    await accounts.updateAccount(cash.id, { archived: false });

    const e = await tx.createExpense({ name: "a", price: 5, accountId: cash.id });
    await expect(accounts.deleteAccount(cash.id)).rejects.toThrow("1 transaction");
    await tx.deleteTransaction(e.id);
    await accounts.deleteAccount(cash.id);
    expect(await accounts.getAccount(cash.id)).toBeNull();
    await expect(accounts.createAccount({ name: "  " })).rejects.toThrow("name");
  });
});

describe("backup with accounts", () => {
  it("round-trips accounts, ids and the default", async () => {
    const cash = await accounts.createAccount({ name: "Cash", openingBalance: 20 });
    const old = await accounts.createAccount({ name: "Old" });
    await accounts.updateAccount(old.id, { archived: true });
    await accounts.setDefaultAccount(cash.id);
    await tx.createExpense({ name: "a", price: 5 });
    await tx.createExpense({ name: "b", price: 7, accountId: 1 });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    const before = await accounts.listAccounts({ includeArchived: true });

    setDb(createNodeDb());
    expect(await restoreBackup(parseBackup(backup))).toMatchObject({ accounts: 3, transactions: 2 });
    expect(await accounts.listAccounts({ includeArchived: true })).toEqual(before);
    expect((await tx.listExpenses()).map((t) => [t.name, t.accountId])).toEqual([["b", 1], ["a", cash.id]]);
    expect(await nullAccountIds()).toBe(0);
  });

  it("imports version 1 files into a single default account", async () => {
    await accounts.createAccount({ name: "Will be replaced" });
    await restoreBackup(
      parseBackup({
        app: "checkout",
        version: 1,
        transactions: [{ id: 4, name: "x", price: -3, date: "2025-01-01", tags: [] }],
      })
    );
    expect(await accounts.listAccounts({ includeArchived: true })).toMatchObject([
      { id: 1, name: "Main", isDefault: true, balance: -3 },
    ]);
    expect((await tx.getTransaction(4))!.accountId).toBe(1);
    expect((await tx.createExpense({ name: "new", price: 1 })).accountId).toBe(1);
  });

  it("rejects bad account data", () => {
    const base = {
      app: "checkout",
      version: 2,
      accounts: [
        { id: 1, name: "A", isDefault: true },
        { id: 2, name: "B", isDefault: false },
      ],
      transactions: [{ id: 1, name: "x", price: -1, date: "2025-01-01", tags: [], accountId: 2 }],
    };
    expect(() => parseBackup(base)).not.toThrow();
    expect(() => parseBackup({ ...base, transactions: [{ ...base.transactions[0], accountId: 3 }] })).toThrow(
      "unknown account"
    );
    expect(() =>
      parseBackup({ ...base, accounts: base.accounts.map((a) => ({ ...a, isDefault: true })) })
    ).toThrow("exactly one default");
    expect(() => parseBackup({ ...base, accounts: [] })).toThrow("no accounts");
  });
});

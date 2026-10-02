import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import * as accounts from "./accounts";
import { describeEntry, listAuditLog } from "./audit";
import { counts, exportBackup, parseBackup, restoreBackup } from "./backup";
import * as budgets from "./budgets";
import { renameSeller } from "./sellers";
import { renameTag } from "./tags";
import * as tx from "./transactions";
import { createTransfer, listTransfers, reverseTransfer } from "./transfers";

beforeEach(() => setDb(createNodeDb()));

const balances = async () => (await accounts.listAccounts()).map((a) => [a.name, a.balance]);

describe("transfers", () => {
  it("moves money between accounts without counting as spending or income", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    await tx.createPayment({ name: "Salary", price: 1000 });
    const t = await createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 300, note: " ATM " });
    expect(t).toMatchObject({ fromName: "Main", toName: "Cash", amount: 300, note: "ATM", reversalOf: null, reversedBy: null });
    expect(await balances()).toEqual([["Main", 700], ["Cash", 300]]);
    expect(await tx.getBalance()).toBe(1000);
    expect(await tx.getCurrentMonthExpensesSum()).toBe(0);
    expect(await tx.getCurrentMonthIncomeSum()).toBe(1000);
    expect((await listTransfers({ accountId: cash.id })).map((x) => x.id)).toEqual([t.id]);
  });

  it("validates accounts and amounts", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    await expect(createTransfer({ fromAccountId: 1, toAccountId: 1, amount: 5 })).rejects.toThrow("different");
    await expect(createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 0 })).rejects.toThrow("greater than 0");
    await expect(createTransfer({ fromAccountId: 1, toAccountId: 99, amount: 5 })).rejects.toThrow("not found");
    await accounts.updateAccount(cash.id, { archived: true });
    await expect(createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 5 })).rejects.toThrow("archived");
  });

  it("is undone by a reversal, only once, and keeps its accounts from being deleted", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    const t = await createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 50 });
    const r = await reverseTransfer(t.id);
    expect(r).toMatchObject({ fromAccountId: cash.id, toAccountId: 1, amount: 50, reversalOf: t.id });
    expect(await balances()).toEqual([["Main", 0], ["Cash", 0]]);
    expect((await listTransfers()).find((x) => x.id === t.id)?.reversedBy).toBe(r.id);
    await expect(reverseTransfer(t.id)).rejects.toThrow("already reversed");
    await expect(accounts.deleteAccount(cash.id)).rejects.toThrow("transfers");
  });

  it("round-trips through a backup, and older backups import with none", async () => {
    const cash = await accounts.createAccount({ name: "Cash" });
    const t = await createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 50 });
    await reverseTransfer(t.id);
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    const before = await listTransfers();

    setDb(createNodeDb());
    expect(await restoreBackup(parseBackup(backup))).toMatchObject({ transfers: 2 });
    expect(await listTransfers()).toEqual(before);
    expect(await balances()).toEqual([["Main", 0], ["Cash", 0]]);

    const v2 = { ...backup, version: 2, transfers: undefined, auditLog: undefined };
    await restoreBackup(parseBackup(v2));
    expect(await counts()).toMatchObject({ accounts: 2, transfers: 0 });
    const bad = { ...backup, transfers: [{ ...backup.transfers[0], toAccountId: 9 }] };
    expect(() => parseBackup(bad)).toThrow("unknown account");
  });
});

describe("audit log", () => {
  it("records every kind of change, newest first, with readable text", async () => {
    const e = await tx.createExpense({ name: "Coffee", price: 4, tags: ["food"], sellerName: "Cafe" });
    await tx.updateExpense(e.id, { price: -5, tags: ["food", "treat"] });
    await tx.updateExpense(e.id, { price: -5 }); // no change, not logged
    const p = await tx.createPayment({ name: "Salary", price: 100 });
    await tx.deleteTransaction(p.id);
    const cash = await accounts.createAccount({ name: "Cash", openingBalance: 20 });
    await accounts.updateAccount(cash.id, { name: "Wallet" });
    const t = await createTransfer({ fromAccountId: 1, toAccountId: cash.id, amount: 10 });
    await reverseTransfer(t.id);
    await budgets.saveMonthlyBudget({ name: "m", value: 500 });
    await budgets.deleteMonthlyBudget();
    const b = await budgets.createTaggedBudget({ name: "Food", value: 50, tag: "food" });
    await renameTag("food", "groceries");
    await renameSeller("Cafe", "Café");
    await budgets.deleteTaggedBudget(b.id);

    const log = await listAuditLog();
    expect(log.map((x) => `${x.entity} ${x.action}`)).toEqual([
      "taggedBudget delete",
      "seller rename",
      "tag rename",
      "taggedBudget create",
      "monthlyBudget delete",
      "monthlyBudget create",
      "transfer create",
      "transfer create",
      "account update",
      "account create",
      "payment delete",
      "payment create",
      "expense update",
      "expense create",
    ]);
    const text = log.map(describeEntry);
    expect(text[2]).toMatchObject({ title: "Renamed tag", summary: '"food" to "groceries" on 1 transaction' });
    expect(text[6]).toMatchObject({ title: "Reversed a transfer", summary: "$10.00 from Wallet to Main" });
    expect(text[7]).toMatchObject({ title: "Transferred money", summary: "$10.00 from Main to Wallet" });
    expect(text[8]).toMatchObject({ title: "Edited account", changes: ["Name: Cash → Wallet"] });
    expect(text[10]).toMatchObject({ title: "Deleted payment", summary: "Salary · $100.00" });
    expect(text[12]).toMatchObject({
      title: "Edited expense",
      summary: "Coffee · $5.00",
      changes: ["Amount: $4.00 → $5.00", "Tags: food → food, treat"],
    });
  });

  it("is kept through a backup and notes the restore, which is atomic with it", async () => {
    await tx.createExpense({ name: "a", price: 1 });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    setDb(createNodeDb());
    await restoreBackup(parseBackup(backup));
    const log = await listAuditLog();
    expect(log.map((x) => `${x.entity} ${x.action}`)).toEqual(["backup restore", "expense create"]);
    expect(describeEntry(log[0])).toMatchObject({ summary: "Imported 1 account, 1 transaction", changes: ["Replaced 1 account"] });
  });
});

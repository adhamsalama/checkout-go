import { getDb } from "../db";
import { normalizeDate } from "../dates";
import { cleanTags } from "./transactions";

/** 2 added accounts. Version 1 files still import, into a single default "Main" account. */
export const BACKUP_VERSION = 2;

export type Backup = {
  app: "checkout";
  version: number;
  exportedAt: string;
  accounts: {
    id: number;
    name: string;
    openingBalance: number;
    isDefault: boolean;
    archived: boolean;
    sortOrder: number;
  }[];
  transactions: {
    id: number;
    name: string;
    price: number;
    date: string;
    tags: string[];
    seller: string;
    note: string;
    accountId: number;
  }[];
  monthlyBudgets: { id: number; name: string; value: number; date: string }[];
  taggedBudgets: { id: number; name: string; value: number; tag: string; date: string }[];
};

export type ImportSummary = {
  accounts: number;
  transactions: number;
  monthlyBudgets: number;
  taggedBudgets: number;
};

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const accounts = await db.query<{
    id: number;
    name: string;
    opening_balance: number;
    is_default: number;
    archived: number;
    sort_order: number;
  }>("SELECT * FROM accounts ORDER BY id");
  const transactions = await db.query<{
    id: number;
    name: string;
    price: number;
    date: string;
    tags: string | null;
    seller: string | null;
    note: string | null;
    account_id: number;
  }>("SELECT * FROM transactions ORDER BY id");
  return {
    app: "checkout",
    version: BACKUP_VERSION,
    exportedAt: normalizeDate(),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      openingBalance: a.opening_balance,
      isDefault: a.is_default === 1,
      archived: a.archived === 1,
      sortOrder: a.sort_order,
    })),
    transactions: transactions.map(({ account_id, ...t }) => ({
      ...t,
      tags: parseTagsLoose(t.tags),
      seller: t.seller ?? "",
      note: t.note ?? "",
      accountId: account_id,
    })),
    monthlyBudgets: await db.query("SELECT * FROM monthly_budgets ORDER BY id"),
    taggedBudgets: await db.query("SELECT * FROM tagged_budgets ORDER BY id"),
  };
}

function parseTagsLoose(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanTags(raw.map(String));
  if (raw instanceof Uint8Array) raw = new TextDecoder().decode(raw);
  if (typeof raw !== "string" || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? cleanTags(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

function requireNumber(v: unknown, what: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !isFinite(n)) throw new Error(`Invalid ${what}: ${String(v)}`);
  return n;
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Validates and normalizes a parsed backup file; throws on anything unexpected. */
export function parseBackup(data: unknown): Backup {
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== "checkout" || !Array.isArray(b.transactions)) {
    throw new Error("Not a Checkout backup file");
  }
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(b.version)}`);
  }
  const legacy = b.version < 2;
  // Version 1 had no accounts: everything goes into one default account.
  const accounts: Backup["accounts"] = legacy
      ? [{ id: 1, name: "Main", openingBalance: 0, isDefault: true, archived: false, sortOrder: 0 }]
      : parseAccounts(b.accounts);
  const accountIds = new Set(accounts.map((a) => a.id));
  return {
    app: "checkout",
    version: BACKUP_VERSION,
    exportedAt: str(b.exportedAt),
    accounts,
    transactions: b.transactions.map((t, i) => ({
      id: requireNumber(t.id, `transaction id at index ${i}`),
      name: str(t.name),
      price: requireNumber(t.price, `price of transaction ${t.id}`),
      date: normalizeDate(str(t.date) || failDate(t.id)),
      tags: parseTagsLoose(t.tags),
      seller: str(t.seller),
      note: str(t.note),
      accountId: legacy ? 1 : requireAccount(t.accountId, accountIds, t.id),
    })),
    monthlyBudgets: (b.monthlyBudgets ?? []).map((m) => ({
      id: requireNumber(m.id, "monthly budget id"),
      name: str(m.name),
      value: requireNumber(m.value, `value of monthly budget ${m.id}`),
      date: normalizeDate(str(m.date) || undefined),
    })),
    taggedBudgets: (b.taggedBudgets ?? []).map((t) => ({
      id: requireNumber(t.id, "tagged budget id"),
      name: str(t.name),
      value: requireNumber(t.value, `value of tagged budget ${t.id}`),
      tag: str(t.tag).trim(),
      date: normalizeDate(str(t.date) || undefined),
    })),
  };
}

function parseAccounts(raw: unknown): Backup["accounts"] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("The backup has no accounts");
  const accounts = raw.map((a, i) => ({
    id: requireNumber(a?.id, `account id at index ${i}`),
    name: str(a.name).trim() || `Account ${a.id}`,
    openingBalance: a.openingBalance === undefined ? 0 : requireNumber(a.openingBalance, `opening balance of account ${a.id}`),
    isDefault: a.isDefault === true,
    archived: a.archived === true,
    sortOrder: a.sortOrder === undefined ? 0 : requireNumber(a.sortOrder, `sort order of account ${a.id}`),
  }));
  const defaults = accounts.filter((a) => a.isDefault);
  if (defaults.length !== 1) throw new Error(`The backup must have exactly one default account, not ${defaults.length}`);
  if (defaults[0].archived) throw new Error("The backup's default account is archived");
  if (new Set(accounts.map((a) => a.id)).size !== accounts.length) throw new Error("Duplicate account ids");
  return accounts;
}

function requireAccount(v: unknown, ids: Set<number>, transactionId: unknown): number {
  const id = requireNumber(v, `account of transaction ${String(transactionId)}`);
  if (!ids.has(id)) throw new Error(`Transaction ${String(transactionId)} refers to unknown account ${id}`);
  return id;
}

function failDate(id: unknown): never {
  throw new Error(`Missing date on transaction ${String(id)}`);
}

/** Replaces all data with the backup, atomically. Ids are kept so re-imports are stable. */
export async function restoreBackup(backup: Backup): Promise<ImportSummary> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM transactions");
    await tx.run("DELETE FROM monthly_budgets");
    await tx.run("DELETE FROM tagged_budgets");
    await tx.run("DELETE FROM accounts");
    for (const a of backup.accounts) {
      await tx.run(
        "INSERT INTO accounts (id, name, opening_balance, is_default, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [a.id, a.name, a.openingBalance, a.isDefault ? 1 : 0, a.archived ? 1 : 0, a.sortOrder]
      );
    }
    for (const t of backup.transactions) {
      await tx.run(
        "INSERT INTO transactions (id, name, price, date, tags, seller, note, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.name, t.price, t.date, JSON.stringify(t.tags), t.seller, t.note, t.accountId]
      );
    }
    for (const m of backup.monthlyBudgets) {
      await tx.run("INSERT INTO monthly_budgets (id, name, value, date) VALUES (?, ?, ?, ?)", [
        m.id,
        m.name,
        m.value,
        m.date,
      ]);
    }
    for (const t of backup.taggedBudgets) {
      await tx.run("INSERT INTO tagged_budgets (id, name, value, tag, date) VALUES (?, ?, ?, ?, ?)", [
        t.id,
        t.name,
        t.value,
        t.tag,
        t.date,
      ]);
    }
  });
  return {
    accounts: backup.accounts.length,
    transactions: backup.transactions.length,
    monthlyBudgets: backup.monthlyBudgets.length,
    taggedBudgets: backup.taggedBudgets.length,
  };
}

export async function counts(): Promise<ImportSummary> {
  const db = await getDb();
  const [row] = await db.query<ImportSummary>(
    `SELECT (SELECT COUNT(*) FROM accounts) AS accounts,
            (SELECT COUNT(*) FROM transactions) AS transactions,
            (SELECT COUNT(*) FROM monthly_budgets) AS monthlyBudgets,
            (SELECT COUNT(*) FROM tagged_budgets) AS taggedBudgets`
  );
  return row;
}

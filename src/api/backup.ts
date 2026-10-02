import { getDb } from "../db";
import { normalizeDate } from "../dates";
import { AuditAction, AuditEntity, logChange, Snapshot } from "./audit";
import { cleanTags } from "./transactions";

/**
 * 2 added accounts, 3 transfers and the audit log. Version 1 files still import, into a single default
 * "Main" account; files before 3 import with no transfers and an empty log.
 */
export const BACKUP_VERSION = 3;

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
  transfers: {
    id: number;
    fromAccountId: number;
    toAccountId: number;
    amount: number;
    date: string;
    note: string;
    reversalOf: number | null;
  }[];
  monthlyBudgets: { id: number; name: string; value: number; date: string }[];
  taggedBudgets: { id: number; name: string; value: number; tag: string; date: string }[];
  auditLog: {
    id: number;
    at: string;
    entity: AuditEntity;
    action: AuditAction;
    entityId: number | null;
    before: Snapshot | null;
    after: Snapshot | null;
  }[];
};

export type ImportSummary = {
  accounts: number;
  transactions: number;
  transfers: number;
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
  const transfers = await db.query<{
    id: number;
    from_account_id: number;
    to_account_id: number;
    amount: number;
    date: string;
    note: string;
    reversal_of: number | null;
  }>("SELECT * FROM transfers ORDER BY id");
  const log = await db.query<{
    id: number;
    at: string;
    entity: AuditEntity;
    action: AuditAction;
    entity_id: number | null;
    before: string | null;
    after: string | null;
  }>("SELECT * FROM audit_log ORDER BY id");
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
    transfers: transfers.map((t) => ({
      id: t.id,
      fromAccountId: t.from_account_id,
      toAccountId: t.to_account_id,
      amount: t.amount,
      date: t.date,
      note: t.note,
      reversalOf: t.reversal_of,
    })),
    monthlyBudgets: await db.query("SELECT * FROM monthly_budgets ORDER BY id"),
    taggedBudgets: await db.query("SELECT * FROM tagged_budgets ORDER BY id"),
    auditLog: log.map((e) => ({
      id: e.id,
      at: e.at,
      entity: e.entity,
      action: e.action,
      entityId: e.entity_id,
      before: parseJsonLoose(e.before),
      after: parseJsonLoose(e.after),
    })),
  };
}

function parseJsonLoose(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    transfers: parseTransfers(b.version < 3 ? [] : b.transfers, accountIds),
    auditLog: parseAuditLog(b.version < 3 ? [] : b.auditLog),
  };
}

function parseTransfers(raw: unknown, accountIds: Set<number>): Backup["transfers"] {
  if (!Array.isArray(raw)) throw new Error("The backup's transfers are missing");
  const ids = new Set<number>();
  return raw.map((t, i) => {
    const id = requireNumber(t?.id, `transfer id at index ${i}`);
    const account = (v: unknown) => {
      const n = requireNumber(v, `account of transfer ${id}`);
      if (!accountIds.has(n)) throw new Error(`Transfer ${id} refers to unknown account ${n}`);
      return n;
    };
    const transfer = {
      id,
      fromAccountId: account(t.fromAccountId),
      toAccountId: account(t.toAccountId),
      amount: requireNumber(t.amount, `amount of transfer ${id}`),
      date: normalizeDate(str(t.date) || failDate(id)),
      note: str(t.note),
      reversalOf: t.reversalOf === null || t.reversalOf === undefined ? null : requireNumber(t.reversalOf, `reversal of transfer ${id}`),
    };
    if (!(transfer.amount > 0)) throw new Error(`Transfer ${id} must have a positive amount`);
    if (transfer.fromAccountId === transfer.toAccountId) throw new Error(`Transfer ${id} is between one account`);
    // Restore inserts in id order, so a reversal must come after what it reverses.
    if (transfer.reversalOf !== null && !ids.has(transfer.reversalOf)) {
      throw new Error(`Transfer ${id} reverses unknown transfer ${transfer.reversalOf}`);
    }
    ids.add(id);
    return transfer;
  });
}

function parseAuditLog(raw: unknown): Backup["auditLog"] {
  if (!Array.isArray(raw)) throw new Error("The backup's audit log is missing");
  const snapshot = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Snapshot) : null);
  return raw.map((e, i) => ({
    id: requireNumber(e?.id, `audit log id at index ${i}`),
    at: normalizeDate(str(e.at) || undefined),
    entity: str(e.entity) as AuditEntity,
    action: str(e.action) as AuditAction,
    entityId: e.entityId === null || e.entityId === undefined ? null : requireNumber(e.entityId, "audit log entity id"),
    before: snapshot(e.before),
    after: snapshot(e.after),
  }));
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

/**
 * Replaces all data with the backup, atomically. Ids are kept so re-imports are stable. The audit log is
 * replaced by the backup's, with an entry for the restore itself appended.
 */
export async function restoreBackup(backup: Backup): Promise<ImportSummary> {
  const summary: ImportSummary = {
    accounts: backup.accounts.length,
    transactions: backup.transactions.length,
    transfers: backup.transfers.length,
    monthlyBudgets: backup.monthlyBudgets.length,
    taggedBudgets: backup.taggedBudgets.length,
  };
  const replaced = await counts();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM audit_log");
    await tx.run("DELETE FROM transfers");
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
    for (const t of backup.transfers) {
      await tx.run(
        "INSERT INTO transfers (id, from_account_id, to_account_id, amount, date, note, reversal_of) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.fromAccountId, t.toAccountId, t.amount, t.date, t.note, t.reversalOf]
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
    for (const e of backup.auditLog) {
      await tx.run(
        "INSERT INTO audit_log (id, at, entity, action, entity_id, before, after) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [e.id, e.at, e.entity, e.action, e.entityId, e.before && JSON.stringify(e.before), e.after && JSON.stringify(e.after)]
      );
    }
    await logChange(tx, "backup", "restore", null, replaced, summary);
  });
  return summary;
}

export async function counts(): Promise<ImportSummary> {
  const db = await getDb();
  const [row] = await db.query<ImportSummary>(
    `SELECT (SELECT COUNT(*) FROM accounts) AS accounts,
            (SELECT COUNT(*) FROM transactions) AS transactions,
            (SELECT COUNT(*) FROM transfers) AS transfers,
            (SELECT COUNT(*) FROM monthly_budgets) AS monthlyBudgets,
            (SELECT COUNT(*) FROM tagged_budgets) AS taggedBudgets`
  );
  return row;
}

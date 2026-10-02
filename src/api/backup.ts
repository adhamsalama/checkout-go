import { getDb } from "../db";
import { normalizeDate } from "../dates";
import { cleanTags } from "./transactions";

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "checkout";
  version: number;
  exportedAt: string;
  transactions: {
    id: number;
    name: string;
    price: number;
    date: string;
    tags: string[];
    seller: string;
    note: string;
  }[];
  monthlyBudgets: { id: number; name: string; value: number; date: string }[];
  taggedBudgets: { id: number; name: string; value: number; tag: string; date: string }[];
};

export type ImportSummary = { transactions: number; monthlyBudgets: number; taggedBudgets: number };

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const transactions = await db.query<{
    id: number;
    name: string;
    price: number;
    date: string;
    tags: string | null;
    seller: string | null;
    note: string | null;
  }>("SELECT * FROM transactions ORDER BY id");
  return {
    app: "checkout",
    version: BACKUP_VERSION,
    exportedAt: normalizeDate(),
    transactions: transactions.map((t) => ({
      ...t,
      tags: parseTagsLoose(t.tags),
      seller: t.seller ?? "",
      note: t.note ?? "",
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
  return {
    app: "checkout",
    version: b.version,
    exportedAt: str(b.exportedAt),
    transactions: b.transactions.map((t, i) => ({
      id: requireNumber(t.id, `transaction id at index ${i}`),
      name: str(t.name),
      price: requireNumber(t.price, `price of transaction ${t.id}`),
      date: normalizeDate(str(t.date) || failDate(t.id)),
      tags: parseTagsLoose(t.tags),
      seller: str(t.seller),
      note: str(t.note),
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
    for (const t of backup.transactions) {
      await tx.run(
        "INSERT INTO transactions (id, name, price, date, tags, seller, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.name, t.price, t.date, JSON.stringify(t.tags), t.seller, t.note]
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
    transactions: backup.transactions.length,
    monthlyBudgets: backup.monthlyBudgets.length,
    taggedBudgets: backup.taggedBudgets.length,
  };
}

export async function counts(): Promise<ImportSummary> {
  const db = await getDb();
  const [row] = await db.query<ImportSummary>(
    `SELECT (SELECT COUNT(*) FROM transactions) AS transactions,
            (SELECT COUNT(*) FROM monthly_budgets) AS monthlyBudgets,
            (SELECT COUNT(*) FROM tagged_budgets) AS taggedBudgets`
  );
  return row;
}

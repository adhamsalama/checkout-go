import { getDb } from "../db";
import { Db } from "../db/types";
import { normalizeDate } from "../dates";
import { formatDay, formatMoney } from "../format";

export type AuditEntity =
  | "expense"
  | "payment"
  | "account"
  | "transfer"
  | "monthlyBudget"
  | "taggedBudget"
  | "tag"
  | "seller"
  | "backup";
export type AuditAction = "create" | "update" | "delete" | "rename" | "restore";
export type Snapshot = Record<string, unknown>;

/** One change to the data, with JSON snapshots of the row before and after it. */
export type AuditEntry = {
  id: number;
  /** Local wall-clock time of the change. */
  at: string;
  entity: AuditEntity;
  action: AuditAction;
  entityId: number | null;
  before: Snapshot | null;
  after: Snapshot | null;
};

type AuditRow = {
  id: number;
  at: string;
  entity: AuditEntity;
  action: AuditAction;
  entity_id: number | null;
  before: string | null;
  after: string | null;
};

/**
 * Appends a log entry. Pass the Db of the transaction making the change, so the entry is written
 * atomically with it. An update that changed nothing isn't logged.
 */
export async function logChange(
  db: Db,
  entity: AuditEntity,
  action: AuditAction,
  entityId: number | null,
  before: Snapshot | null,
  after: Snapshot | null
): Promise<void> {
  const b = before && JSON.stringify(before);
  const a = after && JSON.stringify(after);
  if (action === "update" && b === a) return;
  await db.run("INSERT INTO audit_log (at, entity, action, entity_id, before, after) VALUES (?, ?, ?, ?, ?, ?)", [
    normalizeDate(),
    entity,
    action,
    entityId,
    b,
    a,
  ]);
}

function parseSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    at: row.at,
    entity: row.entity,
    action: row.action,
    entityId: row.entity_id,
    before: parseSnapshot(row.before),
    after: parseSnapshot(row.after),
  };
}

/** Log entries, newest first. */
export async function listAuditLog(opts: { limit?: number; offset?: number } = {}): Promise<AuditEntry[]> {
  const db = await getDb();
  const rows = await db.query<AuditRow>("SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?", [
    opts.limit ?? -1,
    opts.offset ?? 0,
  ]);
  return rows.map(toEntry);
}

const NOUNS: Record<AuditEntity, string> = {
  expense: "expense",
  payment: "payment",
  account: "account",
  transfer: "transfer",
  monthlyBudget: "monthly budget",
  taggedBudget: "tag budget",
  tag: "tag",
  seller: "seller",
  backup: "data",
};

const text = (v: unknown) => (v === undefined || v === null || v === "" ? "none" : String(v));
const money = (v: unknown) => formatMoney(Math.abs(Number(v) || 0));
const yesNo = (v: unknown) => (v ? "yes" : "no");
const day = (v: unknown) => (typeof v === "string" && v ? formatDay(v) : "none");
const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : "none");

/** The fields an edit can change, in display order. */
const FIELDS: [key: string, label: string, format: (v: unknown) => string][] = [
  ["name", "Name", text],
  ["price", "Amount", money],
  ["value", "Amount", money],
  ["date", "Date", day],
  ["accountName", "Account", text],
  ["tags", "Tags", list],
  ["tag", "Tag", text],
  ["sellerName", "Seller", text],
  ["comment", "Note", text],
  ["openingBalance", "Opening balance", formatMoneySigned],
  ["isDefault", "Default", yesNo],
  ["archived", "Archived", yesNo],
];

function formatMoneySigned(v: unknown) {
  return formatMoney(Number(v) || 0);
}

function counts(v: Snapshot | null): string {
  if (!v) return "nothing";
  const parts = [
    [v.accounts, "account"],
    [v.transactions, "transaction"],
    [v.transfers, "transfer"],
    [v.monthlyBudgets, "monthly budget"],
    [v.taggedBudgets, "tag budget"],
  ] as const;
  return parts
    .filter(([n]) => typeof n === "number" && n > 0)
    .map(([n, word]) => `${n} ${n === 1 ? word : `${word}s`}`)
    .join(", ") || "nothing";
}

function summary(entity: AuditEntity, s: Snapshot): string {
  switch (entity) {
    case "expense":
    case "payment":
      return `${text(s.name || "Untitled")} · ${money(s.price)}`;
    case "account":
      return text(s.name);
    case "transfer":
      return `${money(s.amount)} from ${text(s.fromName)} to ${text(s.toName)}`;
    case "monthlyBudget":
      return money(s.value);
    case "taggedBudget":
      return `${text(s.name)} · ${text(s.tag)} · ${money(s.value)}`;
    default:
      return "";
  }
}

/** Human-readable text for a log entry: a title, a one-line summary and, for edits, what changed. */
export function describeEntry(e: AuditEntry): { title: string; summary: string; changes: string[] } {
  const noun = NOUNS[e.entity];
  const before = e.before ?? {};
  const after = e.after ?? {};
  if (e.action === "rename") {
    const n = Number(after.transactions) || 0;
    return {
      title: `Renamed ${noun}`,
      summary: `"${text(before.name)}" to "${text(after.name)}" on ${n} ${n === 1 ? "transaction" : "transactions"}`,
      changes: [],
    };
  }
  if (e.action === "restore") {
    return { title: "Restored a backup", summary: `Imported ${counts(e.after)}`, changes: [`Replaced ${counts(e.before)}`] };
  }
  if (e.entity === "transfer" && e.action === "create" && after.reversalOf) {
    return { title: "Reversed a transfer", summary: summary(e.entity, after), changes: [] };
  }
  const verb = { create: "Added", update: "Edited", delete: "Deleted" }[e.action];
  const title = e.entity === "transfer" && e.action === "create" ? "Transferred money" : `${verb} ${noun}`;
  const changes =
    e.action === "update"
      ? FIELDS.filter(([key]) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(
          ([key, label, format]) => `${label}: ${format(before[key])} → ${format(after[key])}`
        )
      : [];
  return { title, summary: summary(e.entity, e.after ?? before), changes };
}

import { getDb } from "../db";
import { Db, SqlValue } from "../db/types";
import { normalizeDate, toLocalIso } from "../dates";
import { Expense, PeriodStats, TagStats } from "../types";
import { getAccount, resolveAccountId } from "./accounts";
import { AuditAction, logChange } from "./audit";

type TransactionRow = {
  id: number;
  name: string;
  price: number;
  date: string;
  tags: string | null;
  seller: string | null;
  note: string | null;
  account_id: number;
};

export type TransactionInput = {
  name: string;
  /** Always positive; expenses are negated on save. */
  price: number;
  sellerName?: string;
  comment?: string;
  tags?: string[];
  date?: string | Date;
  /** Defaults to the default account. */
  accountId?: number;
};

export type TransactionUpdate = Partial<{
  accountId: number;
  name: string;
  price: number;
  sellerName: string;
  comment: string;
  tags: string[];
  date: string | Date;
}>;

export type ExpenseFilters = {
  name?: string;
  /** Bounds on the amount spent, i.e. the absolute value of the stored price. */
  minAmount?: number;
  maxAmount?: number;
  /** Matches expenses that have any of these tags. */
  tags?: string[];
  /** Matches expenses in any of these accounts. */
  accountIds?: number[];
  /** Inclusive local calendar days. */
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function cleanTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((t) => t.trim()).filter(Boolean);
}

function toTransaction(row: TransactionRow): Expense {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    date: row.date,
    tags: parseTags(row.tags),
    sellerName: row.seller ?? "",
    comment: row.note ?? "",
    accountId: row.account_id,
  };
}

/** Logs a change to a transaction, with its account's name so the entry still reads well later. */
async function logTransaction(db: Db, action: AuditAction, before: Expense | null, after: Expense | null) {
  const snapshot = async (t: Expense | null) => {
    if (!t) return null;
    const [account] = await db.query<{ name: string }>("SELECT name FROM accounts WHERE id = ?", [t.accountId]);
    return { ...t, accountName: account?.name ?? "" };
  };
  const t = (after ?? before)!;
  await logChange(db, t.price <= 0 ? "expense" : "payment", action, t.id, await snapshot(before), await snapshot(after));
}

async function insert(input: TransactionInput, price: number): Promise<Expense> {
  const date = normalizeDate(input.date);
  const tags = cleanTags(input.tags);
  const accountId = await resolveAccountId(input.accountId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { lastId } = await tx.run(
      "INSERT INTO transactions (name, price, date, tags, seller, note, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [input.name, price, date, JSON.stringify(tags), input.sellerName ?? "", input.comment ?? "", accountId]
    );
    const created = (await getTransaction(lastId, tx))!;
    await logTransaction(tx, "create", null, created);
    return created;
  });
}

export async function createExpense(input: TransactionInput): Promise<Expense> {
  return insert(input, -Math.abs(input.price));
}

export async function createPayment(input: TransactionInput): Promise<Expense> {
  if (!(input.price >= 1)) throw new Error("Payment value cannot be less than 1");
  return insert(input, input.price);
}

async function update(id: number, patch: TransactionUpdate): Promise<Expense> {
  const fields: Record<string, SqlValue> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.price !== undefined) fields.price = patch.price;
  if (patch.sellerName !== undefined) fields.seller = patch.sellerName;
  if (patch.comment !== undefined) fields.note = patch.comment;
  if (patch.tags !== undefined) fields.tags = JSON.stringify(cleanTags(patch.tags));
  if (patch.date !== undefined) fields.date = normalizeDate(patch.date);
  if (patch.accountId !== undefined) {
    // Staying in an archived account is fine; moving into one isn't.
    const current = await getTransaction(id);
    if (current && current.accountId !== patch.accountId) await resolveAccountId(patch.accountId);
    else if (!(await getAccount(patch.accountId))) throw new Error("Account not found");
    fields.account_id = patch.accountId;
  }
  const columns = Object.keys(fields);
  if (columns.length === 0) throw new Error("No fields to update");

  const before = await getTransaction(id);
  if (!before) throw new Error("Transaction not found");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.run(`UPDATE transactions SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [
      ...Object.values(fields),
      id,
    ]);
    const after = (await getTransaction(id, tx))!;
    await logTransaction(tx, "update", before, after);
    return after;
  });
}

export async function updateExpense(id: number, patch: TransactionUpdate): Promise<Expense> {
  if (patch.price !== undefined && patch.price > 0) {
    throw new Error(`Expense price cannot be higher than 0: ${patch.price}`);
  }
  return update(id, patch);
}

export async function updatePayment(id: number, patch: TransactionUpdate): Promise<Expense> {
  if (patch.price !== undefined && !(patch.price > 0)) {
    throw new Error(`Payment value must be greater than 0: ${patch.price}`);
  }
  return update(id, patch);
}

export async function deleteTransaction(id: number): Promise<Expense | null> {
  const transaction = await getTransaction(id);
  if (!transaction) return null;
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM transactions WHERE id = ?", [id]);
    await logTransaction(tx, "delete", transaction, null);
  });
  return transaction;
}

/** Pass `db` when reading inside a transaction. */
export async function getTransaction(id: number, db?: Db): Promise<Expense | null> {
  db ??= await getDb();
  const [row] = await db.query<TransactionRow>("SELECT * FROM transactions WHERE id = ?", [id]);
  return row ? toTransaction(row) : null;
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const where = ["price <= 0"];
  const params: SqlValue[] = [];
  if (filters.name) {
    where.push("name LIKE ?");
    params.push(`%${filters.name}%`);
  }
  if (filters.minAmount !== undefined && !isNaN(filters.minAmount)) {
    where.push("-price >= ?");
    params.push(filters.minAmount);
  }
  if (filters.maxAmount !== undefined && !isNaN(filters.maxAmount)) {
    where.push("-price <= ?");
    params.push(filters.maxAmount);
  }
  const tags = cleanTags(filters.tags);
  if (tags.length > 0) {
    where.push(
      `EXISTS (SELECT 1 FROM json_each(transactions.tags) WHERE value IN (${tags.map(() => "?").join(", ")}))`
    );
    params.push(...tags);
  }
  where.push(...accountWhere(filters.accountIds, params));
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    where.push("date >= ?");
    params.push(toLocalIso(start));
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    where.push("date < ?");
    params.push(toLocalIso(end));
  }
  return listWhere(where, params, filters.limit, filters.offset);
}

export function listPayments(
  opts: { limit?: number; offset?: number; accountIds?: number[] } = {}
): Promise<Expense[]> {
  const params: SqlValue[] = [];
  const where = ["price > 0", ...accountWhere(opts.accountIds, params)];
  return listWhere(where, params, opts.limit, opts.offset);
}

/** A clause matching any of `ids` (none if empty or undefined); pushes its params. */
function accountWhere(ids: number[] | undefined, params: SqlValue[]): string[] {
  if (!ids?.length) return [];
  params.push(...ids);
  return [`account_id IN (${ids.map(() => "?").join(", ")})`];
}

/** Transactions matching all `where` clauses, newest first unless `orderBy` says otherwise. */
export async function listWhere(
  where: string[],
  params: SqlValue[],
  limit = -1,
  offset = 0,
  orderBy = "date DESC, id DESC"
) {
  const db = await getDb();
  const rows = await db.query<TransactionRow>(
    `SELECT * FROM transactions WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows.map(toTransaction);
}

/** Total across all accounts (archived ones too): opening balances plus every transaction. */
export async function getBalance(): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ balance: number }>(
    `SELECT (SELECT COALESCE(SUM(opening_balance), 0) FROM accounts)
          + (SELECT COALESCE(SUM(price), 0) FROM transactions) AS balance`
  );
  return row?.balance ?? 0;
}

/** Sum of the current month's expenses (negative or 0). */
export async function getCurrentMonthExpensesSum(now = new Date()): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ total: number }>(
    "SELECT COALESCE(SUM(price), 0) AS total FROM transactions WHERE price < 0 AND strftime('%Y-%m', date) = ?",
    [toLocalIso(now).slice(0, 7)]
  );
  return row?.total ?? 0;
}

const STATS_COLUMNS =
  "COUNT(*) AS count, SUM(price) AS sum, AVG(price) AS avg, MAX(price) AS max, MIN(price) AS min";
const EMPTY_STATS: PeriodStats = { count: 0, sum: 0, avg: 0, max: 0, min: 0 };

/** Expense stats for each of the 12 months of a year (months without expenses are zeroed). */
export async function getMonthlyExpenseStats(year: number): Promise<(PeriodStats & { month: number })[]> {
  const db = await getDb();
  const rows = await db.query<PeriodStats & { month: number }>(
    `SELECT CAST(strftime('%m', date) AS INTEGER) AS month, ${STATS_COLUMNS}
     FROM transactions WHERE price <= 0 AND strftime('%Y', date) = ?
     GROUP BY month`,
    [String(year)]
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1) ?? { ...EMPTY_STATS, month: i + 1 });
}

/** Expense stats for each day of a month (days without expenses are zeroed). */
export async function getDailyExpenseStats(
  year: number,
  month: number
): Promise<(PeriodStats & { day: number })[]> {
  if (month < 1 || month > 12) throw new Error("Invalid month");
  const db = await getDb();
  const rows = await db.query<PeriodStats & { day: number }>(
    `SELECT CAST(strftime('%d', date) AS INTEGER) AS day, ${STATS_COLUMNS}
     FROM transactions WHERE price <= 0 AND strftime('%Y-%m', date) = ?
     GROUP BY day`,
    [`${year}-${String(month).padStart(2, "0")}`]
  );
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => byDay.get(i + 1) ?? { ...EMPTY_STATS, day: i + 1 });
}

/** Expense stats per tag, biggest spend first. min/max are by amount spent, as in the Go API. */
export async function getTagsStatistics(): Promise<TagStats[]> {
  const db = await getDb();
  return db.query<TagStats>(
    `SELECT tag.value AS tag, COUNT(*) AS count, SUM(price) AS sum, AVG(price) AS avg,
            MIN(price) AS max, MAX(price) AS min
     FROM transactions, json_each(transactions.tags) AS tag
     WHERE price <= 0
     GROUP BY tag.value
     ORDER BY sum ASC, count DESC`
  );
}

export async function getIncomeSpentPercentage(): Promise<
  { month: string; total_income: number; total_spent: number; spent_percentage: number }[]
> {
  const db = await getDb();
  return db.query(
    `WITH stats AS (
       SELECT strftime('%Y-%m', date) AS month,
              COALESCE(SUM(CASE WHEN price > 0 THEN price END), 0) AS total_income,
              ABS(COALESCE(SUM(CASE WHEN price <= 0 THEN price END), 0)) AS total_spent
       FROM transactions GROUP BY month ORDER BY month DESC LIMIT 12
     )
     SELECT month, total_income, total_spent,
            CASE WHEN total_income = 0 THEN 0
                 ELSE ROUND(total_spent * 100.0 / total_income, 2) END AS spent_percentage
     FROM stats ORDER BY month ASC`
  );
}

export async function getCumulativeBalancePerMonth(): Promise<
  { year_month: string; cumulative_balance: number }[]
> {
  const db = await getDb();
  return db.query(
    `WITH monthly AS (
       SELECT strftime('%Y-%m', date) AS year_month, SUM(price) AS monthly_balance
       FROM transactions GROUP BY year_month
     )
     SELECT year_month,
            SUM(monthly_balance) OVER (ORDER BY year_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
              AS cumulative_balance
     FROM monthly ORDER BY year_month`
  );
}

/** Every tag in use, most used first. */
export async function getAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.query<{ tag: string }>(
    `SELECT tag.value AS tag FROM transactions, json_each(transactions.tags) AS tag
     GROUP BY tag.value ORDER BY COUNT(*) DESC, tag.value`
  );
  return rows.map((r) => r.tag);
}

/** Sum of the current month's payments (positive or 0). */
export async function getCurrentMonthIncomeSum(now = new Date()): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ total: number }>(
    "SELECT COALESCE(SUM(price), 0) AS total FROM transactions WHERE price > 0 AND strftime('%Y-%m', date) = ?",
    [toLocalIso(now).slice(0, 7)]
  );
  return row?.total ?? 0;
}

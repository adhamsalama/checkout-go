import { getDb } from "../db";
import { SqlValue } from "../db/types";
import { normalizeDate, toLocalIso } from "../dates";
import { Expense, PeriodStats, TagStats } from "../types";

type TransactionRow = {
  id: number;
  name: string;
  price: number;
  date: string;
  tags: string | null;
  seller: string | null;
  note: string | null;
};

export type TransactionInput = {
  name: string;
  /** Always positive; expenses are negated on save. */
  price: number;
  sellerName?: string;
  comment?: string;
  tags?: string[];
  date?: string | Date;
};

export type TransactionUpdate = Partial<{
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
  };
}

async function insert(input: TransactionInput, price: number): Promise<Expense> {
  const db = await getDb();
  const date = normalizeDate(input.date);
  const tags = cleanTags(input.tags);
  const { lastId } = await db.run(
    "INSERT INTO transactions (name, price, date, tags, seller, note) VALUES (?, ?, ?, ?, ?, ?)",
    [input.name, price, date, JSON.stringify(tags), input.sellerName ?? "", input.comment ?? ""]
  );
  return (await getTransaction(lastId))!;
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
  const columns = Object.keys(fields);
  if (columns.length === 0) throw new Error("No fields to update");

  const db = await getDb();
  const { changes } = await db.run(
    `UPDATE transactions SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...Object.values(fields), id]
  );
  if (changes === 0) throw new Error("Transaction not found");
  return (await getTransaction(id))!;
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
  const db = await getDb();
  await db.run("DELETE FROM transactions WHERE id = ?", [id]);
  return transaction;
}

export async function getTransaction(id: number): Promise<Expense | null> {
  const db = await getDb();
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
  return list(where, params, filters.limit, filters.offset);
}

export function listPayments(opts: { limit?: number; offset?: number } = {}): Promise<Expense[]> {
  return list(["price > 0"], [], opts.limit, opts.offset);
}

async function list(where: string[], params: SqlValue[], limit = -1, offset = 0) {
  const db = await getDb();
  const rows = await db.query<TransactionRow>(
    `SELECT * FROM transactions WHERE ${where.join(" AND ")} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows.map(toTransaction);
}

export async function getBalance(): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ balance: number }>(
    "SELECT COALESCE(SUM(price), 0) AS balance FROM transactions"
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

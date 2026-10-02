import { getDb } from "../db";
import { SqlValue } from "../db/types";
import { addDays, parseDate, toDateInput } from "../dates";
import { Expense } from "../types";
import { cleanTags, listWhere } from "./transactions";

/**
 * What the Stats screen looks at. `from` and `to` are inclusive "YYYY-MM-DD" days (open-ended when
 * missing), `query` matches name, seller or comment, and an expense must have every tag in `tags`.
 * All amounts returned here are positive amounts spent.
 */
export type StatsFilter = { from?: string; to?: string; query?: string; tags?: string[] };

export type Bucket = "day" | "week" | "month" | "year";

function expenseWhere(f: StatsFilter): { where: string[]; params: SqlValue[] } {
  const where = ["price <= 0"];
  const params: SqlValue[] = [];
  if (f.from) {
    where.push("date >= ?");
    params.push(`${f.from}T00:00:00`);
  }
  if (f.to) {
    where.push("date < ?");
    params.push(`${addDays(f.to, 1)}T00:00:00`);
  }
  const query = f.query?.trim();
  if (query) {
    where.push("(name LIKE ? OR seller LIKE ? OR note LIKE ?)");
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  for (const tag of cleanTags(f.tags)) {
    where.push("EXISTS (SELECT 1 FROM json_each(transactions.tags) WHERE value = ?)");
    params.push(tag);
  }
  return { where, params };
}

export type StatsSummary = {
  spent: number;
  count: number;
  /** Days with at least one expense. */
  activeDays: number;
  /** "YYYY-MM-DD" of the first matching expense, or null if none. */
  firstDay: string | null;
  biggestDay: { day: string; spent: number } | null;
  /** Payments in the date range; the search and tag filter don't apply to them. */
  income: number;
};

export async function getStatsSummary(f: StatsFilter): Promise<StatsSummary> {
  const db = await getDb();
  const { where, params } = expenseWhere(f);
  const sql = where.join(" AND ");
  const [totals] = await db.query<{ spent: number; count: number; activeDays: number; first: string | null }>(
    `SELECT COALESCE(-SUM(price), 0) AS spent, COUNT(*) AS count,
            COUNT(DISTINCT substr(date, 1, 10)) AS activeDays, MIN(date) AS first
     FROM transactions WHERE ${sql}`,
    params
  );
  const [biggest] = await db.query<{ day: string; spent: number }>(
    `SELECT substr(date, 1, 10) AS day, -SUM(price) AS spent FROM transactions WHERE ${sql}
     GROUP BY day ORDER BY spent DESC, day DESC LIMIT 1`,
    params
  );
  const range = expenseWhere({ from: f.from, to: f.to });
  range.where[0] = "price > 0";
  const [income] = await db.query<{ total: number }>(
    `SELECT COALESCE(SUM(price), 0) AS total FROM transactions WHERE ${range.where.join(" AND ")}`,
    range.params
  );
  return {
    spent: totals.spent,
    count: totals.count,
    activeDays: totals.activeDays,
    firstDay: totals.first?.slice(0, 10) ?? null,
    biggestDay: biggest && biggest.spent > 0 ? biggest : null,
    income: income.total,
  };
}

// Each bucket is keyed by its first day. Weeks start on Monday: 'weekday 0' moves to the next
// Sunday (or stays on one), and six days back from there is that week's Monday.
const BUCKET_SQL: Record<Bucket, string> = {
  day: "substr(date, 1, 10)",
  week: "date(substr(date, 1, 10), 'weekday 0', '-6 days')",
  month: "substr(date, 1, 7) || '-01'",
  year: "substr(date, 1, 4) || '-01-01'",
};

/** The first day of the bucket containing `day`. */
export function bucketStart(day: string, bucket: Bucket): string {
  const d = parseDate(day);
  if (bucket === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (bucket === "month") d.setDate(1);
  if (bucket === "year") d.setMonth(0, 1);
  return toDateInput(d);
}

/** The first day of the bucket after the one starting on `start`. */
export function nextBucket(start: string, bucket: Bucket): string {
  const d = parseDate(start);
  if (bucket === "day") d.setDate(d.getDate() + 1);
  if (bucket === "week") d.setDate(d.getDate() + 7);
  if (bucket === "month") d.setMonth(d.getMonth() + 1);
  if (bucket === "year") d.setFullYear(d.getFullYear() + 1);
  return toDateInput(d);
}

export type SeriesPoint = { start: string; spent: number; count: number };

/** Spending per bucket from `from` to `to` (both required), with empty buckets included. */
export async function getSpendingSeries(
  f: StatsFilter & { from: string; to: string },
  bucket: Bucket
): Promise<SeriesPoint[]> {
  const db = await getDb();
  const { where, params } = expenseWhere(f);
  const rows = await db.query<SeriesPoint>(
    `SELECT ${BUCKET_SQL[bucket]} AS start, -SUM(price) AS spent, COUNT(*) AS count
     FROM transactions WHERE ${where.join(" AND ")} GROUP BY start`,
    params
  );
  const byStart = new Map(rows.map((r) => [r.start, r]));
  const points: SeriesPoint[] = [];
  for (let s = bucketStart(f.from, bucket); s <= f.to; s = nextBucket(s, bucket)) {
    points.push(byStart.get(s) ?? { start: s, spent: 0, count: 0 });
  }
  return points;
}

/** Total spent on each weekday, Monday first. */
export async function getWeekdaySpending(f: StatsFilter): Promise<number[]> {
  const db = await getDb();
  const { where, params } = expenseWhere(f);
  const rows = await db.query<{ weekday: number; spent: number }>(
    `SELECT CAST(strftime('%w', date) AS INTEGER) AS weekday, -SUM(price) AS spent
     FROM transactions WHERE ${where.join(" AND ")} GROUP BY weekday`,
    params
  );
  const totals = Array(7).fill(0);
  // strftime's %w counts from Sunday = 0.
  for (const r of rows) totals[(r.weekday + 6) % 7] = r.spent;
  return totals;
}

export type TagSpending = { tags: string[]; spent: number; count: number };

/**
 * Spending by tag, biggest first, with untagged expenses as `tags: []`. By default each expense
 * counts once, under its exact set of tags. With `eachTag` it counts in full under every tag it
 * has, so the rows overlap.
 */
export async function getTagSpending(f: StatsFilter, eachTag = false): Promise<TagSpending[]> {
  const db = await getDb();
  const { where, params } = expenseWhere(f);
  const sql = where.join(" AND ");
  let rows: TagSpending[];
  if (eachTag) {
    const tagged = await db.query<{ tag: string; spent: number; count: number }>(
      `SELECT tag.value AS tag, -SUM(price) AS spent, COUNT(*) AS count
       FROM transactions, json_each(transactions.tags) AS tag WHERE ${sql} GROUP BY tag.value`,
      params
    );
    const [untagged] = await db.query<{ spent: number | null; count: number }>(
      `SELECT -SUM(price) AS spent, COUNT(*) AS count FROM transactions
       WHERE ${sql} AND json_array_length(tags) = 0`,
      params
    );
    rows = tagged.map((r) => ({ tags: [r.tag], spent: r.spent, count: r.count }));
    if (untagged.count > 0) rows.push({ tags: [], spent: untagged.spent ?? 0, count: untagged.count });
  } else {
    // Rows store tags in the order they were typed, so merge the same set in a different order here.
    const raw = await db.query<{ tags: string; spent: number; count: number }>(
      `SELECT tags, -SUM(price) AS spent, COUNT(*) AS count FROM transactions WHERE ${sql} GROUP BY tags`,
      params
    );
    const merged = new Map<string, TagSpending>();
    for (const r of raw) {
      let tags: string[] = [];
      try {
        tags = [...new Set(cleanTags(JSON.parse(r.tags)))].sort();
      } catch {
        // Unparseable tags count as untagged.
      }
      const key = JSON.stringify(tags);
      const row = merged.get(key) ?? { tags, spent: 0, count: 0 };
      row.spent += r.spent;
      row.count += r.count;
      merged.set(key, row);
    }
    rows = [...merged.values()];
  }
  return rows.sort((a, b) => b.spent - a.spent || b.count - a.count);
}

export type NameSpending = { name: string; spent: number; count: number };

/** The most frequent expense names (ignoring case and surrounding spaces), most frequent first. */
export async function getTopNames(f: StatsFilter, limit = 5): Promise<NameSpending[]> {
  const db = await getDb();
  const { where, params } = expenseWhere(f);
  return db.query<NameSpending>(
    `SELECT trim(name) AS name, -SUM(price) AS spent, COUNT(*) AS count
     FROM transactions WHERE ${where.join(" AND ")} AND trim(name) != ''
     GROUP BY lower(trim(name)) ORDER BY count DESC, spent DESC LIMIT ?`,
    [...params, limit]
  );
}

/** Matching expenses, most expensive first. */
export function listLargestExpenses(
  f: StatsFilter,
  page: { limit?: number; offset?: number } = {}
): Promise<Expense[]> {
  const { where, params } = expenseWhere(f);
  return listWhere(where, params, page.limit, page.offset, "price ASC, date DESC, id DESC");
}

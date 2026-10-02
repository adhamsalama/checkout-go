import { getDb } from "../db";
import { addDays } from "../dates";

/** `month` is "YYYY-MM". */
export type ForecastPoint = { month: string; balance: number };

export type BalanceForecast = {
  /** The balance at the end of each month, ending with today's balance for the current month. */
  history: ForecastPoint[];
  /**
   * Today's balance, then that plus the average net for each month ahead. Empty without a
   * complete month to average.
   */
  projection: ForecastPoint[];
  /** Average monthly net (payments minus expenses) of the complete months, or null if none. */
  averageNet: number | null;
  /** How many complete months the average covers. */
  months: number;
};

/** Moves a "YYYY-MM" month by n months. */
export function shiftMonth(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Total balance across all accounts over the last `history` months (up to `today`), and a
 * straight-line projection `ahead` months on, at the average net of the last `window` complete
 * months. Transfers don't change the total, so they're ignored. Null when there are no transactions.
 */
export async function getBalanceForecast(
  today: string,
  { history = 12, ahead = 12, window = 6 } = {}
): Promise<BalanceForecast | null> {
  const db = await getDb();
  const [{ opening }] = await db.query<{ opening: number }>(
    "SELECT COALESCE(SUM(opening_balance), 0) AS opening FROM accounts"
  );
  const rows = await db.query<{ month: string; net: number }>(
    `SELECT substr(date, 1, 7) AS month, SUM(price) AS net FROM transactions
     WHERE date < ? GROUP BY month ORDER BY month`,
    [`${addDays(today, 1)}T00:00:00`]
  );
  if (rows.length === 0) return null;
  const net = new Map(rows.map((r) => [r.month, r.net]));
  const current = today.slice(0, 7);
  const first = rows[0].month;

  const start = [first, shiftMonth(current, 1 - history)].sort()[1];
  let balance = opening + rows.filter((r) => r.month < start).reduce((sum, r) => sum + r.net, 0);
  const past: ForecastPoint[] = [];
  for (let m = start; m <= current; m = shiftMonth(m, 1)) {
    balance += net.get(m) ?? 0;
    past.push({ month: m, balance });
  }

  let months = 0;
  let total = 0;
  for (let m = [first, shiftMonth(current, -window)].sort()[1]; m < current; m = shiftMonth(m, 1)) {
    months++;
    total += net.get(m) ?? 0;
  }
  const averageNet = months > 0 ? total / months : null;
  const projection =
    averageNet === null
      ? []
      : Array.from({ length: ahead + 1 }, (_, k) => ({
          month: shiftMonth(current, k),
          balance: balance + k * averageNet,
        }));
  return { history: past, projection, averageNet, months };
}

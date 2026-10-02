import type { Database } from "sql.js";
import { Backup, parseBackup } from "./backup";

/** Users present in a legacy Go backend database, with how many transactions each has. */
export type LegacyUser = { userId: number; username: string | null; transactions: number };

export type LegacyDatabase = {
  users: LegacyUser[];
  /** Builds a backup containing one user's data. */
  toBackup(userId: number): Backup;
  close(): void;
};

type Row = Record<string, unknown>;

/**
 * Opens a sqlite3.db file from the old Go backend (read in memory with sql.js; the file
 * is not modified) so its data can be restored with restoreBackup.
 */
export async function openLegacyDatabase(
  bytes: Uint8Array,
  locateWasm?: () => string
): Promise<LegacyDatabase> {
  const [{ default: initSqlJs }, wasmUrl] = await Promise.all([
    import("sql.js"),
    locateWasm ? null : import("sql.js/dist/sql-wasm.wasm?url").then((m) => m.default),
  ]);
  locateWasm ??= () => wasmUrl!;
  const SQL = await initSqlJs({ locateFile: locateWasm });
  let db: Database;
  try {
    db = new SQL.Database(bytes);
  } catch {
    throw new Error("Not a SQLite database file");
  }

  const all = (sql: string, params: (string | number)[] = []): Row[] => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: Row[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  let tables: Set<string>;
  try {
    tables = new Set(all("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => String(r.name)));
  } catch {
    db.close();
    throw new Error("Not a SQLite database file");
  }
  if (!tables.has("transactions")) {
    db.close();
    throw new Error("This database has no transactions table; is it from the Checkout Go backend?");
  }

  const userIds = new Set<number>();
  for (const table of ["transactions", "monthly_budgets", "tagged_budgets"]) {
    if (!tables.has(table)) continue;
    for (const r of all(`SELECT DISTINCT user_id FROM ${table} WHERE user_id IS NOT NULL`)) {
      userIds.add(Number(r.user_id));
    }
  }
  const usernames = new Map<number, string>();
  if (tables.has("users")) {
    for (const r of all("SELECT * FROM users")) {
      const name = r.username ?? r.email ?? r.name;
      if (r.id !== undefined && name) usernames.set(Number(r.id), String(name));
    }
  }
  const txCounts = new Map(
    all("SELECT user_id, COUNT(*) AS n FROM transactions GROUP BY user_id").map((r) => [
      Number(r.user_id),
      Number(r.n),
    ])
  );
  const users = [...userIds].sort((a, b) => a - b).map((userId) => ({
    userId,
    username: usernames.get(userId) ?? null,
    transactions: txCounts.get(userId) ?? 0,
  }));

  return {
    users,
    toBackup(userId) {
      const byUser = (table: string) =>
        tables.has(table) ? all(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id`, [userId]) : [];
      return parseBackup({
        app: "checkout",
        // The old server had no accounts; parsing a version 1 backup puts everything in "Main".
        version: 1,
        exportedAt: "",
        transactions: byUser("transactions"),
        monthlyBudgets: byUser("monthly_budgets"),
        taggedBudgets: byUser("tagged_budgets"),
      });
    },
    close: () => db.close(),
  };
}

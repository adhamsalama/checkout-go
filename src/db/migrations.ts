import { Db } from "./types";

// Dates are stored as local time "YYYY-MM-DDTHH:MM:SS" (see src/dates.ts) so SQLite's
// strftime groups by the user's calendar day/month. tags is a JSON array of strings.
//
// Never edit a migration that has shipped; append a new one. The version lives in its own table
// because the SQLite plugin (and jeep-sqlite on web) use PRAGMA user_version for their own versioning.
export const MIGRATIONS: ((db: Db) => Promise<void>)[] = [
  // 1: the Go backend's tables, minus user_id. Installs from before migrations existed already have
  // these, so the statements must stay idempotent.
  async (db) => {
    await db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      tags TEXT,
      seller TEXT,
      note TEXT
    )`);
    await db.run("CREATE INDEX IF NOT EXISTS transactions_date ON transactions (date)");
    await db.run(`CREATE TABLE IF NOT EXISTS monthly_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      date TEXT NOT NULL
    )`);
    await db.run(`CREATE TABLE IF NOT EXISTS tagged_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      tag TEXT NOT NULL,
      date TEXT NOT NULL
    )`);
  },

  // 2: accounts. Every transaction belongs to one; existing ones go to "Main", the default.
  // account_id stays nullable because SQLite can't add a NOT NULL column without a constant default;
  // the API always sets it.
  async (db) => {
    await db.run(`CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      opening_balance REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
    // At most one default; the API keeps it at exactly one.
    await db.run("CREATE UNIQUE INDEX accounts_one_default ON accounts (is_default) WHERE is_default = 1");
    await db.run("INSERT INTO accounts (id, name, is_default) VALUES (1, 'Main', 1)");
    await db.run("ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts (id)");
    await db.run("UPDATE transactions SET account_id = 1");
    await db.run("CREATE INDEX transactions_account ON transactions (account_id, date)");
  },
];

export const LATEST_VERSION = MIGRATIONS.length;

/** Runs pending migrations, each atomically with its version bump. Stops at the first failure. */
export async function migrate(db: Db): Promise<void> {
  await db.run("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  let [row] = await db.query<{ version: number }>("SELECT version FROM schema_version");
  if (!row) {
    await db.run("INSERT INTO schema_version (version) VALUES (0)");
    row = { version: 0 };
  }
  for (let v = row.version; v < MIGRATIONS.length; v++) {
    await db.transaction(async (tx) => {
      await MIGRATIONS[v](tx);
      await tx.run("UPDATE schema_version SET version = ?", [v + 1]);
    });
  }
}

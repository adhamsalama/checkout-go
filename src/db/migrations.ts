// Same tables as the Go backend, minus user_id: the app is single-user and offline.
// Dates are stored as local time "YYYY-MM-DDTHH:MM:SS" (see src/dates.ts) so SQLite's
// strftime groups by the user's calendar day/month. tags is a JSON array of strings.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    date TEXT NOT NULL,
    tags TEXT,
    seller TEXT,
    note TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS transactions_date ON transactions (date)`,
  `CREATE TABLE IF NOT EXISTS monthly_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    date TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tagged_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    tag TEXT NOT NULL,
    date TEXT NOT NULL
  )`,
];

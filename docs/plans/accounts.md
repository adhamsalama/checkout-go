# Plan: separate accounts with a default account

Status: implemented (all three steps in one change) with the recommended decisions. The schema version lives in
a `schema_version` table instead of `PRAGMA user_version`, because the SQLite plugin and jeep-sqlite use
`user_version` for their own versioning. Not yet verified on a device.

## Goal

Track money per account (for example "Bank", "Cash", "Credit card") instead of one global balance. Every
transaction belongs to exactly one account. One account is the **default**: the add-expense sheet preselects it,
so the common case stays one tap. The others are one tap away.

## Decisions needed before starting

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Do new **payments** also preselect the default account, or only expenses? | Use the same default for both. A separate "default for income" setting can come later if it's missed. |
| 2 | How does an account's balance start out matching reality? | An `opening_balance` per account, not an adjustment transaction. Adjustments would show up as fake spending or income in stats and budgets. |
| 3 | Are transfers between accounts (for example a cash withdrawal) in scope? | Not in v1, but design for them (see "Later: transfers"). Until then, record a move as an expense in one account and a payment in the other, which counts as spending. |
| 4 | Where does account management live? The tab bar already has 5 tabs. | Tapping the balance card on Expenses pushes an Accounts screen (`/expenses/accounts`), like Search. |
| 5 | Are budgets per account? | No. Budgets stay global, because spending is spending whichever account paid. |

The plan below assumes the recommendations.

## Prerequisite: a migration runner

The schema has only `CREATE TABLE IF NOT EXISTS`, which can't add a column to existing installs. Add this first,
as its own change:

- `src/db/migrations.ts`: an ordered list `MIGRATIONS: ((db) => Promise<void>)[]` and `migrate(db)`. `migrate`
  reads `PRAGMA user_version`, runs each pending migration with its `PRAGMA user_version = n` inside one
  transaction, and stops at the first failure.
- Migration 1 is the current `SCHEMA` (idempotent, so existing installs at `user_version` 0 pass through it).
- `openCapacitorDb()` and `createNodeDb()` call `migrate` instead of looping over `SCHEMA`.
- Tests: a fresh DB reaches the latest version, re-running is a no-op, and a DB with rows at version 0 keeps
  its rows.

Note: the Capacitor plugin's `execute`/`run` take their own transaction flag (see `wrap()` in `capacitor.ts`).
`migrate` must go through `db.transaction` so the statements aren't each wrapped separately.

## Data model (migration 2)

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
-- At most one default; the API keeps it at exactly one.
CREATE UNIQUE INDEX accounts_one_default ON accounts (is_default) WHERE is_default = 1;

INSERT INTO accounts (id, name, is_default) VALUES (1, 'Main', 1);
ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts (id);
UPDATE transactions SET account_id = 1;
CREATE INDEX transactions_account ON transactions (account_id, date);
```

- `account_id` is nullable at the SQL level, because SQLite can't `ADD COLUMN ... NOT NULL` without a constant
  default, and a default of `1` would silently attach future bad inserts to "Main". The API layer always sets it,
  and a test asserts there are no `NULL`s after every write path.
- Don't rely on `REFERENCES` being enforced (`PRAGMA foreign_keys` is off by default, and the plugin's setting is
  unverified). The API checks that the account exists.
- The default is a column with a partial unique index, not a settings key, so it travels with backups and can't
  point at a deleted account.

## API (`src/api/accounts.ts`, plus changes to `transactions.ts`)

New:

- `listAccounts({ includeArchived })` returns `Account[]` with `balance = opening_balance + SUM(price)`, ordered
  by `sort_order, id`.
- `getDefaultAccount()`.
- `createAccount({ name, openingBalance })` and `updateAccount(id, { name, openingBalance, archived })`.
- `setDefaultAccount(id)`: in one transaction, clear the old default and then set the new one. It rejects
  archived accounts.
- `deleteAccount(id)`: allowed only if the account has no transactions and isn't the default. Otherwise it throws
  an error the UI shows ("Move or delete its transactions, or archive it").
- Archiving the default account is rejected; the user has to pick another default first.

Changes:

- `TransactionInput.accountId?: number`. When omitted, `insert()` uses the default account, so existing callers
  and tests keep working. An unknown or archived id throws.
- `TransactionUpdate.accountId?: number` lets editing move a transaction to another account.
- `Expense` gains `accountId: number`, and `toTransaction` maps `account_id`.
- `getBalance()` becomes `SUM(opening_balance) + SUM(price)` across all accounts, archived ones included, so the
  total still matches real money.
- `ExpenseFilters.accountIds?: number[]` and the same option on `listPayments`.
- Stats, budgets and tag queries don't change; they stay global.

## Backup format (version 2)

- `BACKUP_VERSION = 2`. `Backup` gains `accounts: { id, name, openingBalance, isDefault, archived, sortOrder }[]`,
  and each transaction gains `accountId`.
- `parseBackup` validates that exactly one account is the default, that it isn't archived, and that every
  `accountId` refers to an account in the file.
- **v1 files still import.** `parseBackup` upgrades them to one `Main` default account (id 1) and puts every
  transaction in it.
- `restoreBackup` deletes and reinserts `accounts` first, keeping ids, inside the existing transaction.
  `ImportSummary` and the import prompt include the account count.
- `legacy.ts` `toBackup` emits v2 with a single `Main` account.

## UI

- **Expenses summary card:** shows the total balance as today. With more than one account it adds a compact
  per-account line (`Bank $1,200 · Cash $80`). Tapping the card opens Accounts.
- **Accounts screen** (`/expenses/accounts`, pushed in the Expenses tab, with a back button):
  - An `IonList` of active accounts with their balances, and the default marked with a "Default" badge.
    Archived accounts go in a collapsed section underneath.
  - The FAB adds an account. Tapping a row opens a `<Sheet>` with name, opening balance, a "Default account"
    toggle (disabled while it's on, since you change the default by turning it on elsewhere), Archive, and Delete.
  - Delete uses `useDialogs().confirmDelete`. If it's blocked, the API error explains why.
- **Transaction sheet:** an "Account" chip row (like the tag chips), preselected to the default account for new
  transactions and to the transaction's own account when editing. It's hidden when only one active account
  exists, so single-account use looks exactly like today.
- **Rows:** `TransactionRow` adds the account name to the subtitle only when more than one account exists.
- **Search:** an account filter chip row, using the same component as the sheet.
- All writes call `notifyChanged()` as usual.

## Tests (vitest, node:sqlite)

- Migration 2 on a version-1 DB with rows: every row gets `account_id = 1`, `Main` is the default, and the
  balance is unchanged.
- An expense created without `accountId` lands in the default account. After `setDefaultAccount(2)` it lands
  in account 2.
- Exactly one default at all times: `setDefaultAccount` swaps it atomically, and archiving or deleting the
  default is rejected.
- `deleteAccount` is rejected while the account has transactions.
- Per-account balances include the opening balance, and the total equals their sum.
- Backup round trip with several accounts keeps ids and the default. A v1 file imports into a single default
  account. Files with a bad `accountId` or two defaults are rejected.
- No `NULL` `account_id` after create, update, restore, or legacy import.

## Rollout and verification

1. Migration runner (its own PR). It changes nothing visible.
2. Accounts: schema, API, backup v2 and tests, with no UI. Behaviour is unchanged because everything is in
   `Main`.
3. UI: the Accounts screen, the picker in the sheet, the summary, and search.

**Device:** the migration rewrites the real on-device database, and the browser can't test that. Before
installing step 2 on the phone, export a backup. After installing, check that the balance and transaction count
are unchanged and that a new expense lands in `Main`. If something is off, reinstall the previous APK and import
the backup. That works because v1 backups import into both old and new builds, though a v2 backup won't import
into an old build.

## Later: transfers

Store transfers in their own table, not as transaction pairs, so stats, budgets and tag queries never see them:

```sql
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_account_id INTEGER NOT NULL,
  to_account_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  note TEXT
);
```

Account balances then add incoming and subtract outgoing transfers, and the total balance is unaffected. This is
also the natural place for a "Transfer" action on the Accounts screen and for backup version 3.

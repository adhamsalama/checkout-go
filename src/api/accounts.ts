import { getDb } from "../db";
import { Account } from "../types";

type AccountRow = {
  id: number;
  name: string;
  opening_balance: number;
  is_default: number;
  archived: number;
  sort_order: number;
  balance: number;
};

export type AccountInput = { name: string; openingBalance?: number };
export type AccountUpdate = Partial<{ name: string; openingBalance: number; archived: boolean }>;

const SELECT = `SELECT accounts.*,
  opening_balance + COALESCE((SELECT SUM(price) FROM transactions WHERE account_id = accounts.id), 0) AS balance
  FROM accounts`;

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    openingBalance: row.opening_balance,
    isDefault: row.is_default === 1,
    archived: row.archived === 1,
    sortOrder: row.sort_order,
    balance: row.balance,
  };
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter an account name");
  return trimmed;
}

function requireAmount(value: number): number {
  if (!isFinite(value)) throw new Error("Enter a valid opening balance");
  return value;
}

/** Accounts in display order: default first, then by sort order. */
export async function listAccounts({ includeArchived = false } = {}): Promise<Account[]> {
  const db = await getDb();
  const rows = await db.query<AccountRow>(
    `${SELECT} ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY is_default DESC, sort_order, id`
  );
  return rows.map(toAccount);
}

export async function getAccount(id: number): Promise<Account | null> {
  const db = await getDb();
  const [row] = await db.query<AccountRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? toAccount(row) : null;
}

export async function getDefaultAccount(): Promise<Account> {
  const db = await getDb();
  const [row] = await db.query<AccountRow>(`${SELECT} WHERE is_default = 1`);
  if (!row) throw new Error("No default account");
  return toAccount(row);
}

/** The account a new transaction goes to: `id` if given (it must exist and be active), else the default. */
export async function resolveAccountId(id: number | undefined): Promise<number> {
  if (id === undefined) return (await getDefaultAccount()).id;
  const account = await getAccount(id);
  if (!account) throw new Error("Account not found");
  if (account.archived) throw new Error(`"${account.name}" is archived`);
  return account.id;
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const db = await getDb();
  const [{ next }] = await db.query<{ next: number }>(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM accounts"
  );
  const { lastId } = await db.run(
    "INSERT INTO accounts (name, opening_balance, sort_order) VALUES (?, ?, ?)",
    [cleanName(input.name), requireAmount(input.openingBalance ?? 0), next]
  );
  return (await getAccount(lastId))!;
}

export async function updateAccount(id: number, patch: AccountUpdate): Promise<Account> {
  const account = await getAccount(id);
  if (!account) throw new Error("Account not found");
  if (patch.archived && account.isDefault) {
    throw new Error("The default account can't be archived. Make another account the default first.");
  }
  const db = await getDb();
  await db.run("UPDATE accounts SET name = ?, opening_balance = ?, archived = ? WHERE id = ?", [
    patch.name !== undefined ? cleanName(patch.name) : account.name,
    patch.openingBalance !== undefined ? requireAmount(patch.openingBalance) : account.openingBalance,
    (patch.archived ?? account.archived) ? 1 : 0,
    id,
  ]);
  return (await getAccount(id))!;
}

/** Makes `id` the one default account. */
export async function setDefaultAccount(id: number): Promise<void> {
  const account = await getAccount(id);
  if (!account) throw new Error("Account not found");
  if (account.archived) throw new Error("An archived account can't be the default");
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("UPDATE accounts SET is_default = 0 WHERE is_default = 1");
    await tx.run("UPDATE accounts SET is_default = 1 WHERE id = ?", [id]);
  });
}

/** Deletes an account that has no transactions and isn't the default. */
export async function deleteAccount(id: number): Promise<void> {
  const account = await getAccount(id);
  if (!account) throw new Error("Account not found");
  if (account.isDefault) {
    throw new Error("The default account can't be deleted. Make another account the default first.");
  }
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE account_id = ?", [
    id,
  ]);
  if (n > 0) {
    throw new Error(
      `"${account.name}" has ${n} ${n === 1 ? "transaction" : "transactions"}. Move or delete them, or archive the account instead.`
    );
  }
  await db.run("DELETE FROM accounts WHERE id = ?", [id]);
}

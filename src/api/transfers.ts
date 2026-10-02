import { getDb } from "../db";
import { Db, SqlValue } from "../db/types";
import { normalizeDate } from "../dates";
import { Transfer } from "../types";
import { resolveAccountId } from "./accounts";
import { logChange } from "./audit";

type TransferRow = {
  id: number;
  from_account_id: number;
  to_account_id: number;
  from_name: string;
  to_name: string;
  amount: number;
  date: string;
  note: string;
  reversal_of: number | null;
  reversed_by: number | null;
};

export type TransferInput = {
  fromAccountId: number;
  toAccountId: number;
  /** Must be positive. */
  amount: number;
  date?: string | Date;
  note?: string;
};

const SELECT = `SELECT t.*, f.name AS from_name, a.name AS to_name,
  (SELECT r.id FROM transfers r WHERE r.reversal_of = t.id) AS reversed_by
  FROM transfers t JOIN accounts f ON f.id = t.from_account_id JOIN accounts a ON a.id = t.to_account_id`;

function toTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    fromName: row.from_name,
    toName: row.to_name,
    amount: row.amount,
    date: row.date,
    note: row.note,
    reversalOf: row.reversal_of,
    reversedBy: row.reversed_by,
  };
}

/** What the audit log keeps: the transfer as made. reversedBy is left out, since it changes later. */
function snapshot({ reversedBy: _, ...t }: Transfer) {
  return t;
}

export async function getTransfer(id: number, db?: Db): Promise<Transfer | null> {
  db ??= await getDb();
  const [row] = await db.query<TransferRow>(`${SELECT} WHERE t.id = ?`, [id]);
  return row ? toTransfer(row) : null;
}

/** Transfers newest first, optionally only those into or out of one account. */
export async function listTransfers(
  opts: { limit?: number; offset?: number; accountId?: number } = {}
): Promise<Transfer[]> {
  const db = await getDb();
  const params: SqlValue[] = [];
  let where = "";
  if (opts.accountId !== undefined) {
    where = "WHERE ? IN (t.from_account_id, t.to_account_id)";
    params.push(opts.accountId);
  }
  const rows = await db.query<TransferRow>(`${SELECT} ${where} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`, [
    ...params,
    opts.limit ?? -1,
    opts.offset ?? 0,
  ]);
  return rows.map(toTransfer);
}

async function insert(input: TransferInput, reversalOf: number | null): Promise<Transfer> {
  if (!(input.amount > 0) || !isFinite(input.amount)) throw new Error("Enter an amount greater than 0");
  if (input.fromAccountId === input.toAccountId) throw new Error("Pick two different accounts");
  const from = await resolveAccountId(input.fromAccountId);
  const to = await resolveAccountId(input.toAccountId);
  const date = normalizeDate(input.date);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { lastId } = await tx.run(
      "INSERT INTO transfers (from_account_id, to_account_id, amount, date, note, reversal_of) VALUES (?, ?, ?, ?, ?, ?)",
      [from, to, input.amount, date, input.note?.trim() ?? "", reversalOf]
    );
    const created = (await getTransfer(lastId, tx))!;
    await logChange(tx, "transfer", "create", created.id, null, snapshot(created));
    return created;
  });
}

/** Moves money from one active account to another. */
export function createTransfer(input: TransferInput): Promise<Transfer> {
  return insert(input, null);
}

/** Undoes a transfer with an opposite one, dated now. Each transfer can be reversed once. */
export async function reverseTransfer(id: number): Promise<Transfer> {
  const original = await getTransfer(id);
  if (!original) throw new Error("Transfer not found");
  if (original.reversedBy !== null) throw new Error("This transfer was already reversed");
  return insert(
    { fromAccountId: original.toAccountId, toAccountId: original.fromAccountId, amount: original.amount },
    original.id
  );
}

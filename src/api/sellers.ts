import { getDb } from "../db";
import { logChange } from "./audit";

/** Every seller in use with how many transactions have it, most used first. */
export async function listSellerCounts(): Promise<{ name: string; count: number }[]> {
  const db = await getDb();
  return db.query(
    `SELECT seller AS name, COUNT(*) AS count FROM transactions WHERE trim(COALESCE(seller, '')) != ''
     GROUP BY seller ORDER BY count DESC, seller`
  );
}

/** Renames a seller on every transaction; renaming to an existing seller merges them. Returns the count. */
export async function renameSeller(from: string, to: string): Promise<number> {
  const target = to.trim();
  if (!target) throw new Error("Enter a seller name");
  if (target === from) return 0;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { changes } = await tx.run("UPDATE transactions SET seller = ? WHERE seller = ?", [target, from]);
    if (changes > 0) await logChange(tx, "seller", "rename", null, { name: from }, { name: target, transactions: changes });
    return changes;
  });
}

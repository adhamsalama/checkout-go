import { getDb } from "../db";
import { cleanTags } from "./transactions";

/** Every tag in use with how many transactions have it, most used first. */
export async function listTagCounts(): Promise<{ name: string; count: number }[]> {
  const db = await getDb();
  return db.query(
    `SELECT tag.value AS name, COUNT(*) AS count FROM transactions, json_each(transactions.tags) AS tag
     GROUP BY tag.value ORDER BY count DESC, tag.value`
  );
}

/**
 * Renames a tag on every transaction and tag budget, atomically. Renaming to a tag that already exists
 * merges them; a transaction that had both keeps it once. Returns how many transactions changed.
 */
export async function renameTag(from: string, to: string): Promise<number> {
  const target = to.trim();
  if (!target) throw new Error("Enter a tag name");
  if (target === from) return 0;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<{ id: number; tags: string }>(
      "SELECT id, tags FROM transactions WHERE EXISTS (SELECT 1 FROM json_each(transactions.tags) WHERE value = ?)",
      [from]
    );
    for (const row of rows) {
      const tags = cleanTags(JSON.parse(row.tags) as string[]).map((t) => (t === from ? target : t));
      await tx.run("UPDATE transactions SET tags = ? WHERE id = ?", [JSON.stringify([...new Set(tags)]), row.id]);
    }
    await tx.run("UPDATE tagged_budgets SET tag = ? WHERE tag = ?", [target, from]);
    return rows.length;
  });
}

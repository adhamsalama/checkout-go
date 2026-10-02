import { getDb } from "../db";
import { Db } from "../db/types";
import { normalizeDate, toLocalIso } from "../dates";
import { MonthlyBudget, TaggedBudget, TaggedBudgetStats } from "../types";
import { logChange } from "./audit";

export type BudgetInput = { name: string; value: number };
export type TaggedBudgetInput = BudgetInput & { tag: string };

function validateValue(value: number) {
  if (!(value > 0)) throw new Error("Budget value must be greater than 0");
}

/** There is at most one monthly budget. Pass `db` when reading inside a transaction. */
export async function getMonthlyBudget(db?: Db): Promise<MonthlyBudget | null> {
  db ??= await getDb();
  const [row] = await db.query<MonthlyBudget>("SELECT * FROM monthly_budgets ORDER BY id LIMIT 1");
  return row ?? null;
}

export async function saveMonthlyBudget(input: BudgetInput): Promise<MonthlyBudget> {
  validateValue(input.value);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const existing = await getMonthlyBudget(tx);
    if (existing) {
      await tx.run("UPDATE monthly_budgets SET name = ?, value = ? WHERE id = ?", [
        input.name,
        input.value,
        existing.id,
      ]);
    } else {
      await tx.run("INSERT INTO monthly_budgets (name, value, date) VALUES (?, ?, ?)", [
        input.name,
        input.value,
        normalizeDate(),
      ]);
    }
    const saved = (await getMonthlyBudget(tx))!;
    await logChange(tx, "monthlyBudget", existing ? "update" : "create", saved.id, existing, saved);
    return saved;
  });
}

export async function deleteMonthlyBudget(): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const existing = await getMonthlyBudget(tx);
    if (!existing) return;
    await tx.run("DELETE FROM monthly_budgets");
    await logChange(tx, "monthlyBudget", "delete", existing.id, existing, null);
  });
}

export async function getTaggedBudgets(): Promise<TaggedBudget[]> {
  const db = await getDb();
  return db.query<TaggedBudget>("SELECT * FROM tagged_budgets ORDER BY id");
}

async function getTaggedBudget(id: number, db?: Db): Promise<TaggedBudget | null> {
  db ??= await getDb();
  const [row] = await db.query<TaggedBudget>("SELECT * FROM tagged_budgets WHERE id = ?", [id]);
  return row ?? null;
}

function validateTagged(input: TaggedBudgetInput): TaggedBudgetInput {
  validateValue(input.value);
  const tag = input.tag.trim();
  if (!tag) throw new Error("Tag is required");
  return { ...input, tag };
}

export async function createTaggedBudget(input: TaggedBudgetInput): Promise<TaggedBudget> {
  const { name, value, tag } = validateTagged(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { lastId } = await tx.run("INSERT INTO tagged_budgets (name, value, tag, date) VALUES (?, ?, ?, ?)", [
      name,
      value,
      tag,
      normalizeDate(),
    ]);
    const created = (await getTaggedBudget(lastId, tx))!;
    await logChange(tx, "taggedBudget", "create", created.id, null, created);
    return created;
  });
}

export async function updateTaggedBudget(id: number, input: TaggedBudgetInput): Promise<TaggedBudget> {
  const { name, value, tag } = validateTagged(input);
  const before = await getTaggedBudget(id);
  if (!before) throw new Error("Tagged budget not found");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.run("UPDATE tagged_budgets SET name = ?, value = ?, tag = ? WHERE id = ?", [name, value, tag, id]);
    const after = (await getTaggedBudget(id, tx))!;
    await logChange(tx, "taggedBudget", "update", id, before, after);
    return after;
  });
}

export async function deleteTaggedBudget(id: number): Promise<void> {
  const before = await getTaggedBudget(id);
  if (!before) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM tagged_budgets WHERE id = ?", [id]);
    await logChange(tx, "taggedBudget", "delete", id, before, null);
  });
}

/** Each tagged budget with the current month's spend on its tag. */
export async function getTaggedBudgetStats(now = new Date()): Promise<TaggedBudgetStats[]> {
  const db = await getDb();
  return db.query<TaggedBudgetStats>(
    `SELECT b.id, b.name, b.value, b.tag, COALESCE(SUM(t.price), 0) AS totalPrice
     FROM tagged_budgets b
     LEFT JOIN transactions t
       ON t.price < 0
       AND strftime('%Y-%m', t.date) = ?
       AND EXISTS (SELECT 1 FROM json_each(t.tags) WHERE json_each.value = b.tag)
     GROUP BY b.id
     ORDER BY b.id`,
    [toLocalIso(now).slice(0, 7)]
  );
}

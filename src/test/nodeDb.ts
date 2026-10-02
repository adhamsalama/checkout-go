import { DatabaseSync } from "node:sqlite";
import { Db, SqlValue } from "../db/types";
import { migrate } from "../db/migrations";

/** An empty, unmigrated in-memory Db backed by node:sqlite. */
export function createRawNodeDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  const db: Db = {
    async query<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: SqlValue[] = []) {
      const res = sqlite.prepare(sql).run(...params);
      return { changes: Number(res.changes), lastId: Number(res.lastInsertRowid) };
    },
    async transaction(fn) {
      sqlite.exec("BEGIN");
      try {
        const result = await fn(db);
        sqlite.exec("COMMIT");
        return result;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
  return db;
}

/** A migrated in-memory Db, for running the API layer in tests. */
export async function createNodeDb(): Promise<Db> {
  const db = createRawNodeDb();
  await migrate(db);
  return db;
}

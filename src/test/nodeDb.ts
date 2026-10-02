import { DatabaseSync } from "node:sqlite";
import { Db, SqlValue } from "../db/types";
import { SCHEMA } from "../db/schema";

/** A Db backed by node:sqlite, for running the API layer in tests. */
export function createNodeDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  for (const statement of SCHEMA) sqlite.exec(statement);
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

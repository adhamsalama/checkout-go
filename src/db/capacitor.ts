import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Db, SqlValue } from "./types";
import { SCHEMA } from "./schema";

const DB_NAME = "checkout";
const isWeb = Capacitor.getPlatform() === "web";

async function initWebStore(sqlite: SQLiteConnection) {
  // In the browser the plugin is backed by the jeep-sqlite web component (sql.js + IndexedDB).
  const { defineCustomElements } = await import("jeep-sqlite/loader");
  defineCustomElements(window);
  const el = document.createElement("jeep-sqlite");
  el.setAttribute("wasmpath", "/assets");
  document.body.appendChild(el);
  await customElements.whenDefined("jeep-sqlite");
  await sqlite.initWebStore();
}

function wrap(conn: SQLiteDBConnection, inTransaction: boolean, persist: () => Promise<void>): Db {
  const db: Db = {
    async query<T>(sql: string, params: SqlValue[] = []) {
      const res = await conn.query(sql, params);
      return (res.values ?? []) as T[];
    },
    async run(sql: string, params: SqlValue[] = []) {
      // The plugin wraps each run in its own transaction unless told otherwise.
      const res = await conn.run(sql, params, !inTransaction);
      if (!inTransaction) await persist();
      return { changes: res.changes?.changes ?? 0, lastId: res.changes?.lastId ?? 0 };
    },
    async transaction<T>(fn: (db: Db) => Promise<T>) {
      await conn.beginTransaction();
      try {
        const result = await fn(wrap(conn, true, persist));
        await conn.commitTransaction();
        await persist();
        return result;
      } catch (err) {
        await conn.rollbackTransaction();
        throw err;
      }
    },
  };
  return db;
}

export async function openCapacitorDb(): Promise<Db> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  if (isWeb) await initWebStore(sqlite);

  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const conn =
    consistent && exists
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  await conn.open();
  for (const statement of SCHEMA) await conn.execute(statement);

  const persist = isWeb ? () => sqlite.saveToStore(DB_NAME) : async () => {};
  await persist();
  return wrap(conn, false, persist);
}

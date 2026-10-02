import { Db } from "./types";

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = import("./capacitor").then((m) => m.openCapacitorDb());
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

/** Used by tests to swap in a node:sqlite-backed Db. */
export function setDb(db: Db) {
  dbPromise = Promise.resolve(db);
}

export type { Db } from "./types";

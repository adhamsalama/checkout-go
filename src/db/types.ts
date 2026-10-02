export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastId: number;
}

/** Minimal async SQLite interface so the API layer can run on Capacitor or, in tests, node:sqlite. */
export interface Db {
  query<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Runs fn atomically; statements issued through the passed Db inside fn are part of the transaction. */
  transaction<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

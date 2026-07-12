import { type DuckDBConnection, DuckDBInstance } from "../src/index.ts";

/** Open an in-memory DB + connection for a test; caller closes via the returned dispose(). */
export async function open(): Promise<{ conn: DuckDBConnection; dispose: () => void }> {
  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();
  return {
    conn,
    dispose: () => {
      conn.closeSync();
      db.closeSync();
    },
  };
}

/** Run a single-row query and return the first row object. */
export async function row(conn: DuckDBConnection, sql: string): Promise<Record<string, unknown>> {
  const r = await conn.runAndReadAll(sql);
  return r.getRowObjects()[0];
}

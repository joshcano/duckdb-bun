import { ptr } from "bun:ffi";
import { DuckDBError } from "./errors.ts";
import { cstr, lib } from "./ffi.ts";
import { type Reader, readAllFromResult, throwResultError } from "./reader.ts";
import { PreparedStatement } from "./statement.ts";

/** A DuckDB connection. Drop-in for the @duckdb/node-api slice used downstream. */
export class DuckDBConnection {
  #connBuf: BigUint64Array;
  #conn: number;
  #closed = false;

  constructor(connBuf: BigUint64Array) {
    this.#connBuf = connBuf;
    this.#conn = Number(connBuf[0]);
  }

  #query(sql: string): number {
    const result = new Uint8Array(48);
    const rp = ptr(result);
    if (lib.shim_query(this.#conn, cstr(sql), rp) !== 0) throwResultError(rp);
    return rp;
  }

  /** Execute a statement and ignore any result rows. */
  async run(sql: string): Promise<void> {
    const rp = this.#query(sql);
    lib.duckdb_destroy_result(rp);
  }

  /** Execute a query and read every row into a Reader. */
  async runAndReadAll(sql: string): Promise<Reader> {
    return readAllFromResult(this.#query(sql));
  }

  /** Prepare a parameterized statement. */
  async prepare(sql: string): Promise<PreparedStatement> {
    const stmtBuf = new BigUint64Array(1);
    if (lib.duckdb_prepare(this.#conn, cstr(sql), ptr(stmtBuf)) !== 0) {
      const message = lib.duckdb_prepare_error(Number(stmtBuf[0]))?.toString() || "failed to prepare statement";
      lib.duckdb_destroy_prepare(ptr(stmtBuf));
      throw new DuckDBError(message);
    }
    return new PreparedStatement(stmtBuf);
  }

  closeSync(): void {
    if (this.#closed) return;
    lib.duckdb_disconnect(ptr(this.#connBuf));
    this.#closed = true;
  }
}

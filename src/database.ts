import { ptr } from "bun:ffi";
import { DuckDBConnection } from "./connection.ts";
import { DuckDBError } from "./errors.ts";
import { cstr, lib } from "./ffi.ts";

/** A DuckDB database instance. Use `:memory:` for an ephemeral in-memory DB. */
export class DuckDBInstance {
  #dbBuf: BigUint64Array;
  #db: number;
  #closed = false;

  private constructor(dbBuf: BigUint64Array) {
    this.#dbBuf = dbBuf;
    this.#db = Number(dbBuf[0]);
  }

  static async create(path = ":memory:"): Promise<DuckDBInstance> {
    const dbBuf = new BigUint64Array(1);
    if (lib.duckdb_open(cstr(path), ptr(dbBuf)) !== 0) throw new DuckDBError(`failed to open database: ${path}`);
    return new DuckDBInstance(dbBuf);
  }

  async connect(): Promise<DuckDBConnection> {
    const connBuf = new BigUint64Array(1);
    if (lib.duckdb_connect(this.#db, ptr(connBuf)) !== 0) throw new DuckDBError("failed to connect");
    return new DuckDBConnection(connBuf);
  }

  closeSync(): void {
    if (this.#closed) return;
    lib.duckdb_close(ptr(this.#dbBuf));
    this.#closed = true;
  }
}

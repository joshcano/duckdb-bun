import { ptr } from "bun:ffi";
import { cstr, lib } from "./ffi.ts";
import { type Reader, readAllFromResult, throwResultError } from "./reader.ts";

const INT64_MIN = -9_223_372_036_854_775_808n;
const INT64_MAX = 9_223_372_036_854_775_807n;

/** A prepared statement with 1-based parameter binding. */
export class PreparedStatement {
  #stmtBuf: BigUint64Array;
  #stmt: number;
  #closed = false;

  constructor(stmtBuf: BigUint64Array) {
    this.#stmtBuf = stmtBuf;
    this.#stmt = Number(stmtBuf[0]);
  }

  /** Number of `?` parameters in the statement. */
  get paramCount(): number {
    return Number(lib.duckdb_nparams(this.#stmt));
  }

  /** Bind a single 1-based parameter, dispatching by JS type. */
  bind(index: number, value: unknown): this {
    const idx = BigInt(index);
    if (value === null || value === undefined) {
      lib.duckdb_bind_null(this.#stmt, idx);
    } else if (typeof value === "boolean") {
      lib.duckdb_bind_boolean(this.#stmt, idx, value);
    } else if (typeof value === "bigint") {
      if (value >= INT64_MIN && value <= INT64_MAX) lib.duckdb_bind_int64(this.#stmt, idx, value);
      else lib.duckdb_bind_varchar(this.#stmt, idx, cstr(value.toString()));
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) lib.duckdb_bind_int64(this.#stmt, idx, BigInt(value));
      else lib.duckdb_bind_double(this.#stmt, idx, value);
    } else if (value instanceof Date) {
      lib.duckdb_bind_varchar(this.#stmt, idx, cstr(value.toISOString()));
    } else {
      lib.duckdb_bind_varchar(this.#stmt, idx, cstr(String(value)));
    }
    return this;
  }

  /** Bind all parameters positionally (1-based under the hood). */
  bindAll(values: unknown[]): this {
    for (let i = 0; i < values.length; i++) this.bind(i + 1, values[i]);
    return this;
  }

  #execute(): number {
    const result = new Uint8Array(48);
    const rp = ptr(result);
    if (lib.duckdb_execute_prepared(this.#stmt, rp) !== 0) throwResultError(rp);
    return rp;
  }

  /** Execute and discard the result. */
  async run(): Promise<void> {
    const rp = this.#execute();
    lib.duckdb_destroy_result(rp);
  }

  /** Execute and read every row. */
  async readAll(): Promise<Reader> {
    return readAllFromResult(this.#execute());
  }

  close(): void {
    if (this.#closed) return;
    lib.duckdb_destroy_prepare(ptr(this.#stmtBuf));
    this.#closed = true;
  }
}

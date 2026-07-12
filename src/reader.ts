// Consumes a populated `duckdb_result` (48-byte buffer) by streaming its data
// chunks and decoding every column, then frees the result.
import { ptr } from "bun:ffi";
import { decodeColumn } from "./decode.ts";
import { DuckDBError } from "./errors.ts";
import { lib } from "./ffi.ts";
import { type ColumnType, DuckDBType } from "./types.ts";

/** A materialized query result. Mirrors the slice of @duckdb/node-api's reader used downstream. */
export class Reader {
  #columns: string[];
  #rows: Record<string, unknown>[];
  constructor(columns: string[], rows: Record<string, unknown>[]) {
    this.#columns = columns;
    this.#rows = rows;
  }
  columnNames(): string[] {
    return this.#columns;
  }
  getRowObjects(): Record<string, unknown>[] {
    return this.#rows;
  }
  get rowCount(): number {
    return this.#rows.length;
  }
}

function columnType(resultPtr: number, col: number): ColumnType {
  const id = lib.duckdb_column_type(resultPtr, BigInt(col));
  if (id !== DuckDBType.DECIMAL) return { id };
  const logical = lib.duckdb_column_logical_type(resultPtr, BigInt(col));
  const scale = lib.duckdb_decimal_scale(logical);
  const internal = lib.duckdb_decimal_internal_type(logical);
  const handle = new BigUint64Array([BigInt(logical)]);
  lib.duckdb_destroy_logical_type(ptr(handle));
  return { id, scale, internal };
}

/** Read the error string out of a result and throw it. Frees the result first. */
export function throwResultError(resultPtr: number): never {
  const message = lib.duckdb_result_error(resultPtr)?.toString() || "unknown duckdb error";
  lib.duckdb_destroy_result(resultPtr);
  throw new DuckDBError(message);
}

/** Drain all chunks from a populated result and free it. */
export function readAllFromResult(resultPtr: number): Reader {
  const colCount = Number(lib.duckdb_column_count(resultPtr));
  const columns: string[] = [];
  const types: ColumnType[] = [];
  for (let c = 0; c < colCount; c++) {
    columns.push(lib.duckdb_column_name(resultPtr, BigInt(c)).toString());
    types.push(columnType(resultPtr, c));
  }

  const rows: Record<string, unknown>[] = [];
  while (true) {
    const chunk = lib.shim_fetch_chunk(resultPtr);
    if (!chunk) break;
    const size = Number(lib.duckdb_data_chunk_get_size(chunk));
    const decoded: unknown[][] = [];
    for (let c = 0; c < colCount; c++) {
      const vec = lib.duckdb_data_chunk_get_vector(chunk, BigInt(c));
      const dataPtr = lib.duckdb_vector_get_data(vec);
      const validityPtr = lib.duckdb_vector_get_validity(vec);
      decoded.push(decodeColumn(dataPtr, validityPtr, size, types[c]));
    }
    for (let i = 0; i < size; i++) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < colCount; c++) row[columns[c]] = decoded[c][i];
      rows.push(row);
    }
    const handle = new BigUint64Array([BigInt(chunk)]);
    lib.duckdb_destroy_data_chunk(ptr(handle));
  }

  lib.duckdb_destroy_result(resultPtr);
  return new Reader(columns, rows);
}

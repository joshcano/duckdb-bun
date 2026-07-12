// duckdb-bun — Bun-native DuckDB binding over the libduckdb C API via bun:ffi.
export { DuckDBInstance } from "./database.ts";
export { DuckDBConnection } from "./connection.ts";
export { PreparedStatement } from "./statement.ts";
export { Reader } from "./reader.ts";
export { DuckDBError } from "./errors.ts";
export { DuckDBType } from "./types.ts";
export type { ColumnType, QueryResultShape } from "./types.ts";
import { lib } from "./ffi.ts";

/** The linked libduckdb version, e.g. "v1.5.2". */
export function libraryVersion(): string {
  return lib.duckdb_library_version().toString();
}

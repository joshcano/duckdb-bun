// duckdb-bun — Bun-native DuckDB binding over the libduckdb C API via bun:ffi.

export { DuckDBConnection } from "./connection.ts";
export { DuckDBInstance } from "./database.ts";
export { DuckDBError } from "./errors.ts";
export { Reader } from "./reader.ts";
export { PreparedStatement } from "./statement.ts";
export type { ColumnType, QueryResultShape } from "./types.ts";
export { DuckDBType } from "./types.ts";

import { lib } from "./ffi.ts";

/** The linked libduckdb version, e.g. "v1.5.2". */
export function libraryVersion(): string {
  return lib.duckdb_library_version().toString();
}

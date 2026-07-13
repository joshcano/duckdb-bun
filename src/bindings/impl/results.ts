// Query execution + result metadata + chunk fetching. `query` throws on SQL error
// (node-api's DuckDBConnection.run has no try/catch, so the binding must). The
// by-value `duckdb_result_*` functions go through the cc shim (pointer form).
import { cstr, lib } from "../ffi.ts";
import { liveConnections, newResult, type Ptr, resultPtr } from "../handles.ts";

export function query(connection: Ptr, sql: string): Uint8Array {
  if (!liveConnections.has(connection)) {
    throw new Error("Failed to query: connection disconnected");
  }
  const result = newResult();
  const rc = lib.shim_query(connection, cstr(sql), resultPtr(result));
  if (rc !== 0) {
    const message = String(lib.duckdb_result_error(resultPtr(result))) || "duckdb_query failed";
    lib.duckdb_destroy_result(resultPtr(result));
    throw new Error(message);
  }
  return result;
}

export function result_return_type(result: Uint8Array): number {
  return lib.shim_result_return_type(resultPtr(result));
}

export function result_statement_type(result: Uint8Array): number {
  return lib.shim_result_statement_type(resultPtr(result));
}

export function result_is_streaming(result: Uint8Array): boolean {
  return lib.shim_result_is_streaming(resultPtr(result));
}

export function result_chunk_count(result: Uint8Array): number {
  return Number(lib.shim_result_chunk_count(resultPtr(result)));
}

export function result_get_chunk(result: Uint8Array, chunkIndex: number): Ptr {
  return lib.shim_result_get_chunk(resultPtr(result), BigInt(chunkIndex));
}

export function column_count(result: Uint8Array): number {
  return Number(lib.duckdb_column_count(resultPtr(result)));
}

export function row_count(result: Uint8Array): number {
  return Number(lib.duckdb_row_count(resultPtr(result)));
}

export function rows_changed(result: Uint8Array): number {
  return Number(lib.duckdb_rows_changed(resultPtr(result)));
}

export function column_name(result: Uint8Array, columnIndex: number): string {
  // FFIType.cstring returns a CString (String subclass); node-api expects a
  // primitive string (=== comparisons in tests), so coerce.
  return String(lib.duckdb_column_name(resultPtr(result), BigInt(columnIndex)));
}

export function column_type(result: Uint8Array, columnIndex: number): number {
  return lib.duckdb_column_type(resultPtr(result), BigInt(columnIndex));
}

export function column_logical_type(result: Uint8Array, columnIndex: number): Ptr {
  return lib.duckdb_column_logical_type(resultPtr(result), BigInt(columnIndex));
}

export function fetch_chunk(result: Uint8Array): Ptr | null {
  const chunk = lib.shim_fetch_chunk(resultPtr(result));
  return chunk ? chunk : null;
}

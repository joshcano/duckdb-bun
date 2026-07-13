// Prepared statement bindings: prepare, parameter/column metadata, typed +
// value-based parameter binding, execution (materialized + streaming), destroy.
// Binds ignore their return state to match node-api (which does the same).
import { cstr, lib, ptr } from "../ffi.ts";
import {
  cstringAndFree,
  handleSlot,
  liveConnections,
  livePreparedStatements,
  newResult,
  outSlot,
  type Ptr,
  ptrOrNull,
  readSlot,
  resultPtr,
} from "../handles.ts";

export function prepare(connection: Ptr, query: string): Ptr {
  // Guard against a use-after-free on a disconnected connection; matches the
  // N-API binding's message so node-api surfaces the same error.
  if (!liveConnections.has(connection)) {
    throw new Error("Failed to prepare: connection disconnected");
  }
  const slot = outSlot();
  const rc = lib.duckdb_prepare(connection, cstr(query), ptr(slot));
  const stmt = readSlot(slot);
  if (rc !== 0) {
    const message = String(lib.duckdb_prepare_error(stmt)) || "duckdb_prepare failed";
    lib.duckdb_destroy_prepare(handleSlot(stmt));
    throw new Error(message);
  }
  livePreparedStatements.add(stmt);
  return stmt;
}

export function destroy_prepare_sync(stmt: Ptr): void {
  // Idempotent: node-api may destroy the same statement twice (explicitly and via
  // its WeakRef collection); only the first free reaches libduckdb.
  if (livePreparedStatements.delete(stmt)) {
    lib.duckdb_destroy_prepare(handleSlot(stmt));
  }
}

export function nparams(stmt: Ptr): number {
  return Number(lib.duckdb_nparams(stmt));
}

export function parameter_name(stmt: Ptr, index: number): string {
  // duckdb_parameter_name returns a malloc'd string; free after reading.
  return cstringAndFree(lib.duckdb_parameter_name(stmt, BigInt(index))) as string;
}

export function param_type(stmt: Ptr, index: number): number {
  return lib.duckdb_param_type(stmt, BigInt(index));
}

export function param_logical_type(stmt: Ptr, index: number): Ptr {
  return lib.duckdb_param_logical_type(stmt, BigInt(index));
}

export function clear_bindings(stmt: Ptr): void {
  lib.duckdb_clear_bindings(stmt);
}

export function bind_parameter_index(stmt: Ptr, name: string): number {
  const slot = outSlot();
  lib.duckdb_bind_parameter_index(stmt, ptr(slot), cstr(name));
  return readSlot(slot);
}

export function prepared_statement_type(stmt: Ptr): number {
  return lib.duckdb_prepared_statement_type(stmt);
}

export function prepared_statement_column_count(stmt: Ptr): number {
  return Number(lib.duckdb_prepared_statement_column_count(stmt));
}

export function prepared_statement_column_name(stmt: Ptr, index: number): string {
  return String(lib.duckdb_prepared_statement_column_name(stmt, BigInt(index)));
}

export function prepared_statement_column_type(stmt: Ptr, index: number): number {
  return lib.duckdb_prepared_statement_column_type(stmt, BigInt(index));
}

export function prepared_statement_column_logical_type(stmt: Ptr, index: number): Ptr {
  return lib.duckdb_prepared_statement_column_logical_type(stmt, BigInt(index));
}

function execute(stmt: Ptr, streaming: boolean): Uint8Array {
  const result = newResult();
  const rc = streaming
    ? lib.duckdb_execute_prepared_streaming(stmt, resultPtr(result))
    : lib.duckdb_execute_prepared(stmt, resultPtr(result));
  if (rc !== 0) {
    const message = String(lib.duckdb_result_error(resultPtr(result))) || "duckdb_execute_prepared failed";
    lib.duckdb_destroy_result(resultPtr(result));
    throw new Error(message);
  }
  return result;
}

export function execute_prepared(stmt: Ptr): Uint8Array {
  return execute(stmt, false);
}

export function execute_prepared_streaming(stmt: Ptr): Uint8Array {
  return execute(stmt, true);
}

// --- typed parameter binding (1-based param_idx) ---
const idx = (i: number) => BigInt(i);
export const bind_boolean = (s: Ptr, i: number, v: boolean): void => void lib.duckdb_bind_boolean(s, idx(i), v);
export const bind_int8 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_int8(s, idx(i), v);
export const bind_int16 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_int16(s, idx(i), v);
export const bind_int32 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_int32(s, idx(i), v);
export const bind_int64 = (s: Ptr, i: number, v: bigint): void => void lib.duckdb_bind_int64(s, idx(i), v);
export const bind_uint8 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_uint8(s, idx(i), v);
export const bind_uint16 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_uint16(s, idx(i), v);
export const bind_uint32 = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_uint32(s, idx(i), v);
export const bind_uint64 = (s: Ptr, i: number, v: bigint): void => void lib.duckdb_bind_uint64(s, idx(i), v);
export const bind_float = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_float(s, idx(i), v);
export const bind_double = (s: Ptr, i: number, v: number): void => void lib.duckdb_bind_double(s, idx(i), v);
export const bind_varchar = (s: Ptr, i: number, v: string): void => void lib.duckdb_bind_varchar(s, idx(i), cstr(v));
export const bind_blob = (s: Ptr, i: number, data: Uint8Array): void =>
  void lib.duckdb_bind_blob(s, idx(i), ptrOrNull(data), BigInt(data.length));
export const bind_null = (s: Ptr, i: number): void => void lib.duckdb_bind_null(s, idx(i));
export const bind_value = (s: Ptr, i: number, value: Ptr): void => void lib.duckdb_bind_value(s, idx(i), value);

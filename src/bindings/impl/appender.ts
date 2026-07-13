// Appender bindings (bulk insert). Appends throw on error with the appender's
// error message, matching the N-API binding. Struct-by-value appends go through
// the cc shim. node-api relies on GC to destroy the appender, so close/flush only
// close/flush (the handle leaks — a Phase 7 finalizer cleanup).
import { cstr, lib, ptr } from "../ffi.ts";
import { outSlot, type Ptr, ptrOrNull, readSlot } from "../handles.ts";
import { splitI128, splitU128 } from "../marshal.ts";

function check(appender: Ptr, rc: number, fallback: string): void {
  if (rc !== 0) {
    throw new Error(String(lib.duckdb_appender_error(appender)) || fallback);
  }
}

export function appender_create(connection: Ptr, schema: string | null, table: string): Ptr {
  const slot = outSlot();
  const rc = lib.duckdb_appender_create(connection, schema != null ? cstr(schema) : null, cstr(table), ptr(slot));
  const appender = readSlot(slot);
  check(appender, rc, "duckdb_appender_create failed");
  return appender;
}

export function appender_create_ext(
  connection: Ptr,
  catalog: string | null,
  schema: string | null,
  table: string,
): Ptr {
  const slot = outSlot();
  const rc = lib.duckdb_appender_create_ext(
    connection,
    catalog != null ? cstr(catalog) : null,
    schema != null ? cstr(schema) : null,
    cstr(table),
    ptr(slot),
  );
  const appender = readSlot(slot);
  check(appender, rc, "duckdb_appender_create_ext failed");
  return appender;
}

export function appender_column_count(appender: Ptr): number {
  return Number(lib.duckdb_appender_column_count(appender));
}

export function appender_column_type(appender: Ptr, columnIndex: number): Ptr {
  return lib.duckdb_appender_column_type(appender, BigInt(columnIndex));
}

export function appender_end_row(appender: Ptr): void {
  check(appender, lib.duckdb_appender_end_row(appender), "append end_row failed");
}

export function appender_flush_sync(appender: Ptr): void {
  check(appender, lib.duckdb_appender_flush(appender), "appender flush failed");
}

export function appender_close_sync(appender: Ptr): void {
  check(appender, lib.duckdb_appender_close(appender), "appender close failed");
}

export function append_default(appender: Ptr): void {
  check(appender, lib.duckdb_append_default(appender), "append default failed");
}

export function append_value(appender: Ptr, value: Ptr): void {
  check(appender, lib.duckdb_append_value(appender, value), "append value failed");
}

export function append_data_chunk(appender: Ptr, chunk: Ptr): void {
  check(appender, lib.duckdb_append_data_chunk(appender, chunk), "append data chunk failed");
}

export const append_bool = (a: Ptr, v: boolean): void => check(a, lib.duckdb_append_bool(a, v), "append bool failed");
export const append_int8 = (a: Ptr, v: number): void => check(a, lib.duckdb_append_int8(a, v), "append int8 failed");
export const append_int16 = (a: Ptr, v: number): void => check(a, lib.duckdb_append_int16(a, v), "append int16 failed");
export const append_int32 = (a: Ptr, v: number): void => check(a, lib.duckdb_append_int32(a, v), "append int32 failed");
export const append_int64 = (a: Ptr, v: bigint): void => check(a, lib.duckdb_append_int64(a, v), "append int64 failed");
export const append_uint8 = (a: Ptr, v: number): void => check(a, lib.duckdb_append_uint8(a, v), "append uint8 failed");
export const append_uint16 = (a: Ptr, v: number): void =>
  check(a, lib.duckdb_append_uint16(a, v), "append uint16 failed");
export const append_uint32 = (a: Ptr, v: number): void =>
  check(a, lib.duckdb_append_uint32(a, v), "append uint32 failed");
export const append_uint64 = (a: Ptr, v: bigint): void =>
  check(a, lib.duckdb_append_uint64(a, v), "append uint64 failed");
export const append_float = (a: Ptr, v: number): void => check(a, lib.duckdb_append_float(a, v), "append float failed");
export const append_double = (a: Ptr, v: number): void =>
  check(a, lib.duckdb_append_double(a, v), "append double failed");
export const append_varchar = (a: Ptr, v: string): void =>
  check(a, lib.duckdb_append_varchar(a, cstr(v)), "append varchar failed");
export const append_blob = (a: Ptr, data: Uint8Array): void =>
  check(a, lib.duckdb_append_blob(a, ptrOrNull(data), BigInt(data.length)), "append blob failed");
export const append_null = (a: Ptr): void => check(a, lib.duckdb_append_null(a), "append null failed");

// struct-by-value appends (via shim)
export const append_hugeint = (a: Ptr, v: bigint): void => {
  const { lower, upper } = splitI128(v);
  check(a, lib.shim_append_hugeint(a, lower, upper), "append hugeint failed");
};
export const append_uhugeint = (a: Ptr, v: bigint): void => {
  const { lower, upper } = splitU128(v);
  check(a, lib.shim_append_uhugeint(a, lower, upper), "append uhugeint failed");
};
export const append_date = (a: Ptr, d: { days: number }): void =>
  check(a, lib.shim_append_date(a, d.days), "append date failed");
export const append_time = (a: Ptr, t: { micros: bigint }): void =>
  check(a, lib.shim_append_time(a, t.micros), "append time failed");
export const append_timestamp = (a: Ptr, t: { micros: bigint }): void =>
  check(a, lib.shim_append_timestamp(a, t.micros), "append timestamp failed");
export const append_interval = (a: Ptr, iv: { months: number; days: number; micros: bigint }): void =>
  check(a, lib.shim_append_interval(a, iv.months, iv.days, iv.micros), "append interval failed");

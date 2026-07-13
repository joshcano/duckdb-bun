// Value creation: scalars via dlopen, by-value-struct types via the cc shim,
// composites (list/struct/array/map/union/enum) via pointer arrays of child value
// handles. Used by createValue for both prepared-statement binding and appending.
// (create_bignum is still stubbed — its bigint->varint encoding is pending.)
import { lib, ptr } from "../ffi.ts";
import { type Ptr, ptrArray, ptrOrNull } from "../handles.ts";
import { splitI128, splitU128 } from "../marshal.ts";

// --- scalars ---
export const create_bool = (v: boolean): Ptr => lib.duckdb_create_bool(v);
export const create_int8 = (v: number): Ptr => lib.duckdb_create_int8(v);
export const create_int16 = (v: number): Ptr => lib.duckdb_create_int16(v);
export const create_int32 = (v: number): Ptr => lib.duckdb_create_int32(v);
export const create_int64 = (v: bigint): Ptr => lib.duckdb_create_int64(v);
export const create_uint8 = (v: number): Ptr => lib.duckdb_create_uint8(v);
export const create_uint16 = (v: number): Ptr => lib.duckdb_create_uint16(v);
export const create_uint32 = (v: number): Ptr => lib.duckdb_create_uint32(v);
export const create_uint64 = (v: bigint): Ptr => lib.duckdb_create_uint64(v);
export const create_float = (v: number): Ptr => lib.duckdb_create_float(v);
// Bun's FFIType.f64 arg collapses NaN to 0, so pass the exact bit pattern to a
// reinterpreting shim for NaN; normal doubles (incl. +/-Infinity) go direct.
const dblBits = new DataView(new ArrayBuffer(8));
export const create_double = (v: number): Ptr => {
  if (Number.isNaN(v)) {
    dblBits.setFloat64(0, v, true);
    return lib.shim_create_double_bits(dblBits.getBigUint64(0, true));
  }
  return lib.duckdb_create_double(v);
};
// Use the length-taking form so strings with embedded NUL bytes (which DuckDB's
// test_all_types includes, e.g. "goo\0se") aren't truncated at the NUL.
export const create_varchar = (text: string): Ptr => {
  const bytes = Buffer.from(text, "utf8");
  return lib.duckdb_create_varchar_length(ptrOrNull(bytes), BigInt(bytes.length));
};
export const create_blob = (data: Uint8Array): Ptr => lib.duckdb_create_blob(ptrOrNull(data), BigInt(data.length));
export const create_null_value = (): Ptr => lib.duckdb_create_null_value();
export const create_enum_value = (type: Ptr, value: number): Ptr => lib.duckdb_create_enum_value(type, BigInt(value));

// --- by-value struct types (via shim) ---
export const create_hugeint = (v: bigint): Ptr => {
  const { lower, upper } = splitI128(v);
  return lib.shim_create_hugeint(lower, upper);
};
export const create_uhugeint = (v: bigint): Ptr => {
  const { lower, upper } = splitU128(v);
  return lib.shim_create_uhugeint(lower, upper);
};
export const create_decimal = (d: { width: number; scale: number; value: bigint }): Ptr => {
  const { lower, upper } = splitI128(d.value);
  return lib.shim_create_decimal(d.width, d.scale, lower, upper);
};
export const create_date = (d: { days: number }): Ptr => lib.shim_create_date(d.days);
export const create_time = (t: { micros: bigint }): Ptr => lib.shim_create_time(t.micros);
export const create_time_ns = (t: { nanos: bigint }): Ptr => lib.shim_create_time_ns(t.nanos);
export const create_time_tz_value = (t: { bits: bigint }): Ptr => lib.shim_create_time_tz_value(t.bits);
export const create_timestamp = (t: { micros: bigint }): Ptr => lib.shim_create_timestamp(t.micros);
export const create_timestamp_tz = (t: { micros: bigint }): Ptr => lib.shim_create_timestamp_tz(t.micros);
export const create_timestamp_s = (t: { seconds: bigint }): Ptr => lib.shim_create_timestamp_s(t.seconds);
export const create_timestamp_ms = (t: { millis: bigint }): Ptr => lib.shim_create_timestamp_ms(t.millis);
export const create_timestamp_ns = (t: { nanos: bigint }): Ptr => lib.shim_create_timestamp_ns(t.nanos);
export const create_interval = (iv: { months: number; days: number; micros: bigint }): Ptr =>
  lib.shim_create_interval(iv.months, iv.days, iv.micros);
export const create_uuid = (v: bigint): Ptr => {
  const { lower, upper } = splitU128(v);
  return lib.shim_create_uuid(lower, upper);
};
export const create_bit = (data: Uint8Array): Ptr => lib.shim_create_bit(ptrOrNull(data), BigInt(data.length));

// BIGNUM: duckdb_bignum is { data (magnitude bytes), size, is_negative }. Despite
// the header comment saying "little endian", duckdb_create_bignum reads `data`
// big-endian (verified empirically: 2^64 as little-endian bytes decoded to 1), so
// we emit the absolute value's big-endian bytes plus a sign flag.
export const create_bignum = (value: bigint): Ptr => {
  const negative = value < 0n;
  let magnitude = negative ? -value : value;
  const bytes: number[] = []; // little-endian first...
  while (magnitude > 0n) {
    bytes.push(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  if (bytes.length === 0) bytes.push(0);
  bytes.reverse(); // ...then big-endian
  const data = Uint8Array.from(bytes);
  return lib.shim_create_bignum(ptr(data), BigInt(data.length), negative);
};

// --- composites (arrays of child value handles) ---
// ptrArray always allocates >= 1 element, so ptr() is valid even for empty
// collections; the real element count is passed separately.
export function create_list_value(type: Ptr, values: readonly Ptr[]): Ptr {
  const arr = ptrArray(values);
  return lib.duckdb_create_list_value(type, ptr(arr), BigInt(values.length));
}
export function create_struct_value(type: Ptr, values: readonly Ptr[]): Ptr {
  const arr = ptrArray(values);
  return lib.duckdb_create_struct_value(type, ptr(arr));
}
export function create_array_value(type: Ptr, values: readonly Ptr[]): Ptr {
  const arr = ptrArray(values);
  return lib.duckdb_create_array_value(type, ptr(arr), BigInt(values.length));
}
export function create_map_value(mapType: Ptr, keys: readonly Ptr[], values: readonly Ptr[]): Ptr {
  const keysArr = ptrArray(keys);
  const valuesArr = ptrArray(values);
  return lib.duckdb_create_map_value(mapType, ptr(keysArr), ptr(valuesArr), BigInt(keys.length));
}
export function create_union_value(unionType: Ptr, tagIndex: number, value: Ptr): Ptr {
  return lib.duckdb_create_union_value(unionType, BigInt(tagIndex), value);
}

// Shared helpers for the FFI binding implementations: opaque-handle marshaling,
// out-parameter slots, error checking, and C-string/array construction.
//
// Handle representation:
//   - Most handles (Database, Connection, Config, DataChunk, Vector, LogicalType,
//     Value, PreparedStatement, Appender, PendingResult, ...) are pointer NUMBERS.
//   - A `Result` is the 48-byte `duckdb_result` struct itself; we represent it as
//     the backing Uint8Array and pass `ptr(buf)` wherever a `duckdb_result *` is
//     wanted. `resultPtr()` centralizes that.
import { CString, DUCKDB_SUCCESS, lib, ptr } from "./ffi.ts";

export type Ptr = number;

/** `ptr()` of a byte array, or a null pointer for an empty one — Bun's `ptr()`
 * throws on a zero-length view, but duckdb accepts (NULL, 0) for empty blobs/bits. */
export function ptrOrNull(data: Uint8Array): Ptr {
  return data.length ? ptr(data) : 0;
}

/** Allocate a pointer-sized out-parameter slot for functions that write a handle. */
export function outSlot(): BigUint64Array {
  return new BigUint64Array(1);
}

/** Read the pointer an out-slot was filled with, as a JS number. */
export function readSlot(slot: BigUint64Array): Ptr {
  return Number(slot[0]);
}

/** A single-element slot holding `handle`, for the `duckdb_*(T *handle)` destroy/
 * close functions that take the ADDRESS of a handle (so they can null it out). */
export function handleSlot(handle: Ptr): BigUint64Array {
  return new BigUint64Array([BigInt(handle)]);
}

/** The 48-byte `duckdb_result` struct backing a Result handle. */
export function newResult(): Uint8Array {
  return new Uint8Array(48);
}

export function resultPtr(result: Uint8Array): Ptr {
  return ptr(result);
}

/** Read a malloc'd `char *` the C API hands back (alias, child name, enum value,
 * ...) into a JS string and free it. Returns null for a NULL pointer. */
export function cstringAndFree(p: Ptr | null): string | null {
  if (!p) return null;
  const s = new CString(p).toString();
  lib.duckdb_free(p);
  return s;
}

/** Build a C array of pointers (`T *[]`) from handle numbers. Always allocates at
 * least one element so `ptr()` never sees an empty view (which it rejects); the
 * caller passes the real count separately, so a padded empty array reads as 0. */
export function ptrArray(handles: readonly Ptr[]): BigUint64Array {
  const arr = new BigUint64Array(Math.max(handles.length, 1));
  for (let i = 0; i < handles.length; i++) arr[i] = BigInt(handles[i]);
  return arr;
}

/** Build a C `const char *[]` from JS strings. Returns the pointer array plus the
 * backing buffers, which the CALLER must keep referenced until the FFI call
 * returns (otherwise GC could free the string memory mid-call). */
export function cstrArray(strings: readonly string[]): {
  arr: BigUint64Array;
  keepAlive: Buffer[];
} {
  const keepAlive = strings.map((s) => Buffer.from(`${s}\0`, "utf8"));
  const arr = new BigUint64Array(keepAlive.length);
  for (let i = 0; i < keepAlive.length; i++) arr[i] = BigInt(ptr(keepAlive[i]));
  return { arr, keepAlive };
}

export function checkState(rc: number, message: string): void {
  if (rc !== DUCKDB_SUCCESS) throw new Error(message);
}

// Liveness tracking for connections. Our handles are raw pointer numbers, so
// unlike the N-API binding we can't null a caller's reference on disconnect —
// node-api keeps the stale pointer and would pass it to prepare/query (a
// use-after-free). We instead track live connections here: disconnect removes
// the entry (and is idempotent, so double-disconnect is a no-op), and
// prepare/query check membership and throw instead of dereferencing freed memory.
export const liveConnections = new Set<Ptr>();

// Same idempotency problem for prepared statements: node-api destroys a statement
// both explicitly and via its WeakRef collection, so destroy_prepare_sync must be
// a no-op the second time (the N-API binding nulls its handle). Track liveness.
export const livePreparedStatements = new Set<Ptr>();

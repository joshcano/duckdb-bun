// Decode a DuckDB data-chunk vector into JS values. Data is a contiguous buffer
// of fixed-size elements; NULLs come from a separate validity bitmask.
import { CString, read, toArrayBuffer } from "bun:ffi";
import { type ColumnType, DuckDBType as T } from "./types.ts";

const MS_PER_DAY = 86_400_000;

// validityPtr is a uint64 bitmask, or 0 when every row is valid.
function isValid(validityPtr: number, row: number): boolean {
  if (!validityPtr) return true;
  const entry = read.u64(validityPtr, (row >> 6) * 8);
  return ((entry >> BigInt(row & 63)) & 1n) === 1n;
}

// duckdb_string_t: 16 bytes. First 4 = length. If length <= 12 the bytes are
// inlined at offset +4; otherwise offset +8 holds a pointer to the data.
function readStringBytes(base: number, i: number): { ptr: number; off: number; len: number } {
  const off = i * 16;
  const len = read.u32(base, off);
  if (len <= 12) return { ptr: base, off: off + 4, len };
  return { ptr: read.ptr(base, off + 8), off: 0, len };
}

function readVarchar(base: number, i: number): string {
  const { ptr, off, len } = readStringBytes(base, i);
  if (len === 0) return "";
  return new CString(ptr, off, len).toString();
}

function readBlob(base: number, i: number): Uint8Array {
  const { ptr, off, len } = readStringBytes(base, i);
  if (len === 0) return new Uint8Array(0);
  return new Uint8Array(toArrayBuffer(ptr, off, len)).slice();
}

// 128-bit little-endian: unsigned low 64 at +0, signed high 64 at +8.
function readHugeint(base: number, off: number): bigint {
  const low = read.u64(base, off);
  const high = read.i64(base, off + 8);
  return (high << 64n) + low;
}

function readUhugeint(base: number, off: number): bigint {
  const low = read.u64(base, off);
  const high = read.u64(base, off + 8);
  return (high << 64n) + low;
}

function dateString(days: number): string {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10);
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}

function timeString(micros: bigint): string {
  const totalUs = micros < 0n ? 0n : micros;
  const us = Number(totalUs % 1_000_000n);
  const totalSec = totalUs / 1_000_000n;
  const s = Number(totalSec % 60n);
  const m = Number((totalSec / 60n) % 60n);
  const h = Number(totalSec / 3600n);
  const base = `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}`;
  return us ? `${base}.${pad(us, 6)}` : base;
}

function uuidString(base: number, off: number): string {
  // DuckDB stores UUIDs as a hugeint with the sign bit flipped.
  const low = read.u64(base, off);
  const highSigned = read.i64(base, off + 8);
  const high = BigInt.asUintN(64, highSigned) ^ 0x8000_0000_0000_0000n;
  const hex = ((high << 64n) | low).toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function decimalScale(col: ColumnType): number {
  return col.scale ?? 0;
}

function readDecimal(base: number, i: number, col: ColumnType): number {
  const scale = decimalScale(col);
  let raw: bigint;
  switch (col.internal) {
    case T.SMALLINT:
      raw = BigInt(read.i16(base, i * 2));
      break;
    case T.INTEGER:
      raw = BigInt(read.i32(base, i * 4));
      break;
    case T.BIGINT:
      raw = read.i64(base, i * 8);
      break;
    default:
      raw = readHugeint(base, i * 16);
      break;
  }
  return Number(raw) / 10 ** scale;
}

function timestampDate(micros: bigint): Date {
  return new Date(Number(micros) / 1000);
}

/** Decode `size` rows of one column into a JS array (NULLs become `null`). */
export function decodeColumn(dataPtr: number, validityPtr: number, size: number, col: ColumnType): unknown[] {
  const out = new Array<unknown>(size);
  for (let i = 0; i < size; i++) {
    if (!isValid(validityPtr, i)) {
      out[i] = null;
      continue;
    }
    switch (col.id) {
      case T.BOOLEAN:
        out[i] = read.u8(dataPtr, i) !== 0;
        break;
      case T.TINYINT:
        out[i] = read.i8(dataPtr, i);
        break;
      case T.SMALLINT:
        out[i] = read.i16(dataPtr, i * 2);
        break;
      case T.INTEGER:
        out[i] = read.i32(dataPtr, i * 4);
        break;
      case T.BIGINT:
        out[i] = read.i64(dataPtr, i * 8);
        break;
      case T.UTINYINT:
        out[i] = read.u8(dataPtr, i);
        break;
      case T.USMALLINT:
        out[i] = read.u16(dataPtr, i * 2);
        break;
      case T.UINTEGER:
        out[i] = read.u32(dataPtr, i * 4);
        break;
      case T.UBIGINT:
        out[i] = read.u64(dataPtr, i * 8);
        break;
      case T.HUGEINT:
        out[i] = readHugeint(dataPtr, i * 16);
        break;
      case T.UHUGEINT:
        out[i] = readUhugeint(dataPtr, i * 16);
        break;
      case T.FLOAT:
        out[i] = read.f32(dataPtr, i * 4);
        break;
      case T.DOUBLE:
        out[i] = read.f64(dataPtr, i * 8);
        break;
      case T.VARCHAR:
      case T.BIT:
      case T.BIGNUM:
        out[i] = readVarchar(dataPtr, i);
        break;
      case T.BLOB:
        out[i] = readBlob(dataPtr, i);
        break;
      case T.DATE:
        out[i] = dateString(read.i32(dataPtr, i * 4));
        break;
      case T.TIMESTAMP:
      case T.TIMESTAMP_TZ:
        out[i] = timestampDate(read.i64(dataPtr, i * 8));
        break;
      case T.TIMESTAMP_S:
        out[i] = new Date(Number(read.i64(dataPtr, i * 8)) * 1000);
        break;
      case T.TIMESTAMP_MS:
        out[i] = new Date(Number(read.i64(dataPtr, i * 8)));
        break;
      case T.TIMESTAMP_NS:
        out[i] = new Date(Number(read.i64(dataPtr, i * 8)) / 1e6);
        break;
      case T.TIME:
      case T.TIME_TZ:
        out[i] = timeString(read.i64(dataPtr, i * 8));
        break;
      case T.DECIMAL:
        out[i] = readDecimal(dataPtr, i, col);
        break;
      case T.UUID:
        out[i] = uuidString(dataPtr, i * 16);
        break;
      default:
        // ENUM / LIST / STRUCT / MAP / ARRAY / INTERVAL are not decoded in v1.
        out[i] = null;
        break;
    }
  }
  return out;
}

// P0-3 FFI load spike: prove dlopen + a full query round-trip works against
// vendored libduckdb using only the pointer-based C API (no by-value calls).
import { dlopen, FFIType, ptr } from "bun:ffi";

const libPath = new URL("../vendor/linux-x64/libduckdb.so", import.meta.url).pathname;

const { symbols: d } = dlopen(libPath, {
  duckdb_library_version: { args: [], returns: FFIType.cstring },
  duckdb_open: { args: [FFIType.cstring, FFIType.ptr], returns: FFIType.i32 },
  duckdb_connect: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
  duckdb_query: { args: [FFIType.ptr, FFIType.cstring, FFIType.ptr], returns: FFIType.i32 },
  duckdb_column_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_row_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_column_name: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.cstring },
  duckdb_value_int64: { args: [FFIType.ptr, FFIType.u64, FFIType.u64], returns: FFIType.i64 },
  duckdb_value_varchar: { args: [FFIType.ptr, FFIType.u64, FFIType.u64], returns: FFIType.cstring },
  duckdb_result_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_destroy_result: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_disconnect: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_close: { args: [FFIType.ptr], returns: FFIType.void },
});

const DUCKDB_SUCCESS = 0;

console.log("library_version:", d.duckdb_library_version().toString());

// out-params: a duckdb_database / duckdb_connection is an opaque pointer; the
// out arg is a pointer-to-pointer, so allocate 8 bytes and read the handle back.
const dbBuf = new BigUint64Array(1);
if (d.duckdb_open(Buffer.from(":memory:\0"), ptr(dbBuf)) !== DUCKDB_SUCCESS) throw new Error("open failed");
const db = Number(dbBuf[0]);

const connBuf = new BigUint64Array(1);
if (d.duckdb_connect(db, ptr(connBuf)) !== DUCKDB_SUCCESS) throw new Error("connect failed");
const conn = Number(connBuf[0]);

// duckdb_result is a 6-field struct (48 bytes) written into a caller buffer.
const result = new Uint8Array(48);
const rp = ptr(result);
const sql = "SELECT 42::BIGINT AS answer, 'hello duckdb' AS greeting";
if (d.duckdb_query(conn, Buffer.from(`${sql}\0`), rp) !== DUCKDB_SUCCESS) {
  throw new Error(`query failed: ${d.duckdb_result_error(rp)}`);
}

const cols = Number(d.duckdb_column_count(rp));
const rows = Number(d.duckdb_row_count(rp));
const names: string[] = [];
for (let c = 0; c < cols; c++) names.push(d.duckdb_column_name(rp, BigInt(c)).toString());

console.log("cols:", cols, "rows:", rows, "names:", names);
console.log("answer[0,0]:", d.duckdb_value_int64(rp, 0n, 0n));
console.log("greeting[1,0]:", d.duckdb_value_varchar(rp, 1n, 0n).toString());

d.duckdb_destroy_result(rp);
d.duckdb_disconnect(ptr(connBuf));
d.duckdb_close(ptr(dbBuf));
console.log("SPIKE OK");

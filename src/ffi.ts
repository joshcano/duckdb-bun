// The FFI surface: dlopen the pointer-based libduckdb C API + cc-compile the
// shim that wraps the by-value functions (`duckdb_query`, `duckdb_fetch_chunk`).
// Everything is merged into a single `lib` object of callable symbols.
import { FFIType, cc, dlopen } from "bun:ffi";
import { loadNative } from "./library.ts";

const native = await loadNative();

const { symbols: base } = dlopen(native.libPath, {
  duckdb_library_version: { args: [], returns: FFIType.cstring },
  // lifecycle
  duckdb_open: { args: [FFIType.cstring, FFIType.ptr], returns: FFIType.i32 },
  duckdb_connect: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
  duckdb_disconnect: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_close: { args: [FFIType.ptr], returns: FFIType.void },
  // results (pointer-based; the by-value query/fetch come from the shim)
  duckdb_destroy_result: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_result_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_column_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_row_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_column_name: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.cstring },
  duckdb_column_type: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.u32 },
  duckdb_column_logical_type: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  duckdb_decimal_scale: { args: [FFIType.ptr], returns: FFIType.u8 },
  duckdb_decimal_internal_type: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_destroy_logical_type: { args: [FFIType.ptr], returns: FFIType.void },
  // data chunks
  duckdb_data_chunk_get_size: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_data_chunk_get_vector: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  duckdb_vector_get_data: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_vector_get_validity: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_destroy_data_chunk: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_free: { args: [FFIType.ptr], returns: FFIType.void },
  // prepared statements
  duckdb_prepare: { args: [FFIType.ptr, FFIType.cstring, FFIType.ptr], returns: FFIType.i32 },
  duckdb_prepare_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_nparams: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_bind_boolean: { args: [FFIType.ptr, FFIType.u64, FFIType.bool], returns: FFIType.i32 },
  duckdb_bind_int64: { args: [FFIType.ptr, FFIType.u64, FFIType.i64], returns: FFIType.i32 },
  duckdb_bind_double: { args: [FFIType.ptr, FFIType.u64, FFIType.f64], returns: FFIType.i32 },
  duckdb_bind_varchar: { args: [FFIType.ptr, FFIType.u64, FFIType.cstring], returns: FFIType.i32 },
  duckdb_bind_null: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.i32 },
  duckdb_execute_prepared: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
  duckdb_destroy_prepare: { args: [FFIType.ptr], returns: FFIType.void },
});

const { symbols: shim } = cc({
  source: native.shimPath,
  flags: [`-I${native.includeDir}`],
  symbols: {
    shim_init: { args: [FFIType.cstring], returns: FFIType.i32 },
    shim_query: { args: [FFIType.ptr, FFIType.cstring, FFIType.ptr], returns: FFIType.i32 },
    shim_fetch_chunk: { args: [FFIType.ptr], returns: FFIType.ptr },
  },
});

/**
 * Encode a JS string as a null-terminated C-string buffer. Required for cc-compiled
 * function args (FFIType.cstring): unlike dlopen symbols, they do not auto-encode
 * JS strings and passing one segfaults.
 */
export function cstr(s: string): Buffer {
  return Buffer.from(`${s}\0`, "utf8");
}

if (shim.shim_init(cstr(native.libPath)) !== 0) {
  throw new Error(`duckdb-bun: shim failed to dlopen libduckdb at ${native.libPath}`);
}

export const lib = { ...base, ...shim };
export const DUCKDB_SUCCESS = 0;

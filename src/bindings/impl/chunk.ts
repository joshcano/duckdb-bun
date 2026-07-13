// Data chunk bindings. Chunks are pointer handles. node-api never frees chunks
// (it relied on the N-API finalizer); we currently let them leak — a Finalization
// registry is a Phase 7 cleanup, harmless for a test run.
import { lib, ptr } from "../ffi.ts";
import { type Ptr, ptrArray } from "../handles.ts";

export function vector_size(): number {
  return Number(lib.duckdb_vector_size());
}

export function create_data_chunk(logicalTypes: readonly Ptr[]): Ptr {
  const arr = ptrArray(logicalTypes);
  return lib.duckdb_create_data_chunk(ptr(arr), BigInt(logicalTypes.length));
}

export function data_chunk_reset(chunk: Ptr): void {
  lib.duckdb_data_chunk_reset(chunk);
}

export function data_chunk_get_column_count(chunk: Ptr): number {
  return Number(lib.duckdb_data_chunk_get_column_count(chunk));
}

export function data_chunk_get_size(chunk: Ptr): number {
  return Number(lib.duckdb_data_chunk_get_size(chunk));
}

export function data_chunk_set_size(chunk: Ptr, size: number): void {
  lib.duckdb_data_chunk_set_size(chunk, BigInt(size));
}

export function data_chunk_get_vector(chunk: Ptr, columnIndex: number): Ptr {
  return lib.duckdb_data_chunk_get_vector(chunk, BigInt(columnIndex));
}

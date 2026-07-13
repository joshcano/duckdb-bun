// Vector data access. node-api decodes values itself in pure TS from the raw
// bytes we expose here, so these just wrap the C data/validity pointers as
// zero-copy Uint8Array views over the owning chunk's memory. The chunk must
// outlive these views — node-api holds the chunk while its vectors are in use.
import { lib, toArrayBuffer } from "../ffi.ts";
import { type Ptr, ptrOrNull } from "../handles.ts";

export function vector_get_column_type(vector: Ptr): Ptr {
  return lib.duckdb_vector_get_column_type(vector);
}

// Returns a COPY of the vector's data (not a live view). This matches the N-API
// binding's semantics that the write path depends on: node-api stages setItem
// writes into this buffer and only pushes them to the C vector on flush() via
// copy_data_to_vector — a live view would make writes take effect immediately
// (breaking delayed-flush). Copying also avoids dangling views into freed chunks.
export function vector_get_data(vector: Ptr, byteCount: number): Uint8Array {
  const dataPtr = lib.duckdb_vector_get_data(vector);
  return new Uint8Array(toArrayBuffer(dataPtr, 0, byteCount)).slice();
}

// Returns null when the vector has no validity mask (i.e. all rows valid) —
// node-api's DuckDBValidity treats a falsy result as "all valid". Copy, per above.
export function vector_get_validity(vector: Ptr, byteCount: number): Uint8Array | null {
  const validityPtr = lib.duckdb_vector_get_validity(vector);
  if (!validityPtr) return null;
  return new Uint8Array(toArrayBuffer(validityPtr, 0, byteCount)).slice();
}

export function list_vector_get_child(vector: Ptr): Ptr {
  return lib.duckdb_list_vector_get_child(vector);
}

export function list_vector_get_size(vector: Ptr): number {
  return Number(lib.duckdb_list_vector_get_size(vector));
}

export function struct_vector_get_child(vector: Ptr, index: number): Ptr {
  return lib.duckdb_struct_vector_get_child(vector, BigInt(index));
}

export function array_vector_get_child(vector: Ptr): Ptr {
  return lib.duckdb_array_vector_get_child(vector);
}

// Reads an out-of-line pointer stored at `arrayBuffer[pointerOffset..+8]` (a
// duckdb_string_t's data pointer for strings longer than 12 bytes) and returns
// `byteCount` bytes from the heap it points to. Little-endian pointer read.
export function get_data_from_pointer(arrayBuffer: ArrayBuffer, pointerOffset: number, byteCount: number): Uint8Array {
  const view = new DataView(arrayBuffer);
  const dataPtr = Number(view.getBigUint64(pointerOffset, true));
  return new Uint8Array(toArrayBuffer(dataPtr, 0, byteCount));
}

// --- write path (data chunk construction / appending) ---

// Custom helper (not a libduckdb fn): copy `sourceByteCount` bytes from a JS
// ArrayBuffer into the vector's C data buffer at `targetByteOffset`. Zero-copy
// destination view over the vector memory.
export function copy_data_to_vector(
  targetVector: Ptr,
  targetByteOffset: number,
  sourceBuffer: ArrayBuffer,
  sourceByteOffset: number,
  sourceByteCount: number,
): void {
  const dataPtr = lib.duckdb_vector_get_data(targetVector);
  const dest = new Uint8Array(toArrayBuffer(dataPtr, targetByteOffset, sourceByteCount));
  dest.set(new Uint8Array(sourceBuffer, sourceByteOffset, sourceByteCount));
}

export function copy_data_to_vector_validity(
  targetVector: Ptr,
  targetByteOffset: number,
  sourceBuffer: ArrayBuffer,
  sourceByteOffset: number,
  sourceByteCount: number,
): void {
  const validityPtr = lib.duckdb_vector_get_validity(targetVector);
  const dest = new Uint8Array(toArrayBuffer(validityPtr, targetByteOffset, sourceByteCount));
  dest.set(new Uint8Array(sourceBuffer, sourceByteOffset, sourceByteCount));
}

export function vector_ensure_validity_writable(vector: Ptr): void {
  lib.duckdb_vector_ensure_validity_writable(vector);
}

export function vector_assign_string_element(vector: Ptr, index: number, str: string): void {
  // Route through the length-taking form (with UTF-8 bytes) rather than the
  // NUL-terminated C function, so strings with embedded NUL bytes (which duckdb
  // permits, e.g. "goo\0se") aren't truncated — matches the N-API binding.
  const bytes = Buffer.from(str, "utf8");
  lib.duckdb_vector_assign_string_element_len(vector, BigInt(index), ptrOrNull(bytes), BigInt(bytes.length));
}

export function vector_assign_string_element_len(vector: Ptr, index: number, data: Uint8Array): void {
  lib.duckdb_vector_assign_string_element_len(vector, BigInt(index), ptrOrNull(data), BigInt(data.length));
}

export function list_vector_set_size(vector: Ptr, size: number): void {
  lib.duckdb_list_vector_set_size(vector, BigInt(size));
}

export function list_vector_reserve(vector: Ptr, capacity: number): void {
  lib.duckdb_list_vector_reserve(vector, BigInt(capacity));
}

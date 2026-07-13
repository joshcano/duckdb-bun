// Instance cache + pending/streaming execution. Pending results drive node-api's
// incremental (start/runTask) and streaming execution paths.
import { CString, cstr, lib, ptr } from "../ffi.ts";
import { handleSlot, outSlot, type Ptr, readSlot } from "../handles.ts";

// --- instance cache ---
export function create_instance_cache(): Ptr {
  return lib.duckdb_create_instance_cache();
}

export function get_or_create_from_cache(cache: Ptr, path?: string, config?: Ptr): Ptr {
  const dbSlot = outSlot();
  const errSlot = outSlot();
  const rc = lib.duckdb_get_or_create_from_cache(
    cache,
    path != null ? cstr(path) : null,
    ptr(dbSlot),
    config ?? 0,
    ptr(errSlot),
  );
  if (config) lib.duckdb_destroy_config(handleSlot(config));
  if (rc !== 0) {
    const errPtr = readSlot(errSlot);
    let message = "duckdb_get_or_create_from_cache failed";
    if (errPtr) {
      message = new CString(errPtr).toString();
      lib.duckdb_free(errPtr);
    }
    throw new Error(message);
  }
  return readSlot(dbSlot);
}

// --- pending execution ---
export function pending_prepared(stmt: Ptr): Ptr {
  const slot = outSlot();
  const rc = lib.duckdb_pending_prepared(stmt, ptr(slot));
  const pending = readSlot(slot);
  if (rc !== 0) {
    const message = String(lib.duckdb_pending_error(pending)) || "pending_prepared failed";
    lib.duckdb_destroy_pending(handleSlot(pending));
    throw new Error(message);
  }
  return pending;
}

export function pending_prepared_streaming(stmt: Ptr): Ptr {
  const slot = outSlot();
  const rc = lib.duckdb_pending_prepared_streaming(stmt, ptr(slot));
  const pending = readSlot(slot);
  if (rc !== 0) {
    const message = String(lib.duckdb_pending_error(pending)) || "pending_prepared_streaming failed";
    lib.duckdb_destroy_pending(handleSlot(pending));
    throw new Error(message);
  }
  return pending;
}

export function pending_error(pending: Ptr): string {
  return String(lib.duckdb_pending_error(pending));
}

export function pending_execute_task(pending: Ptr): number {
  return lib.duckdb_pending_execute_task(pending);
}

export function pending_execute_check_state(pending: Ptr): number {
  return lib.duckdb_pending_execute_check_state(pending);
}

export function pending_execution_is_finished(pendingState: number): boolean {
  return lib.duckdb_pending_execution_is_finished(pendingState);
}

export function execute_pending(pending: Ptr): Uint8Array {
  const result = new Uint8Array(48);
  const rc = lib.duckdb_execute_pending(pending, ptr(result));
  if (rc !== 0) {
    const message = String(lib.duckdb_result_error(ptr(result))) || "duckdb_execute_pending failed";
    lib.duckdb_destroy_result(ptr(result));
    throw new Error(message);
  }
  return result;
}

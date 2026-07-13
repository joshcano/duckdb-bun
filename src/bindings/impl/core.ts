// Instance / connection / config bindings. The vendored node-api treats
// open/connect as async; our FFI is synchronous, so we return values directly
// (an `await` on a non-Promise is a no-op) — behaviorally identical for results.
import { CString, cstr, lib, ptr } from "../ffi.ts";
import { checkState, handleSlot, liveConnections, outSlot, type Ptr, readSlot } from "../handles.ts";

export function library_version(): string {
  // Coerce the CString return to a primitive string (see column_name).
  return String(lib.duckdb_library_version());
}

export function create_config(): Ptr {
  const slot = outSlot();
  checkState(lib.duckdb_create_config(ptr(slot)), "duckdb_create_config failed");
  return readSlot(slot);
}

export function set_config(config: Ptr, name: string, option: string): void {
  checkState(lib.duckdb_set_config(config, cstr(name), cstr(option)), `duckdb_set_config(${name}) failed`);
}

export function open(path?: string, config?: Ptr): Ptr {
  const dbSlot = outSlot();
  const errSlot = outSlot();
  const rc = lib.duckdb_open_ext(path != null ? cstr(path) : null, ptr(dbSlot), config ?? 0, ptr(errSlot));
  // duckdb_open_ext does not take ownership of the config; the caller must free
  // it (node-api never does, so the binding does — matches the N-API addon).
  if (config) lib.duckdb_destroy_config(handleSlot(config));
  if (rc !== 0) {
    const errPtr = readSlot(errSlot);
    let message = "duckdb_open failed";
    if (errPtr) {
      message = new CString(errPtr).toString();
      lib.duckdb_free(errPtr);
    }
    throw new Error(message);
  }
  return readSlot(dbSlot);
}

export function connect(db: Ptr): Ptr {
  const slot = outSlot();
  checkState(lib.duckdb_connect(db, ptr(slot)), "duckdb_connect failed");
  const connection = readSlot(slot);
  liveConnections.add(connection);
  return connection;
}

export function close_sync(db: Ptr): void {
  lib.duckdb_close(handleSlot(db));
}

export function disconnect_sync(connection: Ptr): void {
  // Idempotent: only free a still-live connection (double-disconnect is a no-op).
  if (liveConnections.delete(connection)) {
    lib.duckdb_disconnect(handleSlot(connection));
  }
}

export function interrupt(connection: Ptr): void {
  lib.duckdb_interrupt(connection);
}

export function config_count(): number {
  return Number(lib.duckdb_config_count());
}

export function get_config_flag(index: number): { name: string; description: string } {
  const nameSlot = outSlot();
  const descSlot = outSlot();
  checkState(
    lib.duckdb_get_config_flag(BigInt(index), ptr(nameSlot), ptr(descSlot)),
    `duckdb_get_config_flag(${index}) failed`,
  );
  // out_name/out_description point to static strings owned by duckdb — do not free.
  return {
    name: new CString(readSlot(nameSlot)).toString(),
    description: new CString(readSlot(descSlot)).toString(),
  };
}

export function connection_get_client_context(connection: Ptr): Ptr {
  const slot = outSlot();
  lib.duckdb_connection_get_client_context(connection, ptr(slot));
  return readSlot(slot);
}

export function client_context_get_connection_id(context: Ptr): number {
  return Number(lib.duckdb_client_context_get_connection_id(context));
}

// Scalar function (UDF) registration. The two duckdb callbacks (bind + main) are
// bridged to JS via bun:ffi JSCallback; duckdb invokes them synchronously on our
// thread during query execution (our query/execute FFI is synchronous), so
// on-thread callbacks are safe. Thrown JS errors are converted to duckdb errors
// via set_error/bind_set_error so they surface as query failures.
//
// extra_info / bind_data are arbitrary JS objects. duckdb only stores them as an
// opaque void*, so we keep the objects in a JS-side registry and pass the integer
// id as the pointer, looking it up again on retrieval.
import { FFIType, JSCallback } from "bun:ffi";
import { cstr, lib, ptr } from "../ffi.ts";
import { checkState, handleSlot, newResult, outSlot, type Ptr, readSlot, resultPtr } from "../handles.ts";

// Keep JSCallbacks alive for the process lifetime (they must outlive the
// registered function). Registered functions are few and long-lived, so leaking
// them is fine.
const keepAlive = new Set<JSCallback>();

// id (>0) -> JS object, for extra_info / bind_data round-tripped through void*.
let nextObjectId = 1;
const objectRegistry = new Map<number, object>();

export const create_scalar_function = (): Ptr => lib.duckdb_create_scalar_function();

export const destroy_scalar_function_sync = (sf: Ptr): void => lib.duckdb_destroy_scalar_function(handleSlot(sf));

export const scalar_function_set_name = (sf: Ptr, name: string): void =>
  lib.duckdb_scalar_function_set_name(sf, cstr(name));

export const scalar_function_add_parameter = (sf: Ptr, type: Ptr): void =>
  lib.duckdb_scalar_function_add_parameter(sf, type);

export const scalar_function_set_return_type = (sf: Ptr, type: Ptr): void =>
  lib.duckdb_scalar_function_set_return_type(sf, type);

export const scalar_function_set_varargs = (sf: Ptr, type: Ptr): void =>
  lib.duckdb_scalar_function_set_varargs(sf, type);

export const scalar_function_set_special_handling = (sf: Ptr): void =>
  lib.duckdb_scalar_function_set_special_handling(sf);

export const scalar_function_set_volatile = (sf: Ptr): void => lib.duckdb_scalar_function_set_volatile(sf);

export function scalar_function_set_function(sf: Ptr, fn: (info: Ptr, input: Ptr, output: Ptr) => void): void {
  const cb = new JSCallback(
    (info: number, input: number, output: number) => {
      try {
        fn(info, input, output);
      } catch (e) {
        lib.duckdb_scalar_function_set_error(info, cstr((e as Error).message));
      }
    },
    { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.void },
  );
  keepAlive.add(cb);
  lib.duckdb_scalar_function_set_function(sf, cb.ptr);
}

export function scalar_function_set_bind(sf: Ptr, bind: (info: Ptr) => void): void {
  const cb = new JSCallback(
    (info: number) => {
      try {
        bind(info);
      } catch (e) {
        lib.duckdb_scalar_function_bind_set_error(info, cstr((e as Error).message));
      }
    },
    { args: [FFIType.ptr], returns: FFIType.void },
  );
  keepAlive.add(cb);
  lib.duckdb_scalar_function_set_bind(sf, cb.ptr);
}

export function scalar_function_set_extra_info(sf: Ptr, extraInfo: object): void {
  const id = nextObjectId++;
  objectRegistry.set(id, extraInfo);
  lib.duckdb_scalar_function_set_extra_info(sf, id, 0);
}

export function scalar_function_get_extra_info(functionInfo: Ptr): object | undefined {
  const id = lib.duckdb_scalar_function_get_extra_info(functionInfo);
  return id ? objectRegistry.get(id) : undefined;
}

export function scalar_function_bind_get_extra_info(bindInfo: Ptr): object | undefined {
  const id = lib.duckdb_scalar_function_bind_get_extra_info(bindInfo);
  return id ? objectRegistry.get(id) : undefined;
}

export function scalar_function_set_bind_data(bindInfo: Ptr, bindData: object): void {
  const id = nextObjectId++;
  objectRegistry.set(id, bindData);
  lib.duckdb_scalar_function_set_bind_data(bindInfo, id, 0);
}

export function scalar_function_get_bind_data(functionInfo: Ptr): object | undefined {
  const id = lib.duckdb_scalar_function_get_bind_data(functionInfo);
  return id ? objectRegistry.get(id) : undefined;
}

export const scalar_function_bind_set_error = (bindInfo: Ptr, error: string): void =>
  lib.duckdb_scalar_function_bind_set_error(bindInfo, cstr(error));

export const scalar_function_set_error = (functionInfo: Ptr, error: string): void =>
  lib.duckdb_scalar_function_set_error(functionInfo, cstr(error));

export function scalar_function_get_client_context(bindInfo: Ptr): Ptr {
  const slot = outSlot();
  lib.duckdb_scalar_function_get_client_context(bindInfo, ptr(slot));
  return readSlot(slot);
}

export function register_scalar_function(connection: Ptr, sf: Ptr): void {
  checkState(lib.duckdb_register_scalar_function(connection, sf), "duckdb_register_scalar_function failed");
  // Our scalar UDF runs as a SYNCHRONOUS bun:ffi JSCallback, which must execute
  // on the thread that called into duckdb. DuckDB otherwise dispatches operators
  // to worker threads (with smaller stacks) non-deterministically, which
  // overflows/races the JS callback. Pin this connection to single-threaded so
  // UDF callbacks always run on the caller's (main) stack.
  const result = newResult();
  if (lib.shim_query(connection, cstr("SET threads=1"), resultPtr(result)) === 0) {
    lib.duckdb_destroy_result(resultPtr(result));
  }
}

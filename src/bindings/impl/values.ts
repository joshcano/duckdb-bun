// Value extraction bindings. Values are pointer handles. `get_varchar` returns a
// malloc'd char* freed via cstringAndFree. (create_*/get_* scalar value families
// for binding/appending come in the prepared-statement/appender phase.)
import { cstr, lib } from "../ffi.ts";
import { cstringAndFree, type Ptr } from "../handles.ts";

export function get_table_names(connection: Ptr, query: string, qualified: boolean): Ptr {
  return lib.duckdb_get_table_names(connection, cstr(query), qualified);
}

export function get_list_size(value: Ptr): number {
  return Number(lib.duckdb_get_list_size(value));
}

export function get_list_child(value: Ptr, index: number): Ptr {
  return lib.duckdb_get_list_child(value, BigInt(index));
}

export function get_varchar(value: Ptr): string {
  return cstringAndFree(lib.duckdb_get_varchar(value)) as string;
}

export function is_null_value(value: Ptr): boolean {
  return lib.duckdb_is_null_value(value);
}

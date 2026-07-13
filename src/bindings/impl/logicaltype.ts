// Logical type construction + introspection. Handles are pointers. char*-returning
// getters (alias, child/member names, enum dictionary values) are malloc'd by the
// C API and freed via cstringAndFree.
import { cstr, lib, ptr } from "../ffi.ts";
import { cstrArray, cstringAndFree, type Ptr, ptrArray } from "../handles.ts";

export function get_type_id(logicalType: Ptr): number {
  return lib.duckdb_get_type_id(logicalType);
}

export function create_logical_type(typeId: number): Ptr {
  return lib.duckdb_create_logical_type(typeId);
}

export function logical_type_get_alias(logicalType: Ptr): string | null {
  return cstringAndFree(lib.duckdb_logical_type_get_alias(logicalType));
}

export function logical_type_set_alias(logicalType: Ptr, alias: string): void {
  lib.duckdb_logical_type_set_alias(logicalType, cstr(alias));
}

export function create_decimal_type(width: number, scale: number): Ptr {
  return lib.duckdb_create_decimal_type(width, scale);
}

export function decimal_width(logicalType: Ptr): number {
  return lib.duckdb_decimal_width(logicalType);
}

export function decimal_scale(logicalType: Ptr): number {
  return lib.duckdb_decimal_scale(logicalType);
}

export function decimal_internal_type(logicalType: Ptr): number {
  return lib.duckdb_decimal_internal_type(logicalType);
}

export function enum_internal_type(logicalType: Ptr): number {
  return lib.duckdb_enum_internal_type(logicalType);
}

export function enum_dictionary_size(logicalType: Ptr): number {
  return lib.duckdb_enum_dictionary_size(logicalType);
}

export function enum_dictionary_value(logicalType: Ptr, index: number): string {
  return cstringAndFree(lib.duckdb_enum_dictionary_value(logicalType, BigInt(index))) as string;
}

export function list_type_child_type(logicalType: Ptr): Ptr {
  return lib.duckdb_list_type_child_type(logicalType);
}

export function array_type_child_type(logicalType: Ptr): Ptr {
  return lib.duckdb_array_type_child_type(logicalType);
}

export function array_type_array_size(logicalType: Ptr): number {
  return Number(lib.duckdb_array_type_array_size(logicalType));
}

export function map_type_key_type(logicalType: Ptr): Ptr {
  return lib.duckdb_map_type_key_type(logicalType);
}

export function map_type_value_type(logicalType: Ptr): Ptr {
  return lib.duckdb_map_type_value_type(logicalType);
}

export function struct_type_child_count(logicalType: Ptr): number {
  return Number(lib.duckdb_struct_type_child_count(logicalType));
}

export function struct_type_child_name(logicalType: Ptr, index: number): string {
  return cstringAndFree(lib.duckdb_struct_type_child_name(logicalType, BigInt(index))) as string;
}

export function struct_type_child_type(logicalType: Ptr, index: number): Ptr {
  return lib.duckdb_struct_type_child_type(logicalType, BigInt(index));
}

export function union_type_member_count(logicalType: Ptr): number {
  return Number(lib.duckdb_union_type_member_count(logicalType));
}

export function union_type_member_name(logicalType: Ptr, index: number): string {
  return cstringAndFree(lib.duckdb_union_type_member_name(logicalType, BigInt(index))) as string;
}

export function union_type_member_type(logicalType: Ptr, index: number): Ptr {
  return lib.duckdb_union_type_member_type(logicalType, BigInt(index));
}

export function create_list_type(childType: Ptr): Ptr {
  return lib.duckdb_create_list_type(childType);
}

export function create_array_type(childType: Ptr, arraySize: number): Ptr {
  return lib.duckdb_create_array_type(childType, BigInt(arraySize));
}

export function create_map_type(keyType: Ptr, valueType: Ptr): Ptr {
  return lib.duckdb_create_map_type(keyType, valueType);
}

export function create_struct_type(memberTypes: readonly Ptr[], memberNames: readonly string[]): Ptr {
  const types = ptrArray(memberTypes);
  const names = cstrArray(memberNames);
  return lib.duckdb_create_struct_type(ptr(types), ptr(names.arr), BigInt(memberTypes.length));
}

export function create_union_type(memberTypes: readonly Ptr[], memberNames: readonly string[]): Ptr {
  const types = ptrArray(memberTypes);
  const names = cstrArray(memberNames);
  return lib.duckdb_create_union_type(ptr(types), ptr(names.arr), BigInt(memberTypes.length));
}

export function create_enum_type(memberNames: readonly string[]): Ptr {
  const names = cstrArray(memberNames);
  return lib.duckdb_create_enum_type(ptr(names.arr), BigInt(memberNames.length));
}

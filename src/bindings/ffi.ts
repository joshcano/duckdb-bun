// FFI surface for the full @duckdb/node-bindings reimplementation: dlopen the
// pointer-based libduckdb C API + cc-compile the shim that wraps the by-value
// functions (`duckdb_query`, `duckdb_fetch_chunk`, the `duckdb_result_*` family).
// Kept separate from the legacy bespoke `src/ffi.ts`; both load the same native
// assets via `src/library.ts` and compile the shared `native/shim.c`.
import { CString, cc, dlopen, FFIType, ptr, read, toArrayBuffer } from "bun:ffi";
import { loadNative } from "../library.ts";

const native = await loadNative();

const { symbols: base } = dlopen(native.libPath, {
  duckdb_library_version: { args: [], returns: FFIType.cstring },

  // --- config ---
  duckdb_create_config: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_set_config: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.cstring],
    returns: FFIType.i32,
  },
  duckdb_destroy_config: { args: [FFIType.ptr], returns: FFIType.void },

  // --- lifecycle ---
  duckdb_open_ext: {
    args: [FFIType.cstring, FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_connect: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
  duckdb_disconnect: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_close: { args: [FFIType.ptr], returns: FFIType.void },

  // --- results (pointer-based; by-value forms come from the shim) ---
  duckdb_destroy_result: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_result_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_column_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_row_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_rows_changed: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_column_name: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.cstring,
  },
  duckdb_column_type: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.u32 },
  duckdb_column_logical_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_free: { args: [FFIType.ptr], returns: FFIType.void },

  // --- data chunks ---
  duckdb_vector_size: { args: [], returns: FFIType.u64 },
  duckdb_create_data_chunk: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_data_chunk_reset: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_data_chunk_get_column_count: {
    args: [FFIType.ptr],
    returns: FFIType.u64,
  },
  duckdb_data_chunk_get_size: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_data_chunk_set_size: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.void,
  },
  duckdb_data_chunk_get_vector: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_destroy_data_chunk: { args: [FFIType.ptr], returns: FFIType.void },

  // --- vectors ---
  duckdb_vector_get_column_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_vector_get_data: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_vector_get_validity: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_list_vector_get_child: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_list_vector_get_size: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_struct_vector_get_child: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_array_vector_get_child: { args: [FFIType.ptr], returns: FFIType.ptr },

  // --- client context + config introspection + interrupt ---
  duckdb_config_count: { args: [], returns: FFIType.u64 },
  duckdb_get_config_flag: {
    args: [FFIType.u64, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_connection_get_client_context: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_client_context_get_connection_id: {
    args: [FFIType.ptr],
    returns: FFIType.u64,
  },
  duckdb_destroy_client_context: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_interrupt: { args: [FFIType.ptr], returns: FFIType.void },

  // --- logical types ---
  duckdb_get_type_id: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_create_logical_type: { args: [FFIType.u32], returns: FFIType.ptr },
  duckdb_destroy_logical_type: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_logical_type_get_alias: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_logical_type_set_alias: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },
  duckdb_create_decimal_type: {
    args: [FFIType.u8, FFIType.u8],
    returns: FFIType.ptr,
  },
  duckdb_decimal_width: { args: [FFIType.ptr], returns: FFIType.u8 },
  duckdb_decimal_scale: { args: [FFIType.ptr], returns: FFIType.u8 },
  duckdb_decimal_internal_type: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_enum_internal_type: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_enum_dictionary_size: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_enum_dictionary_value: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_list_type_child_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_array_type_child_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_array_type_array_size: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_map_type_key_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_map_type_value_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_struct_type_child_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_struct_type_child_name: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_struct_type_child_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_union_type_member_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_union_type_member_name: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_union_type_member_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_list_type: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_create_array_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_map_type: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.ptr,
  },
  duckdb_create_struct_type: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_union_type: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_enum_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },

  // --- values (extraction used by get_table_names etc.) ---
  duckdb_get_table_names: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.bool],
    returns: FFIType.ptr,
  },
  duckdb_get_list_size: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_get_list_child: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_get_varchar: { args: [FFIType.ptr], returns: FFIType.ptr },
  duckdb_is_null_value: { args: [FFIType.ptr], returns: FFIType.bool },
  duckdb_destroy_value: { args: [FFIType.ptr], returns: FFIType.void },

  // --- value creation (scalar + composite; struct forms via shim) ---
  duckdb_create_bool: { args: [FFIType.bool], returns: FFIType.ptr },
  duckdb_create_int8: { args: [FFIType.i8], returns: FFIType.ptr },
  duckdb_create_int16: { args: [FFIType.i16], returns: FFIType.ptr },
  duckdb_create_int32: { args: [FFIType.i32], returns: FFIType.ptr },
  duckdb_create_int64: { args: [FFIType.i64], returns: FFIType.ptr },
  duckdb_create_uint8: { args: [FFIType.u8], returns: FFIType.ptr },
  duckdb_create_uint16: { args: [FFIType.u16], returns: FFIType.ptr },
  duckdb_create_uint32: { args: [FFIType.u32], returns: FFIType.ptr },
  duckdb_create_uint64: { args: [FFIType.u64], returns: FFIType.ptr },
  duckdb_create_float: { args: [FFIType.f32], returns: FFIType.ptr },
  duckdb_create_double: { args: [FFIType.f64], returns: FFIType.ptr },
  duckdb_create_varchar: { args: [FFIType.cstring], returns: FFIType.ptr },
  duckdb_create_varchar_length: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_blob: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
  duckdb_create_null_value: { args: [], returns: FFIType.ptr },
  duckdb_create_enum_value: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_list_value: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_struct_value: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.ptr,
  },
  duckdb_create_array_value: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_map_value: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_create_union_value: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr],
    returns: FFIType.ptr,
  },

  // --- prepared statements ---
  duckdb_prepare: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_prepare_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_destroy_prepare: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_nparams: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_parameter_name: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_param_type: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.u32 },
  duckdb_param_logical_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_clear_bindings: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_bind_parameter_index: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.cstring],
    returns: FFIType.i32,
  },
  duckdb_prepared_statement_type: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_prepared_statement_column_count: {
    args: [FFIType.ptr],
    returns: FFIType.u64,
  },
  duckdb_prepared_statement_column_name: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.cstring,
  },
  duckdb_prepared_statement_column_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.u32,
  },
  duckdb_prepared_statement_column_logical_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_execute_prepared: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_execute_prepared_streaming: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },

  // --- parameter binding (scalar; struct forms via shim/value) ---
  duckdb_bind_boolean: {
    args: [FFIType.ptr, FFIType.u64, FFIType.bool],
    returns: FFIType.i32,
  },
  duckdb_bind_int8: {
    args: [FFIType.ptr, FFIType.u64, FFIType.i8],
    returns: FFIType.i32,
  },
  duckdb_bind_int16: {
    args: [FFIType.ptr, FFIType.u64, FFIType.i16],
    returns: FFIType.i32,
  },
  duckdb_bind_int32: {
    args: [FFIType.ptr, FFIType.u64, FFIType.i32],
    returns: FFIType.i32,
  },
  duckdb_bind_int64: {
    args: [FFIType.ptr, FFIType.u64, FFIType.i64],
    returns: FFIType.i32,
  },
  duckdb_bind_uint8: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u8],
    returns: FFIType.i32,
  },
  duckdb_bind_uint16: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u16],
    returns: FFIType.i32,
  },
  duckdb_bind_uint32: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u32],
    returns: FFIType.i32,
  },
  duckdb_bind_uint64: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u64],
    returns: FFIType.i32,
  },
  duckdb_bind_float: {
    args: [FFIType.ptr, FFIType.u64, FFIType.f32],
    returns: FFIType.i32,
  },
  duckdb_bind_double: {
    args: [FFIType.ptr, FFIType.u64, FFIType.f64],
    returns: FFIType.i32,
  },
  duckdb_bind_varchar: {
    args: [FFIType.ptr, FFIType.u64, FFIType.cstring],
    returns: FFIType.i32,
  },
  duckdb_bind_blob: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  duckdb_bind_null: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.i32 },
  duckdb_bind_value: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr],
    returns: FFIType.i32,
  },

  // --- extract statements ---
  duckdb_extract_statements: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.ptr],
    returns: FFIType.u64,
  },
  duckdb_prepare_extracted_statement: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_extract_statements_error: {
    args: [FFIType.ptr],
    returns: FFIType.cstring,
  },

  // --- vector write path ---
  duckdb_vector_ensure_validity_writable: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_vector_assign_string_element: {
    args: [FFIType.ptr, FFIType.u64, FFIType.cstring],
    returns: FFIType.void,
  },
  duckdb_vector_assign_string_element_len: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.void,
  },
  duckdb_list_vector_set_size: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  duckdb_list_vector_reserve: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },

  // --- appender ---
  duckdb_appender_create: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_appender_create_ext: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.cstring, FFIType.cstring, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_appender_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_appender_column_count: { args: [FFIType.ptr], returns: FFIType.u64 },
  duckdb_appender_column_type: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.ptr,
  },
  duckdb_appender_end_row: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_appender_flush: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_appender_close: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_appender_destroy: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_append_value: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_append_data_chunk: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_append_default: { args: [FFIType.ptr], returns: FFIType.i32 },
  duckdb_append_bool: {
    args: [FFIType.ptr, FFIType.bool],
    returns: FFIType.i32,
  },
  duckdb_append_int8: { args: [FFIType.ptr, FFIType.i8], returns: FFIType.i32 },
  duckdb_append_int16: {
    args: [FFIType.ptr, FFIType.i16],
    returns: FFIType.i32,
  },
  duckdb_append_int32: {
    args: [FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  duckdb_append_int64: {
    args: [FFIType.ptr, FFIType.i64],
    returns: FFIType.i32,
  },
  duckdb_append_uint8: { args: [FFIType.ptr, FFIType.u8], returns: FFIType.i32 },
  duckdb_append_uint16: {
    args: [FFIType.ptr, FFIType.u16],
    returns: FFIType.i32,
  },
  duckdb_append_uint32: {
    args: [FFIType.ptr, FFIType.u32],
    returns: FFIType.i32,
  },
  duckdb_append_uint64: {
    args: [FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  duckdb_append_float: {
    args: [FFIType.ptr, FFIType.f32],
    returns: FFIType.i32,
  },
  duckdb_append_double: {
    args: [FFIType.ptr, FFIType.f64],
    returns: FFIType.i32,
  },
  duckdb_append_varchar: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.i32,
  },
  duckdb_append_blob: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  duckdb_append_null: { args: [FFIType.ptr], returns: FFIType.i32 },

  // --- instance cache ---
  duckdb_create_instance_cache: { args: [], returns: FFIType.ptr },
  duckdb_get_or_create_from_cache: {
    args: [FFIType.ptr, FFIType.cstring, FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_destroy_instance_cache: { args: [FFIType.ptr], returns: FFIType.void },

  // --- pending / streaming execution ---
  duckdb_pending_prepared: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_pending_prepared_streaming: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_pending_error: { args: [FFIType.ptr], returns: FFIType.cstring },
  duckdb_pending_execute_task: { args: [FFIType.ptr], returns: FFIType.u32 },
  duckdb_pending_execute_check_state: {
    args: [FFIType.ptr],
    returns: FFIType.u32,
  },
  duckdb_execute_pending: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
  duckdb_pending_execution_is_finished: {
    args: [FFIType.u32],
    returns: FFIType.bool,
  },
  duckdb_destroy_pending: { args: [FFIType.ptr], returns: FFIType.void },

  // --- scalar functions (UDFs) ---
  duckdb_create_scalar_function: { args: [], returns: FFIType.ptr },
  duckdb_destroy_scalar_function: { args: [FFIType.ptr], returns: FFIType.void },
  duckdb_scalar_function_set_name: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },
  duckdb_scalar_function_add_parameter: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_return_type: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_varargs: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_special_handling: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_volatile: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_function: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_bind: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_extra_info: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_bind_data: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_scalar_function_get_extra_info: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  duckdb_scalar_function_bind_get_extra_info: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  duckdb_scalar_function_get_bind_data: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  duckdb_scalar_function_bind_set_error: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },
  duckdb_scalar_function_set_error: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },
  duckdb_scalar_function_get_client_context: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },
  duckdb_register_scalar_function: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
});

const { symbols: shim } = cc({
  source: native.shimPath,
  flags: [`-I${native.includeDir}`],
  symbols: {
    shim_init: { args: [FFIType.cstring], returns: FFIType.i32 },
    shim_query: {
      args: [FFIType.ptr, FFIType.cstring, FFIType.ptr],
      returns: FFIType.i32,
    },
    shim_fetch_chunk: { args: [FFIType.ptr], returns: FFIType.ptr },
    shim_result_return_type: { args: [FFIType.ptr], returns: FFIType.u32 },
    shim_result_statement_type: { args: [FFIType.ptr], returns: FFIType.u32 },
    shim_result_is_streaming: { args: [FFIType.ptr], returns: FFIType.bool },
    shim_result_chunk_count: { args: [FFIType.ptr], returns: FFIType.u64 },
    shim_result_get_chunk: {
      args: [FFIType.ptr, FFIType.u64],
      returns: FFIType.ptr,
    },
    // conversions (by-value structs flattened to scalars / out-pointers)
    shim_to_date: {
      args: [FFIType.i32, FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
    shim_from_date: { args: [FFIType.i32, FFIType.ptr], returns: FFIType.void },
    shim_is_finite_date: { args: [FFIType.i32], returns: FFIType.bool },
    shim_to_time: {
      args: [FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32],
      returns: FFIType.i64,
    },
    shim_from_time: { args: [FFIType.i64, FFIType.ptr], returns: FFIType.void },
    shim_from_time_tz: {
      args: [FFIType.u64, FFIType.ptr],
      returns: FFIType.void,
    },
    shim_to_timestamp: {
      args: [FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32],
      returns: FFIType.i64,
    },
    shim_from_timestamp: {
      args: [FFIType.i64, FFIType.ptr],
      returns: FFIType.void,
    },
    shim_is_finite_timestamp: { args: [FFIType.i64], returns: FFIType.bool },
    shim_is_finite_timestamp_s: { args: [FFIType.i64], returns: FFIType.bool },
    shim_is_finite_timestamp_ms: { args: [FFIType.i64], returns: FFIType.bool },
    shim_is_finite_timestamp_ns: { args: [FFIType.i64], returns: FFIType.bool },
    shim_hugeint_to_double: {
      args: [FFIType.u64, FFIType.i64],
      returns: FFIType.f64,
    },
    shim_double_to_hugeint: {
      args: [FFIType.f64, FFIType.ptr],
      returns: FFIType.void,
    },
    shim_uhugeint_to_double: {
      args: [FFIType.u64, FFIType.u64],
      returns: FFIType.f64,
    },
    shim_double_to_uhugeint: {
      args: [FFIType.f64, FFIType.ptr],
      returns: FFIType.void,
    },
    shim_decimal_to_double: {
      args: [FFIType.u8, FFIType.u8, FFIType.u64, FFIType.i64],
      returns: FFIType.f64,
    },
    shim_double_to_decimal: {
      args: [FFIType.f64, FFIType.u8, FFIType.u8, FFIType.ptr],
      returns: FFIType.void,
    },
    // value creation (by-value struct inputs flattened to scalars)
    shim_create_hugeint: {
      args: [FFIType.u64, FFIType.i64],
      returns: FFIType.ptr,
    },
    shim_create_uhugeint: {
      args: [FFIType.u64, FFIType.u64],
      returns: FFIType.ptr,
    },
    shim_create_decimal: {
      args: [FFIType.u8, FFIType.u8, FFIType.u64, FFIType.i64],
      returns: FFIType.ptr,
    },
    shim_create_date: { args: [FFIType.i32], returns: FFIType.ptr },
    shim_create_time: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_time_ns: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_time_tz_value: { args: [FFIType.u64], returns: FFIType.ptr },
    shim_create_timestamp: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_timestamp_tz: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_timestamp_s: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_timestamp_ms: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_timestamp_ns: { args: [FFIType.i64], returns: FFIType.ptr },
    shim_create_interval: {
      args: [FFIType.i32, FFIType.i32, FFIType.i64],
      returns: FFIType.ptr,
    },
    shim_create_uuid: { args: [FFIType.u64, FFIType.u64], returns: FFIType.ptr },
    shim_create_bit: { args: [FFIType.ptr, FFIType.u64], returns: FFIType.ptr },
    shim_create_bignum: {
      args: [FFIType.ptr, FFIType.u64, FFIType.bool],
      returns: FFIType.ptr,
    },
    shim_create_double_bits: { args: [FFIType.u64], returns: FFIType.ptr },
    // value extraction (by-value struct outputs)
    shim_get_date: { args: [FFIType.ptr], returns: FFIType.i32 },
    shim_get_time: { args: [FFIType.ptr], returns: FFIType.i64 },
    shim_get_timestamp: { args: [FFIType.ptr], returns: FFIType.i64 },
    shim_get_hugeint: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
    shim_get_uhugeint: {
      args: [FFIType.ptr, FFIType.ptr],
      returns: FFIType.void,
    },
    shim_get_decimal: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.void },
    shim_get_interval: {
      args: [FFIType.ptr, FFIType.ptr],
      returns: FFIType.void,
    },
    // appender (by-value struct inputs)
    shim_append_hugeint: {
      args: [FFIType.ptr, FFIType.u64, FFIType.i64],
      returns: FFIType.i32,
    },
    shim_append_uhugeint: {
      args: [FFIType.ptr, FFIType.u64, FFIType.u64],
      returns: FFIType.i32,
    },
    shim_append_date: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    shim_append_time: { args: [FFIType.ptr, FFIType.i64], returns: FFIType.i32 },
    shim_append_timestamp: {
      args: [FFIType.ptr, FFIType.i64],
      returns: FFIType.i32,
    },
    shim_append_interval: {
      args: [FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i64],
      returns: FFIType.i32,
    },
  },
});

/** Null-terminated C-string buffer for cc-compiled cstring args (which, unlike
 * dlopen symbols, do not auto-encode JS strings). */
export function cstr(s: string): Buffer {
  return Buffer.from(`${s}\0`, "utf8");
}

if (shim.shim_init(cstr(native.libPath)) !== 0) {
  throw new Error(`duckdb-bun: shim failed to dlopen libduckdb at ${native.libPath}`);
}

export const lib = { ...base, ...shim };
export const DUCKDB_SUCCESS = 0;

// Re-export the bun:ffi primitives the impl modules need, so they import from one
// place and we can swap representations later without touching every module.
export { CString, ptr, read, toArrayBuffer };

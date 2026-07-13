// AUTO-GENERATED barrel for the @duckdb/node-bindings surface. Implemented
// functions are re-exported from ./impl/*; the rest are NotImplemented stubs so
// gaps surface loudly, never silently. Regenerate with
// `bun run scripts/gen-bindings-scaffold.ts` after adding impl functions.
export class NotImplemented extends Error {
  constructor(fn: string) {
    super(`@duckdb/node-bindings: '${fn}' is not implemented yet (duckdb-bun)`);
    this.name = "NotImplemented";
  }
}

// --- implemented (225/273) ---
export * from "./impl/appender.ts";
export * from "./impl/chunk.ts";
export * from "./impl/conversions.ts";
export * from "./impl/core.ts";
export * from "./impl/logicaltype.ts";
export * from "./impl/pending.ts";
export * from "./impl/prepared.ts";
export * from "./impl/results.ts";
export * from "./impl/scalar.ts";
export * from "./impl/statements.ts";
export * from "./impl/valuecreate.ts";
export * from "./impl/values.ts";
export * from "./impl/vector.ts";

// --- not yet implemented (48) ---
export function query_progress(..._args: unknown[]): never {
  throw new NotImplemented("query_progress");
}

export function create_time_tz(..._args: unknown[]): never {
  throw new NotImplemented("create_time_tz");
}

export function bind_hugeint(..._args: unknown[]): never {
  throw new NotImplemented("bind_hugeint");
}

export function bind_uhugeint(..._args: unknown[]): never {
  throw new NotImplemented("bind_uhugeint");
}

export function bind_decimal(..._args: unknown[]): never {
  throw new NotImplemented("bind_decimal");
}

export function bind_date(..._args: unknown[]): never {
  throw new NotImplemented("bind_date");
}

export function bind_time(..._args: unknown[]): never {
  throw new NotImplemented("bind_time");
}

export function bind_timestamp(..._args: unknown[]): never {
  throw new NotImplemented("bind_timestamp");
}

export function bind_timestamp_tz(..._args: unknown[]): never {
  throw new NotImplemented("bind_timestamp_tz");
}

export function bind_interval(..._args: unknown[]): never {
  throw new NotImplemented("bind_interval");
}

export function get_bool(..._args: unknown[]): never {
  throw new NotImplemented("get_bool");
}

export function get_int8(..._args: unknown[]): never {
  throw new NotImplemented("get_int8");
}

export function get_uint8(..._args: unknown[]): never {
  throw new NotImplemented("get_uint8");
}

export function get_int16(..._args: unknown[]): never {
  throw new NotImplemented("get_int16");
}

export function get_uint16(..._args: unknown[]): never {
  throw new NotImplemented("get_uint16");
}

export function get_int32(..._args: unknown[]): never {
  throw new NotImplemented("get_int32");
}

export function get_uint32(..._args: unknown[]): never {
  throw new NotImplemented("get_uint32");
}

export function get_int64(..._args: unknown[]): never {
  throw new NotImplemented("get_int64");
}

export function get_uint64(..._args: unknown[]): never {
  throw new NotImplemented("get_uint64");
}

export function get_hugeint(..._args: unknown[]): never {
  throw new NotImplemented("get_hugeint");
}

export function get_uhugeint(..._args: unknown[]): never {
  throw new NotImplemented("get_uhugeint");
}

export function get_bignum(..._args: unknown[]): never {
  throw new NotImplemented("get_bignum");
}

export function get_decimal(..._args: unknown[]): never {
  throw new NotImplemented("get_decimal");
}

export function get_float(..._args: unknown[]): never {
  throw new NotImplemented("get_float");
}

export function get_double(..._args: unknown[]): never {
  throw new NotImplemented("get_double");
}

export function get_date(..._args: unknown[]): never {
  throw new NotImplemented("get_date");
}

export function get_time(..._args: unknown[]): never {
  throw new NotImplemented("get_time");
}

export function get_time_ns(..._args: unknown[]): never {
  throw new NotImplemented("get_time_ns");
}

export function get_time_tz(..._args: unknown[]): never {
  throw new NotImplemented("get_time_tz");
}

export function get_timestamp(..._args: unknown[]): never {
  throw new NotImplemented("get_timestamp");
}

export function get_timestamp_tz(..._args: unknown[]): never {
  throw new NotImplemented("get_timestamp_tz");
}

export function get_timestamp_s(..._args: unknown[]): never {
  throw new NotImplemented("get_timestamp_s");
}

export function get_timestamp_ms(..._args: unknown[]): never {
  throw new NotImplemented("get_timestamp_ms");
}

export function get_timestamp_ns(..._args: unknown[]): never {
  throw new NotImplemented("get_timestamp_ns");
}

export function get_interval(..._args: unknown[]): never {
  throw new NotImplemented("get_interval");
}

export function get_value_type(..._args: unknown[]): never {
  throw new NotImplemented("get_value_type");
}

export function get_blob(..._args: unknown[]): never {
  throw new NotImplemented("get_blob");
}

export function get_bit(..._args: unknown[]): never {
  throw new NotImplemented("get_bit");
}

export function get_uuid(..._args: unknown[]): never {
  throw new NotImplemented("get_uuid");
}

export function get_map_size(..._args: unknown[]): never {
  throw new NotImplemented("get_map_size");
}

export function get_map_key(..._args: unknown[]): never {
  throw new NotImplemented("get_map_key");
}

export function get_map_value(..._args: unknown[]): never {
  throw new NotImplemented("get_map_value");
}

export function get_enum_value(..._args: unknown[]): never {
  throw new NotImplemented("get_enum_value");
}

export function get_struct_child(..._args: unknown[]): never {
  throw new NotImplemented("get_struct_child");
}

export function validity_row_is_valid(..._args: unknown[]): never {
  throw new NotImplemented("validity_row_is_valid");
}

export function validity_set_row_validity(..._args: unknown[]): never {
  throw new NotImplemented("validity_set_row_validity");
}

export function validity_set_row_invalid(..._args: unknown[]): never {
  throw new NotImplemented("validity_set_row_invalid");
}

export function validity_set_row_valid(..._args: unknown[]): never {
  throw new NotImplemented("validity_set_row_valid");
}

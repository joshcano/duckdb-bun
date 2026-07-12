// Mirror of the `DUCKDB_TYPE` enum from vendor/duckdb.h (v1.5.2).
export const DuckDBType = {
  INVALID: 0,
  BOOLEAN: 1,
  TINYINT: 2,
  SMALLINT: 3,
  INTEGER: 4,
  BIGINT: 5,
  UTINYINT: 6,
  USMALLINT: 7,
  UINTEGER: 8,
  UBIGINT: 9,
  FLOAT: 10,
  DOUBLE: 11,
  TIMESTAMP: 12,
  DATE: 13,
  TIME: 14,
  INTERVAL: 15,
  HUGEINT: 16,
  VARCHAR: 17,
  BLOB: 18,
  DECIMAL: 19,
  TIMESTAMP_S: 20,
  TIMESTAMP_MS: 21,
  TIMESTAMP_NS: 22,
  ENUM: 23,
  LIST: 24,
  STRUCT: 25,
  MAP: 26,
  UUID: 27,
  BIT: 29,
  TIME_TZ: 30,
  TIMESTAMP_TZ: 31,
  UHUGEINT: 32,
  ARRAY: 33,
  BIGNUM: 35,
  SQLNULL: 36,
} as const;

// Metadata needed to decode a result column: its type id plus (for DECIMAL) the
// scale and the integer storage type the decimal is stored as.
export interface ColumnType {
  id: number;
  scale?: number;
  internal?: number;
}

export interface QueryResultShape {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

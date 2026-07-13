// AUTO-GENERATED scaffold: compile-time-only interfaces + type aliases mirroring
// @duckdb/node-bindings. Handles (Connection, Result, Vector, ...) are opaque at
// runtime (pointers / wrapper objects); these brands only line up the types.
import type { PendingState, ResultType, StatementType, Type } from "./enums.ts";

// Referenced by some interfaces below; imported so this file is self-contained.
export type { PendingState, ResultType, StatementType, Type };

export interface Date_ {
  /** Days since 1970-01-01 */
  days: number;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface Decimal {
  width: number;
  scale: number;
  value: bigint;
}

export interface Interval {
  months: number;
  days: number;
  micros: bigint;
}

export interface QueryProgress {
  percentage: number;
  rows_processed: bigint;
  total_rows_to_process: bigint;
}

export interface Time {
  /** Microseconds since 00:00:00 */
  micros: bigint;
}

export interface TimeParts {
  hour: number;
  min: number;
  sec: number;
  micros: number;
}

export interface TimeNS {
  /** Nanoseconds since 00:00:00 */
  nanos: bigint;
}

export interface TimeTZ {
  /**
   * 40 bits for micros, then 24 bits for encoded offset in seconds.
   *
   * Max absolute unencoded offset = 15:59:59 = 60 * (60 * 15 + 59) + 59 = 57599.
   *
   * Encoded offset is unencoded offset inverted then shifted (by +57599) to unsigned.
   *
   * Max unencoded offset = 57599 -> -57599 -> 0 encoded.
   *
   * Min unencoded offset = -57599 -> 57599 -> 115198 encoded.
   */
  bits: bigint;
}

export interface TimeTZParts {
  time: TimeParts;
  /** Offset in seconds, from -15:59:59 = -57599 to 15:59:59 = 57599 */
  offset: number;
}

export interface Timestamp {
  /** Microseconds since 1970-01-01 */
  micros: bigint;
}

export interface TimestampSeconds {
  /** Seconds since 1970-01-01 */
  seconds: bigint;
}

export interface TimestampMilliseconds {
  /** Milliseconds since 1970-01-01 */
  millis: bigint;
}

export interface TimestampNanoseconds {
  /** Nanoseconds since 1970-01-01 */
  nanos: bigint;
}

export interface TimestampParts {
  date: DateParts;
  time: TimeParts;
}

export interface BindInfo {
  __duckdb_type: "duckdb_bind_info";
}

export interface FunctionInfo {
  __duckdb_type: "duckdb_function_info";
}

export interface Vector {
  __duckdb_type: "duckdb_vector";
}

export interface Appender {
  __duckdb_type: "duckdb_appender";
}

export interface ClientContext {
  __duckdb_type: "duckdb_client_context";
}

export interface Config {
  __duckdb_type: "duckdb_config";
}

export interface Connection {
  __duckdb_type: "duckdb_connection";
}

export interface Database {
  __duckdb_type: "duckdb_database";
}

export interface DataChunk {
  __duckdb_type: "duckdb_data_chunk";
}

export interface ExtractedStatements {
  __duckdb_type: "duckdb_extracted_statements";
}

export interface InstanceCache {
  __duckdb_type: "duckdb_instance_cache";
}

export interface LogicalType {
  __duckdb_type: "duckdb_logical_type";
}

export interface PendingResult {
  __duckdb_type: "duckdb_pending_result";
}

export interface PreparedStatement {
  __duckdb_type: "duckdb_prepared_statement";
}

export interface Result {
  __duckdb_type: "duckdb_result";
}

export interface ScalarFunction {
  __duckdb_type: "duckdb_scalar_function";
}

export interface Value {
  __duckdb_type: "duckdb_value";
}

export interface ConfigFlag {
  name: string;
  description: string;
}

export interface ExtractedStatementsAndCount {
  extracted_statements: ExtractedStatements;
  statement_count: number;
}

export type ScalarFunctionBindFunction = (info: BindInfo) => void;

export type ScalarFunctionMainFunction = (info: FunctionInfo, input: DataChunk, output: Vector) => void;

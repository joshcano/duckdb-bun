// bigint <-> (lower, upper) u64 pair marshaling for the 128-bit C types
// (duckdb_hugeint / duckdb_uhugeint / duckdb_decimal.value). The shim reads/writes
// these as two 64-bit words; JS sees a single bigint.

/** Split a signed 128-bit bigint into (lower: u64, upper: i64) for shim args. */
export function splitI128(v: bigint): { lower: bigint; upper: bigint } {
  return { lower: BigInt.asUintN(64, v), upper: BigInt.asIntN(64, v >> 64n) };
}

/** Split an unsigned 128-bit bigint into (lower: u64, upper: u64). */
export function splitU128(v: bigint): { lower: bigint; upper: bigint } {
  return { lower: BigInt.asUintN(64, v), upper: BigInt.asUintN(64, v >> 64n) };
}

/** Recombine a signed 128-bit value from two u64 words (as read from a
 * BigUint64Array, so `upper` is reinterpreted as signed). */
export function joinI128(lower: bigint, upper: bigint): bigint {
  return (BigInt.asIntN(64, upper) << 64n) + lower;
}

/** Recombine an unsigned 128-bit value from two u64 words. */
export function joinU128(lower: bigint, upper: bigint): bigint {
  return (upper << 64n) | lower;
}

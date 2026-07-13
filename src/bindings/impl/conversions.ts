// Date/time/timestamp part<->value conversions, is_finite predicates, and
// numeric (hugeint/decimal <-> double) conversions. Each wraps a cc shim that
// flattens the by-value C struct into scalars + out-pointers. Input/return shapes
// match the node-api interfaces (Date_{days}, Time{micros}, Interval, Decimal, ...).
import { lib, ptr } from "../ffi.ts";
import { joinI128, joinU128, splitI128, splitU128 } from "../marshal.ts";

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; min: number; sec: number; micros: number };

export function is_finite_date(date: { days: number }): boolean {
  return lib.shim_is_finite_date(date.days);
}

export function from_date(date: { days: number }): DateParts {
  const out = new Int32Array(3);
  lib.shim_from_date(date.days, ptr(out));
  return { year: out[0], month: out[1], day: out[2] };
}

export function to_date(parts: DateParts): { days: number } {
  return { days: lib.shim_to_date(parts.year, parts.month, parts.day) };
}

export function from_time(time: { micros: bigint }): TimeParts {
  const out = new Int32Array(4);
  lib.shim_from_time(time.micros, ptr(out));
  return { hour: out[0], min: out[1], sec: out[2], micros: out[3] };
}

export function to_time(parts: TimeParts): { micros: bigint } {
  return {
    micros: lib.shim_to_time(parts.hour, parts.min, parts.sec, parts.micros),
  };
}

export function from_time_tz(timeTz: { bits: bigint }): { time: TimeParts; offset: number } {
  const out = new Int32Array(5);
  lib.shim_from_time_tz(timeTz.bits, ptr(out));
  return {
    time: { hour: out[0], min: out[1], sec: out[2], micros: out[3] },
    offset: out[4],
  };
}

export function from_timestamp(ts: { micros: bigint }): { date: DateParts; time: TimeParts } {
  const out = new Int32Array(7);
  lib.shim_from_timestamp(ts.micros, ptr(out));
  return {
    date: { year: out[0], month: out[1], day: out[2] },
    time: { hour: out[3], min: out[4], sec: out[5], micros: out[6] },
  };
}

export function to_timestamp(parts: { date: DateParts; time: TimeParts }): { micros: bigint } {
  return {
    micros: lib.shim_to_timestamp(
      parts.date.year,
      parts.date.month,
      parts.date.day,
      parts.time.hour,
      parts.time.min,
      parts.time.sec,
      parts.time.micros,
    ),
  };
}

export function is_finite_timestamp(ts: { micros: bigint }): boolean {
  return lib.shim_is_finite_timestamp(ts.micros);
}

export function is_finite_timestamp_s(ts: { seconds: bigint }): boolean {
  return lib.shim_is_finite_timestamp_s(ts.seconds);
}

export function is_finite_timestamp_ms(ts: { millis: bigint }): boolean {
  return lib.shim_is_finite_timestamp_ms(ts.millis);
}

export function is_finite_timestamp_ns(ts: { nanos: bigint }): boolean {
  return lib.shim_is_finite_timestamp_ns(ts.nanos);
}

export function hugeint_to_double(value: bigint): number {
  const { lower, upper } = splitI128(value);
  return lib.shim_hugeint_to_double(lower, upper);
}

export function double_to_hugeint(value: number): bigint {
  const out = new BigUint64Array(2);
  lib.shim_double_to_hugeint(value, ptr(out));
  return joinI128(out[0], out[1]);
}

export function uhugeint_to_double(value: bigint): number {
  const { lower, upper } = splitU128(value);
  return lib.shim_uhugeint_to_double(lower, upper);
}

export function double_to_uhugeint(value: number): bigint {
  const out = new BigUint64Array(2);
  lib.shim_double_to_uhugeint(value, ptr(out));
  return joinU128(out[0], out[1]);
}

export function decimal_to_double(decimal: { width: number; scale: number; value: bigint }): number {
  const { lower, upper } = splitI128(decimal.value);
  return lib.shim_decimal_to_double(decimal.width, decimal.scale, lower, upper);
}

export function double_to_decimal(
  value: number,
  width: number,
  scale: number,
): { width: number; scale: number; value: bigint } {
  const out = new BigUint64Array(2);
  lib.shim_double_to_decimal(value, width, scale, ptr(out));
  return { width, scale, value: joinI128(out[0], out[1]) };
}

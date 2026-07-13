// Pointer/scalar-based wrappers around the duckdb C-API functions that take or
// return structs BY VALUE — bun:ffi's dlopen cannot pass/return structs, but this
// shim (compiled via bun:ffi `cc`) resolves the real symbols with dlsym and calls
// them through function pointers, exposing a purely scalar/pointer FFI surface.
// No link-time libduckdb needed.
#include "duckdb.h"
#include <dlfcn.h>

static void *H;
#define RESOLVE(name) (dlsym(H, #name))

// --- result (by-value duckdb_result) ---
static duckdb_data_chunk (*p_fetch_chunk)(duckdb_result);
static duckdb_state (*p_query)(duckdb_connection, const char *, duckdb_result *);
static duckdb_result_type (*p_result_return_type)(duckdb_result);
static duckdb_statement_type (*p_result_statement_type)(duckdb_result);
static bool (*p_result_is_streaming)(duckdb_result);
static idx_t (*p_result_chunk_count)(duckdb_result);
static duckdb_data_chunk (*p_result_get_chunk)(duckdb_result, idx_t);

// --- date/time/timestamp conversions (by-value structs) ---
static duckdb_date_struct (*p_from_date)(duckdb_date);
static duckdb_date (*p_to_date)(duckdb_date_struct);
static bool (*p_is_finite_date)(duckdb_date);
static duckdb_time_struct (*p_from_time)(duckdb_time);
static duckdb_time (*p_to_time)(duckdb_time_struct);
static duckdb_time_tz_struct (*p_from_time_tz)(duckdb_time_tz);
static duckdb_timestamp_struct (*p_from_timestamp)(duckdb_timestamp);
static duckdb_timestamp (*p_to_timestamp)(duckdb_timestamp_struct);
static bool (*p_is_finite_timestamp)(duckdb_timestamp);
static bool (*p_is_finite_timestamp_s)(duckdb_timestamp_s);
static bool (*p_is_finite_timestamp_ms)(duckdb_timestamp_ms);
static bool (*p_is_finite_timestamp_ns)(duckdb_timestamp_ns);

// --- numeric conversions (by-value hugeint/decimal) ---
static double (*p_hugeint_to_double)(duckdb_hugeint);
static duckdb_hugeint (*p_double_to_hugeint)(double);
static double (*p_uhugeint_to_double)(duckdb_uhugeint);
static duckdb_uhugeint (*p_double_to_uhugeint)(double);
static double (*p_decimal_to_double)(duckdb_decimal);
static duckdb_decimal (*p_double_to_decimal)(double, uint8_t, uint8_t);

// --- value creation (by-value struct inputs) ---
static duckdb_value (*p_create_hugeint)(duckdb_hugeint);
static duckdb_value (*p_create_uhugeint)(duckdb_uhugeint);
static duckdb_value (*p_create_decimal)(duckdb_decimal);
static duckdb_value (*p_create_date)(duckdb_date);
static duckdb_value (*p_create_time)(duckdb_time);
static duckdb_value (*p_create_time_ns)(duckdb_time_ns);
static duckdb_value (*p_create_time_tz_value)(duckdb_time_tz);
static duckdb_value (*p_create_timestamp)(duckdb_timestamp);
static duckdb_value (*p_create_timestamp_tz)(duckdb_timestamp);
static duckdb_value (*p_create_timestamp_s)(duckdb_timestamp_s);
static duckdb_value (*p_create_timestamp_ms)(duckdb_timestamp_ms);
static duckdb_value (*p_create_timestamp_ns)(duckdb_timestamp_ns);
static duckdb_value (*p_create_interval)(duckdb_interval);
static duckdb_value (*p_create_uuid)(duckdb_uhugeint);
static duckdb_value (*p_create_bit)(duckdb_bit);
static duckdb_value (*p_create_bignum)(duckdb_bignum);
static duckdb_value (*p_create_double)(double);

// --- appender (by-value struct inputs) ---
static duckdb_state (*p_append_hugeint)(duckdb_appender, duckdb_hugeint);
static duckdb_state (*p_append_uhugeint)(duckdb_appender, duckdb_uhugeint);
static duckdb_state (*p_append_date)(duckdb_appender, duckdb_date);
static duckdb_state (*p_append_time)(duckdb_appender, duckdb_time);
static duckdb_state (*p_append_timestamp)(duckdb_appender, duckdb_timestamp);
static duckdb_state (*p_append_interval)(duckdb_appender, duckdb_interval);

// --- value extraction (by-value struct outputs) ---
static duckdb_hugeint (*p_get_hugeint)(duckdb_value);
static duckdb_uhugeint (*p_get_uhugeint)(duckdb_value);
static duckdb_decimal (*p_get_decimal)(duckdb_value);
static duckdb_date (*p_get_date)(duckdb_value);
static duckdb_time (*p_get_time)(duckdb_value);
static duckdb_timestamp (*p_get_timestamp)(duckdb_value);
static duckdb_interval (*p_get_interval)(duckdb_value);

int shim_init(const char *libpath) {
  H = dlopen(libpath, RTLD_NOW | RTLD_GLOBAL);
  if (!H) return 1;
  p_fetch_chunk = RESOLVE(duckdb_fetch_chunk);
  p_query = RESOLVE(duckdb_query);
  p_result_return_type = RESOLVE(duckdb_result_return_type);
  p_result_statement_type = RESOLVE(duckdb_result_statement_type);
  p_result_is_streaming = RESOLVE(duckdb_result_is_streaming);
  p_result_chunk_count = RESOLVE(duckdb_result_chunk_count);
  p_result_get_chunk = RESOLVE(duckdb_result_get_chunk);
  p_from_date = RESOLVE(duckdb_from_date);
  p_to_date = RESOLVE(duckdb_to_date);
  p_is_finite_date = RESOLVE(duckdb_is_finite_date);
  p_from_time = RESOLVE(duckdb_from_time);
  p_to_time = RESOLVE(duckdb_to_time);
  p_from_time_tz = RESOLVE(duckdb_from_time_tz);
  p_from_timestamp = RESOLVE(duckdb_from_timestamp);
  p_to_timestamp = RESOLVE(duckdb_to_timestamp);
  p_is_finite_timestamp = RESOLVE(duckdb_is_finite_timestamp);
  p_is_finite_timestamp_s = RESOLVE(duckdb_is_finite_timestamp_s);
  p_is_finite_timestamp_ms = RESOLVE(duckdb_is_finite_timestamp_ms);
  p_is_finite_timestamp_ns = RESOLVE(duckdb_is_finite_timestamp_ns);
  p_hugeint_to_double = RESOLVE(duckdb_hugeint_to_double);
  p_double_to_hugeint = RESOLVE(duckdb_double_to_hugeint);
  p_uhugeint_to_double = RESOLVE(duckdb_uhugeint_to_double);
  p_double_to_uhugeint = RESOLVE(duckdb_double_to_uhugeint);
  p_decimal_to_double = RESOLVE(duckdb_decimal_to_double);
  p_double_to_decimal = RESOLVE(duckdb_double_to_decimal);
  p_create_hugeint = RESOLVE(duckdb_create_hugeint);
  p_create_uhugeint = RESOLVE(duckdb_create_uhugeint);
  p_create_decimal = RESOLVE(duckdb_create_decimal);
  p_create_date = RESOLVE(duckdb_create_date);
  p_create_time = RESOLVE(duckdb_create_time);
  p_create_time_ns = RESOLVE(duckdb_create_time_ns);
  p_create_time_tz_value = RESOLVE(duckdb_create_time_tz_value);
  p_create_timestamp = RESOLVE(duckdb_create_timestamp);
  p_create_timestamp_tz = RESOLVE(duckdb_create_timestamp_tz);
  p_create_timestamp_s = RESOLVE(duckdb_create_timestamp_s);
  p_create_timestamp_ms = RESOLVE(duckdb_create_timestamp_ms);
  p_create_timestamp_ns = RESOLVE(duckdb_create_timestamp_ns);
  p_create_interval = RESOLVE(duckdb_create_interval);
  p_create_uuid = RESOLVE(duckdb_create_uuid);
  p_create_bit = RESOLVE(duckdb_create_bit);
  p_create_bignum = RESOLVE(duckdb_create_bignum);
  p_create_double = RESOLVE(duckdb_create_double);
  p_get_hugeint = RESOLVE(duckdb_get_hugeint);
  p_get_uhugeint = RESOLVE(duckdb_get_uhugeint);
  p_get_decimal = RESOLVE(duckdb_get_decimal);
  p_get_date = RESOLVE(duckdb_get_date);
  p_get_time = RESOLVE(duckdb_get_time);
  p_get_timestamp = RESOLVE(duckdb_get_timestamp);
  p_get_interval = RESOLVE(duckdb_get_interval);
  p_append_hugeint = RESOLVE(duckdb_append_hugeint);
  p_append_uhugeint = RESOLVE(duckdb_append_uhugeint);
  p_append_date = RESOLVE(duckdb_append_date);
  p_append_time = RESOLVE(duckdb_append_time);
  p_append_timestamp = RESOLVE(duckdb_append_timestamp);
  p_append_interval = RESOLVE(duckdb_append_interval);
  // Only the two originally-required symbols gate success, so the legacy bespoke
  // FFI table that also compiles this shim keeps working unchanged.
  return (p_fetch_chunk && p_query) ? 0 : 2;
}

// ---- results ----
int shim_query(duckdb_connection conn, const char *sql, duckdb_result *out) {
  return (int)p_query(conn, sql, out);
}
duckdb_data_chunk shim_fetch_chunk(duckdb_result *result) {
  return p_fetch_chunk(*result);
}
duckdb_result_type shim_result_return_type(duckdb_result *r) { return p_result_return_type(*r); }
duckdb_statement_type shim_result_statement_type(duckdb_result *r) { return p_result_statement_type(*r); }
bool shim_result_is_streaming(duckdb_result *r) { return p_result_is_streaming(*r); }
idx_t shim_result_chunk_count(duckdb_result *r) { return p_result_chunk_count(*r); }
duckdb_data_chunk shim_result_get_chunk(duckdb_result *r, idx_t i) { return p_result_get_chunk(*r, i); }

// ---- date ----
int32_t shim_to_date(int32_t year, int32_t month, int32_t day) {
  duckdb_date_struct s = {year, (int8_t)month, (int8_t)day};
  return p_to_date(s).days;
}
// out: [year, month, day] as int32
void shim_from_date(int32_t days, int32_t *out) {
  duckdb_date d = {days};
  duckdb_date_struct s = p_from_date(d);
  out[0] = s.year;
  out[1] = s.month;
  out[2] = s.day;
}
bool shim_is_finite_date(int32_t days) {
  duckdb_date d = {days};
  return p_is_finite_date(d);
}

// ---- time ----
int64_t shim_to_time(int32_t hour, int32_t min, int32_t sec, int32_t micros) {
  duckdb_time_struct s = {(int8_t)hour, (int8_t)min, (int8_t)sec, micros};
  return p_to_time(s).micros;
}
// out: [hour, min, sec, micros] as int32
void shim_from_time(int64_t micros, int32_t *out) {
  duckdb_time t = {micros};
  duckdb_time_struct s = p_from_time(t);
  out[0] = s.hour;
  out[1] = s.min;
  out[2] = s.sec;
  out[3] = s.micros;
}
// out: [hour, min, sec, micros, offset] as int32
void shim_from_time_tz(uint64_t bits, int32_t *out) {
  duckdb_time_tz t = {bits};
  duckdb_time_tz_struct s = p_from_time_tz(t);
  out[0] = s.time.hour;
  out[1] = s.time.min;
  out[2] = s.time.sec;
  out[3] = s.time.micros;
  out[4] = s.offset;
}

// ---- timestamp ----
int64_t shim_to_timestamp(int32_t year, int32_t month, int32_t day, int32_t hour,
                          int32_t min, int32_t sec, int32_t micros) {
  duckdb_timestamp_struct s;
  s.date.year = year;
  s.date.month = (int8_t)month;
  s.date.day = (int8_t)day;
  s.time.hour = (int8_t)hour;
  s.time.min = (int8_t)min;
  s.time.sec = (int8_t)sec;
  s.time.micros = micros;
  return p_to_timestamp(s).micros;
}
// out: [year, month, day, hour, min, sec, micros] as int32
void shim_from_timestamp(int64_t micros, int32_t *out) {
  duckdb_timestamp t = {micros};
  duckdb_timestamp_struct s = p_from_timestamp(t);
  out[0] = s.date.year;
  out[1] = s.date.month;
  out[2] = s.date.day;
  out[3] = s.time.hour;
  out[4] = s.time.min;
  out[5] = s.time.sec;
  out[6] = s.time.micros;
}
bool shim_is_finite_timestamp(int64_t micros) {
  duckdb_timestamp t = {micros};
  return p_is_finite_timestamp(t);
}
bool shim_is_finite_timestamp_s(int64_t seconds) {
  duckdb_timestamp_s t = {seconds};
  return p_is_finite_timestamp_s(t);
}
bool shim_is_finite_timestamp_ms(int64_t millis) {
  duckdb_timestamp_ms t = {millis};
  return p_is_finite_timestamp_ms(t);
}
bool shim_is_finite_timestamp_ns(int64_t nanos) {
  duckdb_timestamp_ns t = {nanos};
  return p_is_finite_timestamp_ns(t);
}

// ---- numeric ----
double shim_hugeint_to_double(uint64_t lower, int64_t upper) {
  duckdb_hugeint h = {lower, upper};
  return p_hugeint_to_double(h);
}
// out: [lower(u64), upper(i64)]
void shim_double_to_hugeint(double v, uint64_t *out) {
  duckdb_hugeint h = p_double_to_hugeint(v);
  out[0] = h.lower;
  ((int64_t *)out)[1] = h.upper;
}
double shim_uhugeint_to_double(uint64_t lower, uint64_t upper) {
  duckdb_uhugeint h = {lower, upper};
  return p_uhugeint_to_double(h);
}
void shim_double_to_uhugeint(double v, uint64_t *out) {
  duckdb_uhugeint h = p_double_to_uhugeint(v);
  out[0] = h.lower;
  out[1] = h.upper;
}
double shim_decimal_to_double(uint8_t width, uint8_t scale, uint64_t lower, int64_t upper) {
  duckdb_decimal d;
  d.width = width;
  d.scale = scale;
  d.value.lower = lower;
  d.value.upper = upper;
  return p_decimal_to_double(d);
}
// out: [value.lower(u64), value.upper(i64)]
void shim_double_to_decimal(double v, uint8_t width, uint8_t scale, uint64_t *out) {
  duckdb_decimal d = p_double_to_decimal(v, width, scale);
  out[0] = d.value.lower;
  ((int64_t *)out)[1] = d.value.upper;
}

// ---- value creation ----
duckdb_value shim_create_hugeint(uint64_t lower, int64_t upper) {
  duckdb_hugeint h = {lower, upper};
  return p_create_hugeint(h);
}
duckdb_value shim_create_uhugeint(uint64_t lower, uint64_t upper) {
  duckdb_uhugeint h = {lower, upper};
  return p_create_uhugeint(h);
}
duckdb_value shim_create_decimal(uint8_t width, uint8_t scale, uint64_t lower, int64_t upper) {
  duckdb_decimal d;
  d.width = width;
  d.scale = scale;
  d.value.lower = lower;
  d.value.upper = upper;
  return p_create_decimal(d);
}
duckdb_value shim_create_date(int32_t days) {
  duckdb_date d = {days};
  return p_create_date(d);
}
duckdb_value shim_create_time(int64_t micros) {
  duckdb_time t = {micros};
  return p_create_time(t);
}
duckdb_value shim_create_time_ns(int64_t nanos) {
  duckdb_time_ns t = {nanos};
  return p_create_time_ns(t);
}
duckdb_value shim_create_time_tz_value(uint64_t bits) {
  duckdb_time_tz t = {bits};
  return p_create_time_tz_value(t);
}
duckdb_value shim_create_timestamp(int64_t micros) {
  duckdb_timestamp t = {micros};
  return p_create_timestamp(t);
}
duckdb_value shim_create_timestamp_tz(int64_t micros) {
  duckdb_timestamp t = {micros};
  return p_create_timestamp_tz(t);
}
duckdb_value shim_create_timestamp_s(int64_t seconds) {
  duckdb_timestamp_s t = {seconds};
  return p_create_timestamp_s(t);
}
duckdb_value shim_create_timestamp_ms(int64_t millis) {
  duckdb_timestamp_ms t = {millis};
  return p_create_timestamp_ms(t);
}
duckdb_value shim_create_timestamp_ns(int64_t nanos) {
  duckdb_timestamp_ns t = {nanos};
  return p_create_timestamp_ns(t);
}
duckdb_value shim_create_interval(int32_t months, int32_t days, int64_t micros) {
  duckdb_interval iv = {months, days, micros};
  return p_create_interval(iv);
}
duckdb_value shim_create_uuid(uint64_t lower, uint64_t upper) {
  duckdb_uhugeint h = {lower, upper};
  return p_create_uuid(h);
}
duckdb_value shim_create_bit(const uint8_t *data, idx_t size) {
  duckdb_bit b = {(uint8_t *)data, size};
  return p_create_bit(b);
}
// data = little-endian magnitude bytes; sign carried separately.
duckdb_value shim_create_bignum(const uint8_t *data, idx_t size, bool is_negative) {
  duckdb_bignum b = {(uint8_t *)data, size, is_negative};
  return p_create_bignum(b);
}
// Bun's FFIType.f64 argument marshaling collapses NaN to 0; pass the exact 64-bit
// pattern instead and reinterpret it here so NaN (and any exact double) survives.
duckdb_value shim_create_double_bits(uint64_t bits) {
  union {
    uint64_t u;
    double d;
  } u;
  u.u = bits;
  return p_create_double(u.d);
}

// ---- appender (by-value struct inputs) ----
int shim_append_hugeint(duckdb_appender a, uint64_t lower, int64_t upper) {
  duckdb_hugeint h = {lower, upper};
  return (int)p_append_hugeint(a, h);
}
int shim_append_uhugeint(duckdb_appender a, uint64_t lower, uint64_t upper) {
  duckdb_uhugeint h = {lower, upper};
  return (int)p_append_uhugeint(a, h);
}
int shim_append_date(duckdb_appender a, int32_t days) {
  duckdb_date d = {days};
  return (int)p_append_date(a, d);
}
int shim_append_time(duckdb_appender a, int64_t micros) {
  duckdb_time t = {micros};
  return (int)p_append_time(a, t);
}
int shim_append_timestamp(duckdb_appender a, int64_t micros) {
  duckdb_timestamp t = {micros};
  return (int)p_append_timestamp(a, t);
}
int shim_append_interval(duckdb_appender a, int32_t months, int32_t days, int64_t micros) {
  duckdb_interval iv = {months, days, micros};
  return (int)p_append_interval(a, iv);
}

// ---- value extraction (by-value struct outputs) ----
int32_t shim_get_date(duckdb_value v) { return p_get_date(v).days; }
int64_t shim_get_time(duckdb_value v) { return p_get_time(v).micros; }
int64_t shim_get_timestamp(duckdb_value v) { return p_get_timestamp(v).micros; }
// out: [lower(u64), upper(i64)]
void shim_get_hugeint(duckdb_value v, uint64_t *out) {
  duckdb_hugeint h = p_get_hugeint(v);
  out[0] = h.lower;
  ((int64_t *)out)[1] = h.upper;
}
void shim_get_uhugeint(duckdb_value v, uint64_t *out) {
  duckdb_uhugeint h = p_get_uhugeint(v);
  out[0] = h.lower;
  out[1] = h.upper;
}
// out: [width(u8)@0, scale(u8)@1, lower(u64)@8, upper(i64)@16] (24-byte buffer)
void shim_get_decimal(duckdb_value v, uint8_t *out) {
  duckdb_decimal d = p_get_decimal(v);
  out[0] = d.width;
  out[1] = d.scale;
  ((uint64_t *)out)[1] = d.value.lower;
  ((int64_t *)out)[2] = d.value.upper;
}
// out: [months(i32)@0, days(i32)@4, micros(i64)@8] (16-byte buffer)
void shim_get_interval(duckdb_value v, int32_t *out) {
  duckdb_interval iv = p_get_interval(v);
  out[0] = iv.months;
  out[1] = iv.days;
  *(int64_t *)(out + 2) = iv.micros;
}

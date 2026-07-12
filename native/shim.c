// Pointer-based wrappers around the duckdb C-API functions that take/return
// `duckdb_result` BY VALUE — bun:ffi's dlopen cannot pass structs by value, but
// this shim (compiled via bun:ffi `cc`) resolves the real symbols with dlsym and
// calls them through function pointers, so no link-time libduckdb is needed.
#include "duckdb.h"
#include <dlfcn.h>

static duckdb_data_chunk (*p_fetch_chunk)(duckdb_result);
static duckdb_state (*p_query)(duckdb_connection, const char *, duckdb_result *);

// Call once with the path to libduckdb. Returns 0 on success.
int shim_init(const char *libpath) {
  void *h = dlopen(libpath, RTLD_NOW | RTLD_GLOBAL);
  if (!h) return 1;
  p_fetch_chunk = (duckdb_data_chunk (*)(duckdb_result))dlsym(h, "duckdb_fetch_chunk");
  p_query = (duckdb_state (*)(duckdb_connection, const char *, duckdb_result *))dlsym(h, "duckdb_query");
  return (p_fetch_chunk && p_query) ? 0 : 2;
}

// Fetch the next chunk from a streaming result (result passed by pointer).
duckdb_data_chunk shim_fetch_chunk(duckdb_result *result) {
  return p_fetch_chunk(*result);
}

// Run a query, writing the result into a caller-allocated 48-byte buffer.
int shim_query(duckdb_connection conn, const char *sql, duckdb_result *out) {
  return (int)p_query(conn, sql, out);
}

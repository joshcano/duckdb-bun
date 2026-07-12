# CLAUDE.md — duckdb-bun

Bun-native DuckDB binding via **`bun:ffi`** over the **libduckdb C API**. The whole point:
embed `libduckdb` as a Bun asset so **`bun build --compile` yields a self-contained binary**,
which `@duckdb/node-api` (an N-API `.node` addon) cannot do.

## Stack / conventions

- **Runtime:** Bun 1.3.x. ESM. Double-quoted strings, 2-space indent, explicit `.ts` extensions
  on relative imports. `bun:test` flat tests. Lint/format with **Biome** (`bun run check`).
- **DuckDB pinned to v1.5.2** (matches oscar-backend's `@duckdb/node-api@1.5.2-r.1`). Single pin
  point: `DUCKDB_VERSION` in `scripts/fetch-lib.ts`.

## Layout

- `src/ffi.ts` — dlopen symbol table for the pointer-based C API.
- `src/library.ts` — resolves + `dlopen`s the embedded libduckdb (`with { type: "file" }`).
- `src/decode.ts` — data-chunk vector → JS value decoding.
- `src/index.ts` — public API: `DuckDBInstance` / `DuckDBConnection` / `Reader` (drop-in for the
  slice of `@duckdb/node-api` that `oscar-backend/src/mcp/workspace.ts` uses).
- `native/shim.c` — tiny C wrappers compiled via `bun:ffi`'s `cc` to call the by-value
  `duckdb_fetch_chunk` (which raw dlopen FFI can't pass).
- `vendor/` — fetched libduckdb (`.so`/`.dylib`/`.dll`, gitignored) + `duckdb.h` (committed).
- `scripts/fetch-lib.ts` — downloads prebuilt libduckdb per platform.

## Key gotchas

- **Struct-by-value:** `duckdb_fetch_chunk` / `duckdb_result_get_chunk` take `duckdb_result`
  **by value** — bun:ffi dlopen can't pass that. Use the `cc` shim (or the pointer-based
  deprecated `duckdb_value_*` accessors as a fallback). `column_count`/`name`/`type` take
  `duckdb_result *` (pointer) and are fine.
- **`duckdb_result` is a 48-byte struct** (6 pointer-sized fields) — allocate `new Uint8Array(48)`
  and pass its pointer as the out-param to `duckdb_query`.
- **Value mapping:** `TIMESTAMP*`→`Date`, `DECIMAL`→`number`, `BIGINT`/`HUGEINT`→`bigint`,
  `DATE`→`YYYY-MM-DD` string (deliberate, preserves workspace.ts date-only output), `null` via
  the validity mask.
- **FFI is synchronous;** the public API is Promise-wrapped to match `@duckdb/node-api`.

## Verify

`bun run spike` (FFI smoke), `bun test`, and the compile proof:
`bun build examples/compile-entry.ts --compile --outfile ./dd && ./dd` from a dir with no
vendored lib reachable — proves the `.so` is embedded.

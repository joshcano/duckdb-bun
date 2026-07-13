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

## The package IS a drop-in for `@duckdb/node-api` (`src/neo.ts` = main export)

As of **1.5.2-r.1**, the package's main export is a **faithful 1:1 reimplementation of
`@duckdb/node-api`** — the whole official TypeScript layer, running over `bun:ffi`, returning the
same wrapper value objects — so it can replace the official package *and* embed into a
`bun build --compile` binary. Swap the import, keep your code:

```ts
import { DuckDBInstance } from "@joshcano/duckdb-bun"; // was "@duckdb/node-api"
```

The old narrow, native-JS bespoke binding is still at `@joshcano/duckdb-bun/native-js` (`src/index.ts`).

- **Architecture:** `@duckdb/node-api` is pure TS over ONE interface — `@duckdb/node-bindings` (273
  functions). We reimplement only that interface in `src/bindings/`; the official TS layer is vendored
  MIT source in `vendor/node-api/src` (from duckdb-node-neo `635277e` / v1.5.2-r.1), used as-is except
  its `@duckdb/node-bindings` import, which `scripts/vendor-rewrite-bindings.ts` rewrites on disk to
  our `src/bindings/`. That on-disk rewrite is why the published package is a plugin-free drop-in.
  See `vendor/node-api/PROVENANCE.md`.
- **`src/bindings/`:** `ffi.ts` (dlopen table), `impl/*` (per-subsystem implementations), `handles.ts`
  (opaque-pointer/out-param/liveness helpers), `marshal.ts` (i128 split/join), `enums.ts`/`types.ts`/
  `functions.ts` (the contract barrel — regenerate with `bun run gen:bindings`). Struct-by-value C
  functions and JSCallback scalar-UDF bridging live in the grown `native/shim.c`.
- **Parity bar:** the vendored official Vitest suite (`bun run test:official`) — **92/92 passing**
  (1 skip), deterministic. Runs under `bun:test`; `tests/preload.ts` only rewrites the vendored test
  files' `vitest` import to `tests/vitest-shim.ts`.
- **Compile proof:** `bun run build:neo` → `./dd-neo` runs self-contained with no vendored lib
  reachable. Plain `bun build --compile` (no plugin), since the vendored layer already resolves our
  bindings on disk.
- **Scalar UDFs run single-threaded:** `register_scalar_function` pins the connection to `threads=1`.
  Our UDF callback is a synchronous `bun:ffi` JSCallback that must run on the caller's stack; DuckDB
  otherwise dispatches operators to smaller-stacked worker threads and overflows the callback. This is
  the one intentional behavioral difference from the N-API binding (which marshals to a worker).
- **Downstream:** because this returns wrapper value objects (true 1:1), a consumer like
  `oscar-backend/src/mcp/workspace.ts` keeps its `sanitizeValue()` switch (opposite of the bespoke
  API's "delete sanitizeValue" note).

# Vendored `@duckdb/node-api` (source + tests)

This tree is copied **verbatim** from the official DuckDB Node "Neo" monorepo so we
can reimplement it over `bun:ffi` and prove parity against its own test suite.

| | |
|---|---|
| Upstream repo | https://github.com/duckdb/duckdb-node-neo |
| Commit | `635277e701de7b322cf012dc88079f6049c7794d` ("upgrade to duckdb 1.5.2") |
| `@duckdb/node-api` version | `1.5.2-r.1` |
| `@duckdb/node-bindings` version | `1.5.2-r.1` (DuckDB core v1.5.2) |
| License | MIT — see `./LICENSE` |

## Layout

- `src/` — copied from `api/src/`. The full TypeScript API layer. **Unmodified on disk.**
- `test/` — copied from `api/test/`. The official Vitest suite (`api.test.ts` + `util/`,
  plus `bench/` which we don't run). **Unmodified on disk.**
- `node-bindings.d.ts` — copied from `bindings/pkgs/@duckdb/node-bindings/duckdb.d.ts`.
  The exact interface contract our `src/bindings/` reimplements (273 functions + enums +
  opaque handle types). Source of truth for `scripts/gen-bindings-scaffold.ts`.

## How it's wired

- **`src/` `@duckdb/node-bindings` imports** are rewritten **on disk** to a relative import
  of our `src/bindings/` by `scripts/vendor-rewrite-bindings.ts` (the ONLY modification vs.
  upstream — every other line is byte-identical). This is what makes the published package a
  plugin-free drop-in: consumers `import { DuckDBInstance } from '@joshcano/duckdb-bun'` and the
  vendored layer loads our bun:ffi bindings directly, with nothing else in the resolution path.
- **`test/` `vitest` imports** can't be rewritten on disk the same way (they'd need `vitest`
  installed for editor/typecheck), and `bun test` hard-remaps `vitest`→`bun:test` (which lacks an
  `assert` export) before tsconfig `paths`/plugin `onResolve` run. So `tests/preload.ts` uses an
  **`onLoad`** plugin scoped to `test/` that rewrites `vitest` → `../../tests/vitest-shim.ts` at
  load time.

## Updating (on a DuckDB version bump)

1. Check out the upstream commit whose `api/pkgs/@duckdb/node-api/package.json` matches
   the new `DUCKDB_VERSION` pin (`src/version.ts`).
2. Re-copy `api/src` → `src/`, `api/test` → `test/`, `LICENSE`, and the bindings
   `duckdb.d.ts` → `node-bindings.d.ts`.
3. Run `bun run scripts/vendor-rewrite-bindings.ts` (rewrites the `@duckdb/node-bindings` imports
   to our bindings — idempotent).
4. Run `bun run gen:bindings` to refresh the contract scaffold, then implement any newly added
   binding functions. Verify with `bun run test:official`.

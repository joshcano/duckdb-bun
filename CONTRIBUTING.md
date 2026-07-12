# Contributing to duckdb-bun

Thanks for helping out! This is a small, focused package — a Bun-native DuckDB binding whose
distinguishing feature is that it **embeds `libduckdb` so `bun build --compile` yields a
self-contained binary**.

## Dev setup

```sh
bun install
bun run fetch-lib      # downloads libduckdb (not committed) for your platform
bun test               # unit + parity + compile proof
bun run check          # Biome lint + format
```

## Before opening a PR

- `bun run ci` is green (Biome + full test suite, including the `bun build --compile` proof).
- `bun run parity` is green — new behavior is covered by a query in `tests/parity.test.ts`, which
  diffs us against the official `@duckdb/node-api`.
- New value types get a round-trip test in `tests/scalar-types.test.ts` and a parity query.

## Architecture (where things live)

- `src/ffi.ts` — the `dlopen` symbol table (pointer-based C API) + the `cc`-compiled shim.
- `native/shim.c` — wraps the by-value `duckdb_query` / `duckdb_fetch_chunk` that raw FFI can't pass.
- `src/decode.ts` — data-chunk vector → JS value decoding.
- `src/library.ts` — embeds + materializes the native assets for `--compile`.
- `MAINTENANCE.md` — upgrading DuckDB, platform support, and the release checklist.

## Gotcha

Every `FFIType.cstring` argument must be a null-terminated `Buffer` (use `cstr()` in `src/ffi.ts`) —
passing a bare JS string throws on dlopen symbols and **segfaults** on cc symbols.

## Reporting bugs

Include: your OS/arch, `bun --version`, the DuckDB version (`bun run check-version`), and a minimal
SQL repro. A failing parity query is the ideal bug report.

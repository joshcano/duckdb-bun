# Maintaining duckdb-bun

This binding tracks DuckDB's stable **C API**, which is versioned and rarely breaks.
Day-to-day maintenance is mostly: watch for new DuckDB releases, bump the pin, and let the
parity + test suite confirm nothing drifted.

## Versioning

The package version **mirrors the DuckDB version it wraps**, using the same scheme as
`@duckdb/node-api`: **`<duckdb-version>-r.<n>`**. So `1.5.2-r.0` wraps DuckDB `1.5.2`; a fix that
doesn't change DuckDB bumps to `1.5.2-r.1`, and the next DuckDB (say 1.5.4) resets to `1.5.4-r.0`.

`tests/package-version.test.ts` enforces that `package.json` version's base equals
`DUCKDB_VERSION` in `src/version.ts`, and `bun run check-version` flags a mismatch — so the two
can't silently drift.

## The one command to know if you're behind

```sh
bun run check-version
```

Reports our pinned version (`src/version.ts`), the `@duckdb/node-api` reference version, whether
the native lib is vendored, and the latest DuckDB release. Exit code:
- **0** — consistent (a newer upstream release is shown as *informational* only).
- **1** — action needed: the vendored lib is missing, or `@duckdb/node-api` no longer matches our
  pin (which would make the parity comparison lie).

## Comparing against the "live" version

`tests/parity.test.ts` is a **differential test**: it runs a matrix of queries through **both** the
official `@duckdb/node-api` (the reference) and `duckdb-bun`, canonicalizes both sides to a common
shape, and asserts they agree. Run it any time:

```sh
bun run parity
```

If parity passes, our decoding matches the official binding for every covered type. When you add a
feature or bump DuckDB, **add a query to the `QUERIES` array** so it's covered. `@duckdb/node-api`
is a devDependency pinned to the same DuckDB version as our `src/version.ts` — keep them equal.

## Upgrading DuckDB (e.g. 1.5.2 → 1.5.4)

1. **Bump the pin** in `src/version.ts` (`DUCKDB_VERSION`) **and** set `package.json` version to
   `<new-duckdb>-r.0` (the version test enforces they match).
2. **Bump the reference**: `bun add -d @duckdb/node-api@<new>-r.<n>` so parity compares against the
   matching DuckDB. (`bun run check-version` will flag a mismatch.)
3. **Re-fetch the native lib**: `bun run fetch-lib` (downloads the new `libduckdb.so` + `duckdb.h`).
4. **Diff the C header for API drift** — this is where breaking changes would show up:
   ```sh
   git diff --stat vendor/duckdb.h
   # inspect any change to a symbol we bind (see the dlopen table in src/ffi.ts) or the
   # DUCKDB_TYPE enum (mirrored in src/types.ts) or the duckdb_result struct size (48 bytes).
   ```
   If a bound signature or an enum value changed, update `src/ffi.ts` / `src/types.ts` to match.
5. **Verify**: `bun run ci` (Biome + full suite, incl. parity + the compile proof) and
   `bun run check-version` (should print ✅).
6. Commit the bumped `src/version.ts`, `package.json`/`bun.lock`, and `vendor/duckdb.h`.

The `tests/version.test.ts` check (`libraryVersion() === DUCKDB_VERSION_TAG`) fails loudly if the
vendored `.so` doesn't match the pin — so a forgotten step 3 can't slip through.

## What can break, and where to look

| Symptom | Likely cause | Fix location |
|---|---|---|
| `version.test.ts` fails | vendored `.so` ≠ pin | re-run `bun run fetch-lib` |
| A parity query diverges | decoding changed / new type shape | `src/decode.ts` (+ `canonical()` in the parity test if the reference wrapper changed) |
| dlopen throws "undefined symbol" | a bound C function was renamed/removed | `src/ffi.ts` symbol table vs `vendor/duckdb.h` |
| Segfault on a `cstring` arg | a JS string passed where a `Buffer` is required | wrap with `cstr()` from `src/ffi.ts` |
| `bun build --compile` binary can't load the lib | embedding/materialization path | `src/library.ts` (the `/$bunfs/` copy-out) |
| Wrong number for a big value | HUGEINT / DECIMAL / string_t offset | `src/decode.ts` |

## Adding a platform (e.g. linux-arm64, macOS, musl)

1. `bun run fetch-lib <target>` (targets: `linux-x64`, `linux-x64-musl`, `linux-arm64`,
   `darwin-x64`, `darwin-arm64`, `win32-x64`) — populates `vendor/<dir>/`.
2. Add a `with { type: "file" }` import + a `selectLib()` case for it in `src/library.ts`.
3. For `bun build --compile`, build with the matching `--target` and vendor the matching libc
   (glibc vs musl). v1 embeds the host platform only; cross-compiling needs the target's lib present.

## Architecture recap for maintainers

- **Pointer-based C API** → bound directly via `bun:ffi` `dlopen` (`src/ffi.ts`).
- **By-value functions** (`duckdb_query`, `duckdb_fetch_chunk` take `duckdb_result` by value, which
  `bun:ffi` dlopen can't pass) → wrapped in `native/shim.c`, compiled at runtime with `bun:ffi`'s
  `cc` (bundled TinyCC). The shim `dlsym`s the real symbols and calls through function pointers, so
  it needs no link-time libduckdb.
- **Standalone binaries**: `src/library.ts` embeds `libduckdb.so` + `shim.c` + `duckdb.h` as Bun
  file assets and, inside a compiled binary, copies them out of the `/$bunfs/` VFS to a temp dir
  (TinyCC and the C `dlopen` can't read the VFS).
- **`duckdb_result`** is a fixed 48-byte struct — allocated as `new Uint8Array(48)` and passed by
  pointer to `shim_query`.

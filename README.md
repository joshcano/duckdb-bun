# duckdb-bun

[![CI](https://github.com/joshcano/duckdb-bun/actions/workflows/ci.yml/badge.svg)](https://github.com/joshcano/duckdb-bun/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![DuckDB v1.5.2](https://img.shields.io/badge/DuckDB-v1.5.2-yellow)
![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.3-black)

A **Bun-native DuckDB binding** built on [`bun:ffi`](https://bun.sh/docs/api/ffi) over the
libduckdb **C API** — no N-API `.node` addon. It embeds `libduckdb` as a Bun asset so that
**`bun build --compile` produces a single self-contained executable** (the thing the official
`@duckdb/node-api` addon cannot do).

Pinned to **DuckDB v1.5.2** (matches `@duckdb/node-api@1.5.2-r.1`).

## Why

`@duckdb/node-api` ships a prebuilt N-API addon (`duckdb.node`) with `libduckdb` linked in.
`bun build --compile` can't embed a dynamically-loaded `.node` addon, so any Bun service that
uses it can't be shipped as a standalone binary. `duckdb-bun` `dlopen`s a plain `libduckdb.so`
that Bun *can* embed via `import p from "./libduckdb.so" with { type: "file" }`.

## Setup

The native library is not committed. Fetch it for your platform:

```sh
bun run fetch-lib          # downloads libduckdb v1.5.2 for the host platform into vendor/
```

> **glibc vs musl:** prod (oscar-backend) runs a glibc container → the `linux-amd64` asset.
> On Alpine, fetch the `linux-amd64-musl` variant. The vendored lib must match the libc of
> whatever `bun build --target` you compile for.

## Usage

```ts
import { DuckDBInstance } from "duckdb-bun";

const db = await DuckDBInstance.create(":memory:");
const conn = await db.connect();
await conn.run("CREATE TABLE t AS SELECT * FROM range(3) AS r(n)");
const reader = await conn.runAndReadAll("SELECT n, n * 2 AS double FROM t");
console.log(reader.columnNames());   // ["n", "double"]
console.log(reader.getRowObjects()); // [{ n: 0n, double: 0n }, ...]
conn.closeSync();
db.closeSync();
```

## Compile to a standalone binary

```sh
bun build examples/compile-entry.ts --compile --outfile ./dd
./dd            # runs a real DuckDB query with libduckdb embedded — no bun/node/libduckdb needed
```

## Develop

```sh
bun run spike          # FFI smoke test against vendored libduckdb
bun test               # full suite
bun run parity         # differential test vs the official @duckdb/node-api
bun run check-version  # is our DuckDB pin behind / consistent?
bun run check          # biome lint + format
```

**Maintaining the project** (upgrading DuckDB, comparing against the live binding, platform
support) is documented in [`MAINTENANCE.md`](MAINTENANCE.md). The short version: `bun run parity`
proves we still match `@duckdb/node-api`, and `bun run check-version` tells you when to upgrade.

## Migrating from `@duckdb/node-api`

`duckdb-bun` is a drop-in for the slice of `@duckdb/node-api` that oscar-backend's
`src/mcp/workspace.ts` uses. See [`examples/workspace.ts`](examples/workspace.ts) for a full
faithful port. The migration is two changes:

1. Swap the import:
   ```diff
   - import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
   + import { DuckDBInstance, DuckDBConnection } from "duckdb-bun";
   ```
2. Simplify `sanitizeValue()` — this binding returns **native JS values**, so the
   `switch (ctor)` over `DuckDBDateValue` / `DuckDBTimestampValue` / `DuckDBDecimalValue`
   goes away. Mapping: `TIMESTAMP*`→`Date`, `DECIMAL`→`number`, `BIGINT`/`HUGEINT`→`bigint`,
   `DATE`→`YYYY-MM-DD` string (preserves the old date-only output), `null` via the validity mask.

Everything else (`create` / `connect` / `run` / `runAndReadAll` / `getRowObjects` /
`columnNames` / `closeSync`, and all the SQL) is unchanged.

> **Runtime note:** this package uses `bun:ffi`, so it only runs under **Bun**. The current
> Node.js `oscar-backend` must stay on `@duckdb/node-api`; the target is Bun services that need
> `bun build --compile` (which the N-API addon blocks).

## Value type mapping

| DuckDB type | JS value |
|---|---|
| BOOLEAN | `boolean` |
| TINYINT…INTEGER, U* (≤32-bit) | `number` |
| BIGINT, UBIGINT, HUGEINT, UHUGEINT | `bigint` |
| FLOAT, DOUBLE, DECIMAL | `number` |
| VARCHAR | `string` |
| DATE | `string` (`YYYY-MM-DD`) |
| TIMESTAMP / _S / _MS / _NS / _TZ | `Date` |
| TIME / TIME_TZ | `string` |
| BLOB | `Uint8Array` |
| UUID | `string` |
| NULL | `null` |

## How it works

- `src/library.ts` embeds `libduckdb.so`, `native/shim.c`, and `vendor/duckdb.h` as Bun file
  assets. Under `bun build --compile` they ride inside the executable; at startup they're
  materialized to a temp dir (TinyCC and the C-level `dlopen` can't read Bun's `/$bunfs/` VFS).
- `native/shim.c` is compiled at runtime via `bun:ffi`'s `cc` (bundled TinyCC). It wraps
  `duckdb_query` / `duckdb_fetch_chunk`, which take `duckdb_result` **by value** — something raw
  `bun:ffi` dlopen can't pass. The shim `dlsym`s them and calls through function pointers.
- Everything else is pointer-based and bound directly with `dlopen`.

> **Gotcha:** every `FFIType.cstring` argument (for both dlopen and cc symbols) must be a
> null-terminated `Buffer` — passing a bare JS string throws (dlopen) or segfaults (cc). Use the
> `cstr()` helper in `src/ffi.ts`.

## Alternatives / prior art

Pick the right tool — if you don't need `bun build --compile`, an existing driver may fit better:

| Package | Bun-native FFI | Embeds libduckdb (compile-ready) | Notes |
|---|---|---|---|
| **duckdb-bun** (this) | ✅ | ✅ **the point** | Runtime `cc` shim; embeds & materializes the `.so` so a compiled binary is self-contained. |
| [`shreeve/duckdb-bun`](https://github.com/shreeve/duckdb-bun) (npm `duckdb-bun`) | ✅ | ❌ needs system libduckdb (`brew`/`apt`/`DUCKDB_LIB_PATH`) | Mature, richer driver API (`all`/`get`/`run`/`iterate`/`transaction`). Great if you don't need `--compile`. |
| [`@duckdb/node-api`](https://www.npmjs.com/package/@duckdb/node-api) (official) | ❌ N-API addon | ❌ can't be `bun build --compile`d | The reference implementation; we test parity against it. |
| [`@evan/duckdb`](https://github.com/evanwashere/duckdb) | ✅ | ❌ | Unmaintained (2023, DuckDB ~0.7). |

**When to use this package:** you want a single self-contained executable from `bun build --compile`
with DuckDB inside it. No other binding does that today — it's [an open Bun
issue](https://github.com/oven-sh/bun/issues/17312). For everything else, `shreeve/duckdb-bun` is a
fine, more full-featured choice.

## Status

Core binding complete: all scalar types, NULLs, multi-chunk streaming, prepared statements,
error propagation, a `bun test` suite, a differential parity test vs the official `@duckdb/node-api`,
Biome lint, and a verified `bun build --compile` proof. See `MAINTENANCE.md`.

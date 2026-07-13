// Public entry for the drop-in `@duckdb/node-api` replacement. Re-exports the full
// vendored official TypeScript API (running over our bun:ffi bindings), so:
//
//   import { DuckDBInstance } from "@joshcano/duckdb-bun";
//
// behaves like `@duckdb/node-api` — same classes, same wrapper value objects — but
// embeds libduckdb, so `bun build --compile` yields a self-contained binary.
//
// The narrow, native-JS bespoke binding is still available at
// `@joshcano/duckdb-bun/native-js`.
export * from "../vendor/node-api/src/index.ts";
export { default } from "../vendor/node-api/src/index.ts";

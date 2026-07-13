// Our bun:ffi reimplementation of the `@duckdb/node-bindings` module contract.
// The entire vendored `@duckdb/node-api` TypeScript layer imports this module as
// `import duckdb from '@duckdb/node-bindings'` (default), `import * as duckdb`
// (namespace), and `import { fn } from '@duckdb/node-bindings'` (named) — so we
// expose all three: named re-exports for the values/types + a real default
// object built from them (ESM has no synthetic default at runtime).
//
// Phase 0 ships stubs (throw NotImplemented); each phase swaps in real FFI.
export * from "./enums.ts";
export * from "./functions.ts";
export type * from "./types.ts";

import * as enums from "./enums.ts";
import * as functions from "./functions.ts";

const duckdb = { ...enums, ...functions };
export default duckdb;

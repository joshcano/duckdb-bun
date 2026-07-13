// Runs the vendored official @duckdb/node-api test suite (api.test.ts, pinned to
// duckdb-node-neo @ 635277e / 1.5.2-r.1) under bun:test. Importing it executes the
// suite's describe/test registrations through our vitest shim; its `vitest` and
// `@duckdb/node-bindings` imports are redirected by tests/preload.ts. This is the
// parity bar — it goes green phase by phase as the stub bindings become real.
import "../../vendor/node-api/test/api.test.ts";

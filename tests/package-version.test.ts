// The package version tracks the DuckDB it wraps: "<duckdb>-r.<n>" (same scheme
// as @duckdb/node-api). This fails if package.json and src/version.ts ever drift.
import { expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { libraryVersion } from "../src/index.ts";
import { DUCKDB_VERSION, DUCKDB_VERSION_TAG } from "../src/version.ts";

test("package version base equals the pinned DuckDB version", () => {
  // e.g. "1.5.2-r.0" wraps DuckDB "1.5.2"
  expect(pkg.version).toMatch(new RegExp(`^${DUCKDB_VERSION.replace(/\./g, "\\.")}(-r\\.\\d+)?$`));
});

test("the loaded libduckdb reports that same version", () => {
  expect(libraryVersion()).toBe(DUCKDB_VERSION_TAG);
});

import duckdb from "../../../src/bindings/index.ts";

export function version(): string {
  return duckdb.library_version();
}

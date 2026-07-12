// Single source of truth for the DuckDB version this binding targets. Bump this
// when upgrading, then re-run `bun run fetch-lib`. See MAINTENANCE.md.
export const DUCKDB_VERSION = "1.5.2";

/** The version tag as it appears on GitHub releases and from duckdb_library_version(). */
export const DUCKDB_VERSION_TAG = `v${DUCKDB_VERSION}`;

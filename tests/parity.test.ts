// Differential test: run the same queries through the official @duckdb/node-api
// ("live" reference) and through duckdb-bun ("ours"), canonicalize both sides to a
// common shape, and assert they agree. This is how we verify parity with the live
// version and catch regressions when bumping DuckDB. Skips if the live napi binary
// can't load (e.g. an environment without the prebuilt @duckdb/node-bindings).
import { beforeAll, describe, expect, test } from "bun:test";
import { DuckDBInstance as OursInstance } from "../src/index.ts";
import { DUCKDB_VERSION_TAG } from "../src/version.ts";

// Canonicalize a decoded value from EITHER binding into a comparable primitive.
// Ours already returns natives (Date/number/bigint/string); the live binding
// returns wrapper objects (DuckDBDateValue {days}, DuckDBTimestampValue {micros},
// DuckDBDecimalValue {value,scale}) — duck-type them to the same canonical form.
function canonical(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") return Object.is(v, -0) ? 0 : v;
  if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1 && typeof o.days === "number") {
      return new Date((o.days as number) * 86_400_000).toISOString().slice(0, 10);
    }
    if (typeof o.micros === "bigint") return new Date(Number(o.micros) / 1000).toISOString();
    if (typeof o.millis === "bigint") return new Date(Number(o.millis)).toISOString();
    if (typeof o.seconds === "bigint") return new Date(Number(o.seconds) * 1000).toISOString();
    if (typeof o.value === "bigint" && typeof o.scale === "number") {
      return Number(o.value) / 10 ** (o.scale as number);
    }
    // DuckDBUUIDValue {hugeint} — its toString() is the canonical UUID (ours returns that string).
    if (keys.length === 1 && typeof o.hugeint === "bigint") return String(v);
    if (Array.isArray(v)) return v.map(canonical);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) out[k] = canonical(val);
    return out;
  }
  return v;
}

function canonicalRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(r)) out[k] = canonical(val);
    return out;
  });
}

// Queries covering the surface that matters. Each must be deterministic.
const QUERIES = [
  "SELECT 42::BIGINT AS a, -7::INTEGER AS b, true AS c, 3.14::DOUBLE AS d",
  "SELECT '170141183460469231731687303715884105727'::HUGEINT AS hi, -5::HUGEINT AS neg",
  "SELECT 123.45::DECIMAL(10,2) AS a, -9.9::DECIMAL(4,1) AS b",
  "SELECT 'hello' AS short, 'this string is definitely longer than twelve' AS long, '' AS empty",
  "SELECT DATE '2026-07-12' AS d, TIMESTAMP '2026-07-12 13:45:06' AS ts, TIMESTAMP_MS '2026-07-12 13:45:06.250' AS ms",
  "SELECT NULL AS n, 'x' AS s, CAST(NULL AS INTEGER) AS i",
  "SELECT n::BIGINT AS n FROM range(5000) t(n)",
  "SELECT store, SUM(amount) AS total FROM (VALUES ('A', 100), ('B', 250), ('A', 50)) t(store, amount) GROUP BY store ORDER BY store",
  "SELECT '12345678-1234-5678-1234-567812345678'::UUID AS id",
] as const;

let live: typeof import("@duckdb/node-api") | null = null;
beforeAll(async () => {
  try {
    live = await import("@duckdb/node-api");
  } catch {
    live = null;
  }
});

describe("parity with @duckdb/node-api", () => {
  // Guard: the differential comparison is only meaningful if BOTH bindings load
  // the same DuckDB version, and that version matches our pin. Fails loudly if
  // someone bumps src/version.ts or the @duckdb/node-api devDep without the other.
  test("both bindings load the same DuckDB version as the pin", async () => {
    if (!live) return;
    const oursDb = await OursInstance.create(":memory:");
    const oursConn = await oursDb.connect();
    const ourV = (await oursConn.runAndReadAll("SELECT version() AS v")).getRowObjects()[0].v;
    oursConn.closeSync();
    oursDb.closeSync();

    const liveDb = await live.DuckDBInstance.create(":memory:");
    const liveConn = await liveDb.connect();
    const liveV = (await liveConn.runAndReadAll("SELECT version() AS v")).getRowObjects()[0].v;

    expect(ourV).toBe(liveV);
    expect(ourV).toBe(DUCKDB_VERSION_TAG);
  });

  for (const sql of QUERIES) {
    test(sql.slice(0, 60), async () => {
      if (!live) {
        // No live reference available in this environment — nothing to compare.
        return;
      }
      const oursDb = await OursInstance.create(":memory:");
      const oursConn = await oursDb.connect();
      const ours = await oursConn.runAndReadAll(sql);
      const oursRows = canonicalRows(ours.getRowObjects());
      const oursCols = ours.columnNames();
      oursConn.closeSync();
      oursDb.closeSync();

      const liveDb = await live.DuckDBInstance.create(":memory:");
      const liveConn = await liveDb.connect();
      const liveReader = await liveConn.runAndReadAll(sql);
      const liveRows = canonicalRows(liveReader.getRowObjects() as Record<string, unknown>[]);
      const liveCols = liveReader.columnNames();

      expect(oursCols).toEqual(liveCols);
      expect(oursRows).toEqual(liveRows);
    });
  }
});

// Mirrors the exact DuckDB usage in oscar-backend/src/mcp/workspace.ts so the
// import swap there is safe: SET pragmas, read_json_auto ingest, INSERT BY NAME,
// ALTER ADD COLUMN, information_schema, PRAGMA table_info, COUNT(*), read-only query.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
const ndjson = join(tmpdir(), `ddbun-ws-${process.pid}.ndjson`);

beforeAll(async () => {
  ctx = await open();
  // The pragmas workspace.ts issues on every new workspace.
  await ctx.conn.run("SET memory_limit = '256MB'");
  await ctx.conn.run("SET max_temp_directory_size = '1GB'");
  await ctx.conn.run("SET threads = 2");
  const rows = [
    { store: "A", sales: 100, day: "2026-07-01" },
    { store: "B", sales: 250, day: "2026-07-01" },
  ];
  await Bun.write(ndjson, rows.map((r) => JSON.stringify(r)).join("\n"));
});
afterAll(() => {
  ctx.dispose();
  rmSync(ndjson, { force: true });
});

test("full workspace ingest + query flow", async () => {
  const path = ndjson.replace(/'/g, "''");
  await ctx.conn.run(`CREATE TABLE "sales" AS SELECT * FROM read_json_auto('${path}')`);
  await ctx.conn.run(`INSERT INTO "sales" BY NAME SELECT * FROM read_json_auto('${path}')`);
  await ctx.conn.run(`ALTER TABLE "sales" ADD COLUMN region VARCHAR`);

  const info = await ctx.conn.runAndReadAll('PRAGMA table_info("sales")');
  expect(info.getRowObjects().map((o) => o.name)).toEqual(["store", "sales", "day", "region"]);

  const tables = await ctx.conn.runAndReadAll(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name",
  );
  expect(tables.getRowObjects().map((o) => o.table_name)).toEqual(["sales"]);

  const count = await ctx.conn.runAndReadAll('SELECT COUNT(*) AS n FROM "sales"');
  expect(Number(count.getRowObjects()[0].n)).toBe(4);

  // read-only aggregate query, as query_workspace runs
  const agg = await ctx.conn.runAndReadAll(
    'WITH _q AS (SELECT store, SUM(sales) AS total FROM "sales" GROUP BY store) SELECT * FROM _q ORDER BY store LIMIT 1001',
  );
  expect(agg.getRowObjects()).toEqual([
    { store: "A", total: 200n },
    { store: "B", total: 500n },
  ]);
});

import { afterAll, beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
const ndjson = join(tmpdir(), `ddbun-ingest-${process.pid}.ndjson`);

beforeAll(async () => {
  ctx = await open();
  const rows = [
    { id: 1, name: "alpha", amount: 10.5 },
    { id: 2, name: "beta", amount: 20 },
  ];
  await Bun.write(ndjson, rows.map((r) => JSON.stringify(r)).join("\n"));
});
afterAll(() => {
  ctx.dispose();
  rmSync(ndjson, { force: true });
});

test("CREATE TABLE AS read_json_auto + INSERT BY NAME (workspace.ts pattern)", async () => {
  const path = ndjson.replace(/'/g, "''");
  await ctx.conn.run(`CREATE TABLE t AS SELECT * FROM read_json_auto('${path}')`);
  await ctx.conn.run(`INSERT INTO t BY NAME SELECT * FROM read_json_auto('${path}')`);
  const count = await ctx.conn.runAndReadAll("SELECT COUNT(*) AS n FROM t");
  expect(Number(count.getRowObjects()[0].n)).toBe(4);
  const names = await ctx.conn.runAndReadAll("SELECT name FROM t ORDER BY id LIMIT 1");
  expect(names.getRowObjects()[0]).toEqual({ name: "alpha" });
});

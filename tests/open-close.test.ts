import { afterAll, beforeAll, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "../src/index.ts";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

test("in-memory: connect and run a trivial query", async () => {
  const r = await ctx.conn.runAndReadAll("SELECT 1 AS a");
  expect(r.getRowObjects()).toEqual([{ a: 1 }]);
  expect(r.columnNames()).toEqual(["a"]);
});

test("file-backed database persists across connections", async () => {
  const path = join(tmpdir(), `ddbun-file-${process.pid}.db`);
  rmSync(path, { force: true });
  const db1 = await DuckDBInstance.create(path);
  const c1 = await db1.connect();
  await c1.run("CREATE TABLE t (x INTEGER)");
  await c1.run("INSERT INTO t VALUES (7)");
  c1.closeSync();
  db1.closeSync();

  const db2 = await DuckDBInstance.create(path);
  const c2 = await db2.connect();
  const r = await c2.runAndReadAll("SELECT x FROM t");
  expect(r.getRowObjects()).toEqual([{ x: 7 }]);
  c2.closeSync();
  db2.closeSync();
  rmSync(path, { force: true });
});

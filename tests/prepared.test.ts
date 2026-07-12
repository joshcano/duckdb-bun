import { afterAll, beforeAll, expect, test } from "bun:test";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

test("bind positional params and read result", async () => {
  const st = await ctx.conn.prepare("SELECT ?::BIGINT + ?::BIGINT AS s");
  expect(st.paramCount).toBe(2);
  const r = await st.bindAll([40, 2]).readAll();
  expect(r.getRowObjects()).toEqual([{ s: 42n }]);
  st.close();
});

test("varchar and null binds", async () => {
  const st = await ctx.conn.prepare("SELECT ? AS name, ? AS maybe");
  const r = await st.bind(1, "duck").bind(2, null).readAll();
  expect(r.getRowObjects()).toEqual([{ name: "duck", maybe: null }]);
  st.close();
});

test("a prepared statement can be re-executed with different binds", async () => {
  const st = await ctx.conn.prepare("SELECT ?::INTEGER AS x");
  expect((await st.bind(1, 5).readAll()).getRowObjects()).toEqual([{ x: 5 }]);
  expect((await st.bind(1, 99).readAll()).getRowObjects()).toEqual([{ x: 99 }]);
  st.close();
});

test("prepare error surfaces", async () => {
  await expect(ctx.conn.prepare("SELECT * FROM no_such_table_xyz")).rejects.toThrow();
});

import { afterAll, beforeAll, expect, test } from "bun:test";
import { open, row } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

test("plain NULL and NULL alongside a value", async () => {
  expect(await row(ctx.conn, "SELECT NULL AS n, 'x' AS s")).toEqual({ n: null, s: "x" });
});

test("validity mask is respected at first / middle / last rows", async () => {
  const r = await ctx.conn.runAndReadAll("SELECT * FROM (VALUES (NULL), (10), (NULL), (30), (NULL)) AS t(v) ");
  expect(r.getRowObjects().map((o) => o.v)).toEqual([null, 10, null, 30, null]);
});

test("all-null column", async () => {
  const r = await ctx.conn.runAndReadAll("SELECT CAST(NULL AS INTEGER) AS v FROM range(3)");
  expect(r.getRowObjects().map((o) => o.v)).toEqual([null, null, null]);
});

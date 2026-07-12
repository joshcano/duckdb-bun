import { afterAll, beforeAll, expect, test } from "bun:test";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
  await ctx.conn.run("CREATE TABLE t (id INTEGER, name VARCHAR)");
});
afterAll(() => ctx.dispose());

test("PRAGMA table_info returns column name + type", async () => {
  const r = await ctx.conn.runAndReadAll("PRAGMA table_info(t)");
  const cols = r.getRowObjects().map((o) => ({ name: o.name, type: o.type }));
  expect(cols).toEqual([
    { name: "id", type: "INTEGER" },
    { name: "name", type: "VARCHAR" },
  ]);
});

test("information_schema lists the table", async () => {
  const r = await ctx.conn.runAndReadAll("SELECT table_name FROM information_schema.tables WHERE table_schema='main'");
  expect(r.getRowObjects().map((o) => o.table_name)).toContain("t");
});

test("ALTER TABLE ADD COLUMN then re-introspect", async () => {
  await ctx.conn.run("ALTER TABLE t ADD COLUMN extra DOUBLE");
  const r = await ctx.conn.runAndReadAll("PRAGMA table_info(t)");
  expect(r.getRowObjects().map((o) => o.name)).toEqual(["id", "name", "extra"]);
});

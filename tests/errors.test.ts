import { afterAll, beforeAll, expect, test } from "bun:test";
import { DuckDBError } from "../src/index.ts";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

test("syntax error throws a DuckDBError (real Error subclass) with the parser message", async () => {
  try {
    await ctx.conn.runAndReadAll("SELCT 1");
    throw new Error("expected to throw");
  } catch (err) {
    expect(err).toBeInstanceOf(DuckDBError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Parser Error|syntax error/i);
  }
});

test("runtime error (missing table) surfaces its message", async () => {
  await expect(ctx.conn.runAndReadAll("SELECT * FROM does_not_exist")).rejects.toThrow(/does_not_exist|Catalog/i);
});

test("a failed query does not poison the connection", async () => {
  await expect(ctx.conn.run("bogus")).rejects.toThrow();
  const r = await ctx.conn.runAndReadAll("SELECT 1 AS ok");
  expect(r.getRowObjects()).toEqual([{ ok: 1 }]);
});

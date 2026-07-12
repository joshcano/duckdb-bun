import { afterAll, beforeAll, expect, test } from "bun:test";
import { open } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

// DuckDB's standard vector size is 2048, so 5000 rows spans multiple chunks.
test("reads every row across chunk boundaries (2048/4096)", async () => {
  const r = await ctx.conn.runAndReadAll("SELECT n::BIGINT AS n FROM range(5000) t(n)");
  const rows = r.getRowObjects();
  expect(rows.length).toBe(5000);
  expect(rows[0].n).toBe(0n);
  expect(rows[2047].n).toBe(2047n);
  expect(rows[2048].n).toBe(2048n);
  expect(rows[4999].n).toBe(4999n);
  const sum = rows.reduce((acc, o) => acc + (o.n as bigint), 0n);
  expect(sum).toBe((4999n * 5000n) / 2n);
});

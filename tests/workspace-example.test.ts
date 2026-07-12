// Exercises the ported examples/workspace.ts end to end: the same append/query/
// list/drop flow oscar-backend's MCP workspace tools drive.
import { expect, test } from "bun:test";
import { appendRows, clearAllTables, dropTable, listTables, runQuery, sanitizeValue } from "../examples/workspace.ts";

test("append rows, then query them back through the read-only path", async () => {
  const [u, c] = [101, 211];
  const first = await appendRows(u, c, "sales", [
    { store: "A", amount: 100, day: "2026-07-01" },
    { store: "B", amount: 250, day: "2026-07-01" },
  ]);
  expect(first.created).toBe(true);
  expect(first.total_rows).toBe(2);

  const second = await appendRows(u, c, "sales", [{ store: "A", amount: 50, day: "2026-07-02" }]);
  expect(second.created).toBe(false);
  expect(second.total_rows).toBe(3);

  const q = await runQuery(u, c, "SELECT store, SUM(amount) AS total FROM sales GROUP BY store ORDER BY store");
  expect(q.rows).toEqual([
    { store: "A", total: 150 },
    { store: "B", total: 250 },
  ]);
  expect(q.truncated).toBe(false);

  const tables = await listTables(u, c);
  expect(tables.map((t) => t.name)).toEqual(["sales"]);
  expect(tables[0].row_count).toBe(3);
});

test("ALTER ADD COLUMN happens automatically for new keys", async () => {
  const [u, c] = [102, 211];
  await appendRows(u, c, "t", [{ a: 1 }]);
  await appendRows(u, c, "t", [{ a: 2, b: "new" }]);
  const tables = await listTables(u, c);
  expect(tables[0].columns.map((x) => x.name).sort()).toEqual(["a", "b"]);
});

test("read-only guard rejects mutations", async () => {
  const [u, c] = [103, 211];
  await appendRows(u, c, "t", [{ a: 1 }]);
  await expect(runQuery(u, c, "DROP TABLE t")).rejects.toThrow(/SELECT/i);
  await expect(runQuery(u, c, "INSERT INTO t VALUES (2)")).rejects.toThrow(/SELECT/i);
});

test("drop and clear", async () => {
  const [u, c] = [104, 211];
  await appendRows(u, c, "a", [{ x: 1 }]);
  await appendRows(u, c, "b", [{ x: 1 }]);
  expect(await dropTable(u, c, "a")).toBe(true);
  expect(await dropTable(u, c, "missing")).toBe(false);
  expect(await clearAllTables(u, c)).toBe(1);
  expect((await listTables(u, c)).length).toBe(0);
});

test("sanitizeValue: bigint downcast, huge bigint to string, Date to ISO", () => {
  expect(sanitizeValue(42n)).toBe(42);
  expect(sanitizeValue(123456789012345678901234567890n)).toBe("123456789012345678901234567890");
  expect(sanitizeValue(new Date("2026-07-12T00:00:00.000Z"))).toBe("2026-07-12T00:00:00.000Z");
  expect(sanitizeValue("2026-07-12")).toBe("2026-07-12");
  expect(sanitizeValue(null)).toBe(null);
});

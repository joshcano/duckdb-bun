import { afterAll, beforeAll, expect, test } from "bun:test";
import { open, row } from "./helper.ts";

let ctx: Awaited<ReturnType<typeof open>>;
beforeAll(async () => {
  ctx = await open();
});
afterAll(() => ctx.dispose());

test("boolean", async () => {
  expect(await row(ctx.conn, "SELECT true AS t, false AS f")).toEqual({ t: true, f: false });
});

test("signed integers", async () => {
  const r = await row(ctx.conn, "SELECT 1::TINYINT a, 2::SMALLINT b, 3::INTEGER c, 4::BIGINT d");
  expect(r).toEqual({ a: 1, b: 2, c: 3, d: 4n });
});

test("unsigned integers", async () => {
  const r = await row(ctx.conn, "SELECT 1::UTINYINT a, 2::USMALLINT b, 3::UINTEGER c, 4::UBIGINT d");
  expect(r).toEqual({ a: 1, b: 2, c: 3, d: 4n });
});

test("hugeint round-trips at the extremes", async () => {
  const max = "170141183460469231731687303715884105727";
  const min = "-170141183460469231731687303715884105728";
  // Cast from string: the bare min literal is parsed as UINT128 before negation.
  const r = await row(ctx.conn, `SELECT '${max}'::HUGEINT AS hi, '${min}'::HUGEINT AS lo, -5::HUGEINT AS neg`);
  expect(r).toEqual({ hi: BigInt(max), lo: BigInt(min), neg: -5n });
});

test("floating point", async () => {
  const r = await row(ctx.conn, "SELECT 3.5::FLOAT AS f, 3.14::DOUBLE AS d");
  expect(r.f).toBeCloseTo(3.5, 5);
  expect(r.d).toBeCloseTo(3.14, 10);
});

test("decimal keeps scale", async () => {
  const r = await row(ctx.conn, "SELECT 123.45::DECIMAL(10,2) AS a, -9.9::DECIMAL(4,1) AS b");
  expect(r).toEqual({ a: 123.45, b: -9.9 });
});

test("varchar: inlined (<=12 chars) and pointer (>12 chars)", async () => {
  const long = "this string is definitely longer than twelve";
  const r = await row(ctx.conn, `SELECT 'hello' AS short, '${long}' AS long, '' AS empty`);
  expect(r).toEqual({ short: "hello", long, empty: "" });
});

test("date is a YYYY-MM-DD string", async () => {
  expect(await row(ctx.conn, "SELECT DATE '2026-07-12' AS d")).toEqual({ d: "2026-07-12" });
});

test("timestamp variants decode to Date", async () => {
  const r = await row(
    ctx.conn,
    "SELECT TIMESTAMP '2026-07-12 13:45:06' AS ts, TIMESTAMP_S '2026-07-12 13:45:06' AS s, TIMESTAMP_MS '2026-07-12 13:45:06.250' AS ms",
  );
  expect((r.ts as Date).toISOString()).toBe("2026-07-12T13:45:06.000Z");
  expect((r.s as Date).toISOString()).toBe("2026-07-12T13:45:06.000Z");
  expect((r.ms as Date).toISOString()).toBe("2026-07-12T13:45:06.250Z");
});

test("uuid decodes to canonical string", async () => {
  const u = "12345678-1234-5678-1234-567812345678";
  expect(await row(ctx.conn, `SELECT '${u}'::UUID AS id`)).toEqual({ id: u });
});

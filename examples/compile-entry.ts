// Minimal entrypoint used to prove `bun build --compile` yields a standalone
// binary with libduckdb embedded. Prints a JSON line the compile test asserts on.
import { DuckDBInstance, libraryVersion } from "../src/index.ts";

const db = await DuckDBInstance.create(":memory:");
const conn = await db.connect();
const scalar = await conn.runAndReadAll("SELECT 'ok' AS v, 42::BIGINT AS n");
const multi = await conn.runAndReadAll("SELECT COUNT(*) AS c FROM range(3000)");
conn.closeSync();
db.closeSync();

const row = scalar.getRowObjects()[0];
console.log(
  JSON.stringify({
    version: libraryVersion(),
    v: row.v,
    n: Number(row.n as bigint),
    count: Number(multi.getRowObjects()[0].c as bigint),
  }),
);

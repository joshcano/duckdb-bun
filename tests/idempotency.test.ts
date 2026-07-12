import { test } from "bun:test";
import { DuckDBInstance } from "../src/index.ts";

test("closeSync is idempotent on connection and instance", async () => {
  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();
  await conn.run("SELECT 1");
  conn.closeSync();
  conn.closeSync();
  db.closeSync();
  db.closeSync();
});

test("prepared statement close is idempotent", async () => {
  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();
  const st = await conn.prepare("SELECT 1 AS a");
  await st.readAll();
  st.close();
  st.close();
  conn.closeSync();
  db.closeSync();
});

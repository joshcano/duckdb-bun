// A faithful port of oscar-backend/src/mcp/workspace.ts onto duckdb-bun, proving
// the migration is a mechanical drop-in. Two changes vs the original:
//   1. import from "duckdb-bun" instead of "@duckdb/node-api"
//   2. sanitizeValue() loses its DuckDB*Value class branches — this binding
//      returns native JS values (Date / number / bigint / string / null) directly,
//      and DATE comes back as a YYYY-MM-DD string.
// Everything else (SQL, quotas, TTL, read-only guard) is unchanged. This whole
// file `bun build --compile`s into a standalone binary (see workspace.test.ts).
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type DuckDBConnection, DuckDBInstance } from "../src/index.ts";

const WORKSPACE_TTL_MS = 30 * 60 * 1000;
const MAX_TABLES_PER_WORKSPACE = 32;
const MAX_ROWS_PER_TABLE = 200_000;
const WORKSPACE_MEMORY_LIMIT = "256MB";
const WORKSPACE_TEMP_DIR_SIZE = "1GB";
const WORKSPACE_THREADS = 2;

export interface AppendResult {
  table: string;
  columns: string[];
  rows_added: number;
  total_rows: number;
  created: boolean;
}

export interface TableInfo {
  name: string;
  columns: { name: string; type: string }[];
  row_count: number;
  last_loaded_at: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
}

interface WorkspaceEntry {
  key: string;
  instance: DuckDBInstance;
  conn: DuckDBConnection;
  lastAccess: number;
  tableMeta: Map<string, { lastLoadedAt: string }>;
  tempDir: string;
}

const workspaces = new Map<string, WorkspaceEntry>();

function keyFor(userId: number, companyId: number): string {
  return `${userId}:${companyId}`;
}

async function ensureWorkspace(userId: number, companyId: number): Promise<WorkspaceEntry> {
  evictStale();
  const key = keyFor(userId, companyId);
  const existing = workspaces.get(key);
  if (existing) {
    existing.lastAccess = Date.now();
    return existing;
  }
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const tempDir = path.join(os.tmpdir(), `oscar-duck-${userId}-${companyId}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(tempDir, { recursive: true });
  await conn.run(`SET memory_limit = '${WORKSPACE_MEMORY_LIMIT}'`);
  await conn.run(`SET max_temp_directory_size = '${WORKSPACE_TEMP_DIR_SIZE}'`);
  await conn.run(`SET temp_directory = '${tempDir.replace(/'/g, "''")}'`);
  await conn.run(`SET threads = ${WORKSPACE_THREADS}`);
  const entry: WorkspaceEntry = {
    key,
    instance,
    conn,
    lastAccess: Date.now(),
    tableMeta: new Map(),
    tempDir,
  };
  workspaces.set(key, entry);
  return entry;
}

function evictStale(): void {
  const cutoff = Date.now() - WORKSPACE_TTL_MS;
  for (const [key, entry] of workspaces) {
    if (entry.lastAccess < cutoff) {
      entry.conn.closeSync();
      entry.instance.closeSync();
      try {
        fs.rmSync(entry.tempDir, { recursive: true, force: true });
      } catch {}
      workspaces.delete(key);
    }
  }
}

function assertIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Invalid identifier "${name}" — must match /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/`);
  }
}

function quoteIdent(name: string): string {
  assertIdentifier(name);
  return `"${name}"`;
}

function writeNdjson(rows: Record<string, unknown>[]): string {
  const file = path.join(os.tmpdir(), `oscar-ws-${crypto.randomBytes(6).toString("hex")}.ndjson`);
  const stream = rows.map((r) => JSON.stringify(r, bigintReplacer)).join("\n");
  fs.writeFileSync(file, stream);
  return file;
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

function normalizeRow(row: Record<string, unknown>, extraColumns?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  if (extraColumns) for (const [k, v] of Object.entries(extraColumns)) out[k] = v;
  return out;
}

async function getExistingColumns(conn: DuckDBConnection, table: string): Promise<Set<string>> {
  const result = await conn.runAndReadAll(`PRAGMA table_info(${quoteIdent(table)})`);
  const rows = result.getRowObjects() as { name: string; type: string }[];
  return new Set(rows.map((r) => r.name));
}

async function tableExists(conn: DuckDBConnection, table: string): Promise<boolean> {
  const result = await conn.runAndReadAll(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='main' AND table_name='${table.replace(/'/g, "''")}'`,
  );
  return result.getRowObjects().length > 0;
}

async function ensureColumnsExist(
  conn: DuckDBConnection,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const existing = await getExistingColumns(conn, table);
  const seen = new Map<string, unknown>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (existing.has(k) || seen.has(k)) continue;
      if (v !== null && v !== undefined) seen.set(k, v);
    }
  }
  for (const k of Object.keys(rows[0] ?? {})) if (!existing.has(k) && !seen.has(k)) seen.set(k, null);
  for (const [col, sample] of seen) {
    await conn.run(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(col)} ${inferSqlType(sample)}`);
  }
}

function inferSqlType(v: unknown): string {
  if (v === null || v === undefined) return "VARCHAR";
  if (typeof v === "number") return Number.isInteger(v) ? "BIGINT" : "DOUBLE";
  if (typeof v === "bigint") return "BIGINT";
  if (typeof v === "boolean") return "BOOLEAN";
  return "VARCHAR";
}

async function tableRowCount(conn: DuckDBConnection, table: string): Promise<number> {
  const r = await conn.runAndReadAll(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`);
  const rows = r.getRowObjects() as { n: bigint | number }[];
  return Number(rows[0].n);
}

export async function appendRows(
  userId: number,
  companyId: number,
  table: string,
  rows: Record<string, unknown>[],
  extraColumns?: Record<string, unknown>,
): Promise<AppendResult> {
  assertIdentifier(table);
  const ws = await ensureWorkspace(userId, companyId);
  const normalized = rows.map((r) => normalizeRow(r, extraColumns));
  if (normalized.length === 0) {
    const exists = await tableExists(ws.conn, table);
    const info = exists ? await tableRowCount(ws.conn, table) : 0;
    return { table, columns: [], rows_added: 0, total_rows: info, created: false };
  }
  const tmp = writeNdjson(normalized);
  try {
    const exists = await tableExists(ws.conn, table);
    let created = false;
    if (!exists) {
      if (ws.tableMeta.size >= MAX_TABLES_PER_WORKSPACE) {
        throw new Error(`Workspace table limit reached (${MAX_TABLES_PER_WORKSPACE}); drop one with clear_workspace.`);
      }
      await ws.conn.run(
        `CREATE TABLE ${quoteIdent(table)} AS SELECT * FROM read_json_auto('${tmp.replace(/'/g, "''")}')`,
      );
      created = true;
    } else {
      await ensureColumnsExist(ws.conn, table, normalized);
      await ws.conn.run(
        `INSERT INTO ${quoteIdent(table)} BY NAME SELECT * FROM read_json_auto('${tmp.replace(/'/g, "''")}')`,
      );
    }
    const total = await tableRowCount(ws.conn, table);
    if (total > MAX_ROWS_PER_TABLE) {
      throw new Error(`Table "${table}" would exceed row cap (${MAX_ROWS_PER_TABLE}). Current: ${total}.`);
    }
    ws.tableMeta.set(table, { lastLoadedAt: new Date().toISOString() });
    const cols = await getExistingColumns(ws.conn, table);
    return { table, columns: [...cols], rows_added: normalized.length, total_rows: total, created };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

export async function listTables(userId: number, companyId: number): Promise<TableInfo[]> {
  const ws = await ensureWorkspace(userId, companyId);
  const result = await ws.conn.runAndReadAll(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name",
  );
  const names = (result.getRowObjects() as { table_name: string }[]).map((r) => r.table_name);
  const out: TableInfo[] = [];
  for (const name of names) {
    const info = await ws.conn.runAndReadAll(`PRAGMA table_info(${quoteIdent(name)})`);
    const columns = (info.getRowObjects() as { name: string; type: string }[]).map((r) => ({
      name: r.name,
      type: r.type,
    }));
    const row_count = await tableRowCount(ws.conn, name);
    out.push({ name, columns, row_count, last_loaded_at: ws.tableMeta.get(name)?.lastLoadedAt ?? "unknown" });
  }
  return out;
}

const DISALLOWED =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|COPY|PRAGMA|CALL|EXPORT|IMPORT|LOAD|INSTALL|VACUUM|CHECKPOINT)\b/i;

function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (trimmed.includes(";")) throw new Error("Only a single statement is allowed.");
  if (DISALLOWED.test(trimmed)) throw new Error("Only SELECT / WITH queries are allowed in query_workspace.");
  if (!/^\s*(SELECT|WITH|VALUES)\b/i.test(trimmed)) throw new Error("Query must start with SELECT, WITH, or VALUES.");
}

export async function runQuery(userId: number, companyId: number, sql: string, rowLimit = 1000): Promise<QueryResult> {
  assertReadOnlySql(sql);
  const ws = await ensureWorkspace(userId, companyId);
  const wrapped = `WITH _user_query AS (${sql}) SELECT * FROM _user_query LIMIT ${rowLimit + 1}`;
  const result = await ws.conn.runAndReadAll(wrapped);
  const rawRows = result.getRowObjects() as Record<string, unknown>[];
  const truncated = rawRows.length > rowLimit;
  const rows = (truncated ? rawRows.slice(0, rowLimit) : rawRows).map(sanitizeRow);
  return { columns: result.columnNames(), rows, row_count: rows.length, truncated };
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = sanitizeValue(v);
  return out;
}

// Simplified vs the original: duckdb-bun returns native JS values, so the whole
// `switch (ctor)` over DuckDB*Value classes is gone. TIMESTAMP -> Date (handled
// below), DATE -> YYYY-MM-DD string, DECIMAL -> number, BIGINT/HUGEINT -> bigint.
export function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") {
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) return v.toString();
    return Number(v);
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.map(sanitizeValue);
    if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = sanitizeValue(val);
    return out;
  }
  return v;
}

export async function dropTable(userId: number, companyId: number, table: string): Promise<boolean> {
  assertIdentifier(table);
  const ws = await ensureWorkspace(userId, companyId);
  if (!(await tableExists(ws.conn, table))) return false;
  await ws.conn.run(`DROP TABLE ${quoteIdent(table)}`);
  ws.tableMeta.delete(table);
  return true;
}

export async function clearAllTables(userId: number, companyId: number): Promise<number> {
  const ws = await ensureWorkspace(userId, companyId);
  const tables = await listTables(userId, companyId);
  for (const t of tables) await ws.conn.run(`DROP TABLE ${quoteIdent(t.name)}`);
  ws.tableMeta.clear();
  return tables.length;
}

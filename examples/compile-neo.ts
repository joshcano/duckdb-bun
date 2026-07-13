// Compile entry for the drop-in @duckdb/node-api replacement: imports the public
// package entry (`src/neo.ts`) and exercises the vendored TS layer end-to-end over
// our bun:ffi bindings. Build with `bun run build:neo`. Proves the 1:1 API embeds
// libduckdb into a self-contained `bun build --compile` binary.
import { DuckDBInstance } from "../src/neo.ts";

const instance = await DuckDBInstance.create();
const connection = await instance.connect();
const reader = await connection.runAndReadAll(
  "SELECT 42::INTEGER AS n, 'ok' AS v, version() AS version, [1,2,3] AS list",
);
console.log(JSON.stringify(reader.getRowObjectsJson()[0]));
connection.disconnectSync();
instance.closeSync();

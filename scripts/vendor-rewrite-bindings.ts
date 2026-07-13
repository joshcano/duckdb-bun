// Rewrites the vendored @duckdb/node-api source so its `@duckdb/node-bindings`
// imports resolve to OUR bun:ffi bindings via a relative path. This is what makes
// the published package a self-contained drop-in — consumers import
// `@joshcano/duckdb-bun` and the vendored TS layer loads our bindings directly,
// with no test preload / build plugin needed.
//
// Idempotent. Re-run after re-vendoring on a DuckDB bump (see
// vendor/node-api/PROVENANCE.md). Only the `@duckdb/node-bindings` specifier is
// changed; everything else stays as upstream.

import { dirname, join, relative } from "node:path";
import { Glob } from "bun";

const ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT, "vendor/node-api/src");
const BINDINGS = join(ROOT, "src/bindings/index.ts");

let changed = 0;
const glob = new Glob("**/*.ts");
for await (const rel of glob.scan(SRC_DIR)) {
  const file = join(SRC_DIR, rel);
  const source = await Bun.file(file).text();
  if (!source.includes("@duckdb/node-bindings")) continue;
  // Relative import specifier from THIS file's dir to src/bindings/index.ts.
  let spec = relative(dirname(file), BINDINGS).replace(/\\/g, "/");
  if (!spec.startsWith(".")) spec = `./${spec}`;
  const rewritten = source.replace(/from ['"]@duckdb\/node-bindings['"]/g, `from "${spec}"`);
  if (rewritten !== source) {
    await Bun.write(file, rewritten);
    changed++;
  }
}
console.log(`Rewrote @duckdb/node-bindings import in ${changed} vendored file(s).`);

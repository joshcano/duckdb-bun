// Compiles examples/compile-neo.ts (the drop-in @duckdb/node-api entry) into a
// self-contained binary via `bun build --compile`. No import aliasing needed:
// scripts/vendor-rewrite-bindings.ts already points the vendored layer at our
// bindings, so the whole stack resolves without a plugin. Output: ./dd-neo.
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const proc = Bun.spawnSync(
  ["bun", "build", join(ROOT, "examples/compile-neo.ts"), "--compile", "--outfile", join(ROOT, "dd-neo")],
  { cwd: ROOT, stdout: "inherit", stderr: "inherit" },
);
process.exit(proc.exitCode ?? 1);

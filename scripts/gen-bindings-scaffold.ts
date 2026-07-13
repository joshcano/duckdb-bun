// One-shot generator: reads the version-matched node-bindings type contract
// (vendor/node-api/node-bindings.d.ts) and emits the runtime scaffold for our
// bun:ffi reimplementation of @duckdb/node-bindings:
//   - src/bindings/enums.ts     real enum values + sizeof_bool
//   - src/bindings/types.ts     interfaces + type aliases (compile-time only)
//   - src/bindings/functions.ts 273 stubs that throw NotImplemented
// Re-run after bumping the vendored DuckDB version to refresh the contract.
// Implemented functions are preserved via a hand-written allowlist so this
// never clobbers real code (Phase 0 has none implemented yet).
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DTS = join(ROOT, "vendor/node-api/node-bindings.d.ts");
const OUT = join(ROOT, "src/bindings");

const src = await Bun.file(DTS).text();
const lines = src.split("\n");

// Extract top-level `export <kind> Name {  ...  }` blocks by column-0 brace match.
function extractBlocks(kind: "enum" | "interface"): string[] {
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`export ${kind} `)) {
      const start = i;
      while (i < lines.length && lines[i] !== "}") i++;
      blocks.push(lines.slice(start, i + 1).join("\n"));
    }
  }
  return blocks;
}

// Type aliases: `export type Foo = ...;` (single or multi-line ending in `;`).
function extractTypeAliases(): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("export type ")) {
      const start = i;
      while (i < lines.length && !lines[i].trimEnd().endsWith(";")) i++;
      out.push(lines.slice(start, i + 1).join("\n"));
    }
  }
  return out;
}

// Function names: `export function name(...`
const fnNames: string[] = [];
for (const l of lines) {
  const m = l.match(/^export function ([a-z_0-9]+)\(/);
  if (m) fnNames.push(m[1]);
}

import { existsSync } from "node:fs";
// Discover which functions are already really implemented under impl/, so we
// re-export those and only emit NotImplemented stubs for the rest. Keeps
// functions.ts correct and duplicate-free every time it's regenerated.
import { Glob } from "bun";

const implDir = join(OUT, "impl");
const implModules: string[] = [];
const implemented = new Set<string>();
if (existsSync(implDir)) {
  const glob = new Glob("*.ts");
  for await (const file of glob.scan(implDir)) {
    implModules.push(file.replace(/\.ts$/, ""));
    const text = await Bun.file(join(implDir, file)).text();
    // Match both `export function name(` and `export const name =` (arrow fns).
    for (const m of text.matchAll(/^export (?:function|const) ([a-z_0-9]+)\s*[=(]/gm)) {
      implemented.add(m[1]);
    }
  }
}
implModules.sort();

const enums = extractBlocks("enum");
const interfaces = extractBlocks("interface");
const typeAliases = extractTypeAliases();

// ---- enums.ts ----
const enumsOut = `// AUTO-GENERATED scaffold (scripts/gen-bindings-scaffold.ts) from the
// version-matched @duckdb/node-bindings contract. Real runtime enum values —
// safe to edit by hand only if you also update the generator's source of truth.
export const sizeof_bool = 1;

${enums.join("\n\n")}
`;
await Bun.write(join(OUT, "enums.ts"), enumsOut);

// ---- types.ts ----
const typesOut = `// AUTO-GENERATED scaffold: compile-time-only interfaces + type aliases mirroring
// @duckdb/node-bindings. Handles (Connection, Result, Vector, ...) are opaque at
// runtime (pointers / wrapper objects); these brands only line up the types.
import type { PendingState, ResultType, StatementType, Type } from "./enums.ts";
// Referenced by some interfaces below; imported so this file is self-contained.
export type { PendingState, ResultType, StatementType, Type };

${interfaces.join("\n\n")}

${typeAliases.join("\n\n")}
`;
await Bun.write(join(OUT, "types.ts"), typesOut);

// ---- functions.ts (re-export impls + stub the rest) ----
const stubNames = fnNames.filter((n) => !implemented.has(n));
const stubBody = stubNames
  .map((n) => `export function ${n}(..._args: unknown[]): never {\n  throw new NotImplemented("${n}");\n}`)
  .join("\n\n");
const reExports = implModules.map((m) => `export * from "./impl/${m}.ts";`).join("\n");
const functionsOut = `// AUTO-GENERATED barrel for the @duckdb/node-bindings surface. Implemented
// functions are re-exported from ./impl/*; the rest are NotImplemented stubs so
// gaps surface loudly, never silently. Regenerate with
// \`bun run scripts/gen-bindings-scaffold.ts\` after adding impl functions.
export class NotImplemented extends Error {
  constructor(fn: string) {
    super(\`@duckdb/node-bindings: '\${fn}' is not implemented yet (duckdb-bun)\`);
    this.name = "NotImplemented";
  }
}

// --- implemented (${implemented.size}/${fnNames.length}) ---
${reExports}

// --- not yet implemented (${stubNames.length}) ---
${stubBody}
`;
await Bun.write(join(OUT, "functions.ts"), functionsOut);

console.log(
  `Generated: ${enums.length} enums, ${interfaces.length} interfaces, ${typeAliases.length} type aliases; ${implemented.size} implemented + ${stubNames.length} stubbed (${implModules.length} impl modules)`,
);

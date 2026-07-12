// Reports whether our pinned DuckDB version is behind the latest release, and
// whether the vendored lib / @duckdb/node-api reference match the pin.
// Run: `bun run check-version`. Exits non-zero on drift (so CI can gate on it).
import { existsSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };
import { DUCKDB_VERSION, DUCKDB_VERSION_TAG } from "../src/version.ts";

function cmp(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

async function latestDuckDBRelease(): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/repos/duckdb/duckdb/releases/latest", {
      headers: { "User-Agent": "duckdb-bun-check" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { tag_name?: string };
    return json.tag_name?.replace(/^v/, "") ?? null;
  } catch {
    return null;
  }
}

const nodeApiPin = (pkg.devDependencies?.["@duckdb/node-api"] ?? "").replace(/^[^0-9]*/, "").replace(/-r.*$/, "");
const vendored = existsSync(new URL("../vendor/linux-x64/libduckdb.so", import.meta.url).pathname);
const latest = await latestDuckDBRelease();

// Hard failures (exit 1) mean the repo is in a broken/misleading state. A newer
// upstream release is informational only — it must not turn CI red on its own.
let hardDrift = false;
console.log(`duckdb-bun pin (src/version.ts):   ${DUCKDB_VERSION_TAG}`);
console.log(`@duckdb/node-api devDep:            ${nodeApiPin || "unknown"}`);
console.log(`vendored libduckdb present:         ${vendored ? "yes (linux-x64)" : "NO — run `bun run fetch-lib`"}`);
console.log(`latest DuckDB release:              ${latest ? `v${latest}` : "unavailable (network?)"}`);

if (!vendored) {
  console.log("\n❌ vendored libduckdb missing — run `bun run fetch-lib` before testing.");
  hardDrift = true;
}
if (nodeApiPin && nodeApiPin !== DUCKDB_VERSION) {
  console.log(
    `\n❌ @duckdb/node-api (${nodeApiPin}) differs from the pin (${DUCKDB_VERSION}) — the parity test would compare against a different DuckDB. Align them.`,
  );
  hardDrift = true;
}
if (latest && cmp(latest, DUCKDB_VERSION) > 0) {
  console.log(
    `\n⬆️  DuckDB v${latest} is newer than the pin ${DUCKDB_VERSION_TAG} (informational). See MAINTENANCE.md to upgrade.`,
  );
}

console.log(hardDrift ? "\n⚠️  action needed (see above)." : "\n✅ consistent.");
process.exit(hardDrift ? 1 : 0);

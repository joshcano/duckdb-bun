// Downloads the prebuilt libduckdb shared library for a target platform into
// vendor/<platform-dir>/. Version is pinned in src/version.ts. Run: `bun run fetch-lib`.
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { DUCKDB_VERSION } from "../src/version.ts";

// process.platform/arch -> { asset zip name, file inside zip, vendored dir + filename }
type Target = { asset: string; libInZip: string; dir: string; out: string };

const TARGETS: Record<string, Target> = {
  "linux-x64": { asset: "libduckdb-linux-amd64", libInZip: "libduckdb.so", dir: "linux-x64", out: "libduckdb.so" },
  "linux-x64-musl": {
    asset: "libduckdb-linux-amd64-musl",
    libInZip: "libduckdb.so",
    dir: "linux-x64-musl",
    out: "libduckdb.so",
  },
  "linux-arm64": { asset: "libduckdb-linux-arm64", libInZip: "libduckdb.so", dir: "linux-arm64", out: "libduckdb.so" },
  "darwin-x64": { asset: "libduckdb-osx-universal", libInZip: "libduckdb.dylib", dir: "osx", out: "libduckdb.dylib" },
  "darwin-arm64": { asset: "libduckdb-osx-universal", libInZip: "libduckdb.dylib", dir: "osx", out: "libduckdb.dylib" },
  "win32-x64": { asset: "libduckdb-windows-amd64", libInZip: "duckdb.dll", dir: "win-x64", out: "duckdb.dll" },
};

function hostKey(): string {
  const base = `${process.platform}-${process.arch}`;
  // crude libc sniff: prefer musl asset on Alpine
  if (base === "linux-x64" && existsSync("/etc/alpine-release")) return "linux-x64-musl";
  return base;
}

async function main() {
  const key = process.argv[2] ?? hostKey();
  const target = TARGETS[key];
  if (!target) {
    console.error(`Unknown target "${key}". Known: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }

  const vendorDir = new URL(`../vendor/${target.dir}/`, import.meta.url).pathname;
  const headerPath = new URL("../vendor/duckdb.h", import.meta.url).pathname;
  const url = `https://github.com/duckdb/duckdb/releases/download/v${DUCKDB_VERSION}/${target.asset}.zip`;
  const tmpZip = new URL(`../vendor/${target.asset}.zip`, import.meta.url).pathname;

  console.log(`Fetching ${url}`);
  // Use curl (present on CI runners and dev machines) — it follows the GitHub
  // release redirect reliably; Bun's fetch has stalled on it in some environments.
  await Bun.$`curl -fsSL ${url} -o ${tmpZip}`;

  await mkdir(vendorDir, { recursive: true });
  await Bun.$`unzip -o -q ${tmpZip} -d ${vendorDir}`;

  // Move the shared lib to its canonical name; keep duckdb.h at vendor/ root.
  // (Skip the mv when the names already match — `mv -f X X` errors out.)
  const extracted = `${vendorDir}${target.libInZip}`;
  const outPath = `${vendorDir}${target.out}`;
  if (extracted !== outPath) await Bun.$`mv -f ${extracted} ${outPath}`;
  if (existsSync(`${vendorDir}duckdb.h`)) await Bun.$`mv -f ${vendorDir}duckdb.h ${headerPath}`;
  // Drop everything else we don't ship (static lib, hpp).
  await Bun.$`rm -f ${vendorDir}libduckdb_static.a ${vendorDir}duckdb.hpp`.nothrow();
  await rm(tmpZip, { force: true });

  console.log(`Vendored ${target.out} (DuckDB v${DUCKDB_VERSION}) -> vendor/${target.dir}/`);
}

// Top-level await so Bun keeps the process alive until the download completes
// (a bare `main().catch()` lets the process exit before the async work runs).
try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}

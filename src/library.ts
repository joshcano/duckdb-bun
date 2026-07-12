// Resolves the native assets (libduckdb + the cc shim source + duckdb.h) and,
// when running inside a `bun build --compile` standalone binary, materializes the
// embedded copies to a real temp dir (TinyCC and the C-level dlopen can't read
// Bun's virtual `/$bunfs/` filesystem). Under `bun run` the embedded imports
// already resolve to on-disk paths, so we skip the copy and use them directly.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import shimSource from "../native/shim.c" with { type: "file" };
import duckdbHeader from "../vendor/duckdb.h" with { type: "file" };
// Embedded so `bun build --compile` bundles them into the executable.
import libLinuxX64 from "../vendor/linux-x64/libduckdb.so" with { type: "file" };

export interface NativePaths {
  /** Absolute path to libduckdb for dlopen + the shim's dlsym. */
  libPath: string;
  /** Absolute path to native/shim.c for bun:ffi `cc`. */
  shimPath: string;
  /** Directory containing duckdb.h for the shim's `-I` include flag. */
  includeDir: string;
}

function selectLib(): string {
  const key = `${process.platform}-${process.arch}`;
  if (key === "linux-x64") return libLinuxX64;
  throw new Error(
    `duckdb-bun: no vendored libduckdb for ${key}. Run \`bun run fetch-lib\`, then add the platform to scripts/fetch-lib.ts and an import in src/library.ts.`,
  );
}

let cached: NativePaths | undefined;

export async function loadNative(): Promise<NativePaths> {
  if (cached) return cached;
  const lib = selectLib();
  if (!lib.startsWith("/$bunfs/")) {
    // Dev / test: on-disk source paths.
    cached = { libPath: lib, shimPath: shimSource, includeDir: dirname(duckdbHeader) };
    return cached;
  }
  // Compiled binary: copy embedded assets out to a real directory.
  const dir = mkdtempSync(join(tmpdir(), "duckdb-bun-"));
  const libPath = join(dir, "libduckdb.so");
  const shimPath = join(dir, "shim.c");
  await Promise.all([
    Bun.write(libPath, Bun.file(lib)),
    Bun.write(shimPath, Bun.file(shimSource)),
    Bun.write(join(dir, "duckdb.h"), Bun.file(duckdbHeader)),
  ]);
  cached = { libPath, shimPath, includeDir: dir };
  return cached;
}

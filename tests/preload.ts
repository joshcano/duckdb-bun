// Test preload: rewrites the `vitest` import in the vendored official test files
// to our bun:test shim.
//
// `bun test` hard-remaps `vitest` -> bun:test (which has no `assert` export)
// before tsconfig paths or plugin onResolve run, so the only way to redirect it is
// to rewrite the specifier in the source at LOAD time — Bun then never sees
// `vitest`. Scoped to the vendored test dir.
//
// The vendored SRC's `@duckdb/node-bindings` import is already rewritten to our
// bun:ffi bindings on disk by scripts/vendor-rewrite-bindings.ts, so no alias is
// needed for it here — that on-disk rewrite is also what makes the published
// package a plugin-free drop-in.

import { join } from "node:path";
import { plugin } from "bun";

const VITEST_SHIM = join(import.meta.dir, "./vitest-shim.ts");
const VENDOR_TEST = /\/vendor\/node-api\/test\/.*\.ts$/;

plugin({
  name: "duckdb-bun-vitest-alias",
  setup(build) {
    build.onLoad({ filter: VENDOR_TEST }, async (args) => {
      const source = await Bun.file(args.path).text();
      const contents = source.replace(/from ['"]vitest['"]/g, `from ${JSON.stringify(VITEST_SHIM)}`);
      return { contents, loader: "ts" };
    });
  },
});

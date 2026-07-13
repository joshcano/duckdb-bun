// Compatibility shim so the vendored official test suite (which imports from
// `vitest`) runs unmodified under `bun:test`. The scoped resolver plugin in
// tests/preload.ts rewrites `vitest` -> this file, but only for importers under
// vendor/node-api/. We map the runner primitives to bun:test and reimplement the
// small slice of chai's `assert` the suite uses, deferring deep-equality to
// bun:test's mature matchers.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test };

// Benchmarks aren't executed under bun:test; provide a no-op so bench files that
// import `bench` still load without error if they're ever pulled in.
export function bench(..._args: unknown[]): void {}

function fail(message?: string): never {
  throw new Error(message ?? "assert.fail()");
}

// chai-compatible `assert` — also callable as `assert(value, msg)`. Only the
// methods the vendored suite actually uses are implemented (equal is loose `==`,
// strictEqual is `===`, deep* defer to bun:test's structural equality).
export const assert = Object.assign(
  (value: unknown, message?: string): void => {
    if (!value) fail(message ?? `expected ${String(value)} to be truthy`);
  },
  {
    equal(actual: unknown, expected: unknown, message?: string): void {
      // biome-ignore lint/suspicious/noDoubleEquals: chai.assert.equal is loose ==
      if (!(actual == expected)) fail(message ?? `expected ${String(actual)} == ${String(expected)}`);
    },
    strictEqual(actual: unknown, expected: unknown, message?: string): void {
      if (!(actual === expected)) fail(message ?? `expected ${String(actual)} === ${String(expected)}`);
    },
    notEqual(actual: unknown, expected: unknown, message?: string): void {
      // biome-ignore lint/suspicious/noDoubleEquals: chai.assert.notEqual is loose !=
      if (actual == expected) fail(message ?? `expected values to differ`);
    },
    deepEqual(actual: unknown, expected: unknown, message?: string): void {
      try {
        expect(actual).toEqual(expected as never);
      } catch (e) {
        fail(message ?? (e as Error).message);
      }
    },
    deepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
      try {
        expect(actual).toStrictEqual(expected as never);
      } catch (e) {
        fail(message ?? (e as Error).message);
      }
    },
    isDefined(value: unknown, message?: string): void {
      if (value === undefined) fail(message ?? "expected value to be defined");
    },
    isUndefined(value: unknown, message?: string): void {
      if (value !== undefined) fail(message ?? "expected value to be undefined");
    },
    isNull(value: unknown, message?: string): void {
      if (value !== null) fail(message ?? "expected value to be null");
    },
    isNotNull(value: unknown, message?: string): void {
      if (value === null) fail(message ?? "expected value to not be null");
    },
    isTrue(value: unknown, message?: string): void {
      if (value !== true) fail(message ?? `expected ${String(value)} to be true`);
    },
    isFalse(value: unknown, message?: string): void {
      if (value !== false) fail(message ?? `expected ${String(value)} to be false`);
    },
    ok(value: unknown, message?: string): void {
      if (!value) fail(message ?? `expected ${String(value)} to be truthy`);
    },
    throws(fn: () => unknown, message?: string): void {
      try {
        fn();
      } catch {
        return;
      }
      fail(message ?? "expected function to throw");
    },
    fail(actualOrMessage?: unknown, _expected?: unknown, message?: string): never {
      fail(
        typeof actualOrMessage === "string" && _expected === undefined ? actualOrMessage : (message ?? "assert.fail()"),
      );
    },
  },
);

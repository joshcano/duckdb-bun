import { expect, test } from "bun:test";
import { libraryVersion } from "../src/index.ts";
import { DUCKDB_VERSION_TAG } from "../src/version.ts";

test("the loaded libduckdb matches the pinned version (catches vendor drift)", () => {
  expect(libraryVersion()).toBe(DUCKDB_VERSION_TAG);
});

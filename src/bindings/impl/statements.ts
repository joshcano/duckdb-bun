// Multi-statement extraction. `run(sql, values)` routes through here: node-api
// extracts, runs all but the last statement, then prepares/binds the last.
import { cstr, lib, ptr } from "../ffi.ts";
import { handleSlot, livePreparedStatements, outSlot, type Ptr, readSlot } from "../handles.ts";

export function extract_statements(
  connection: Ptr,
  query: string,
): { extracted_statements: Ptr; statement_count: number } {
  const slot = outSlot();
  const count = Number(lib.duckdb_extract_statements(connection, cstr(query), ptr(slot)));
  return { extracted_statements: readSlot(slot), statement_count: count };
}

export function prepare_extracted_statement(connection: Ptr, extracted: Ptr, index: number): Ptr {
  const slot = outSlot();
  const rc = lib.duckdb_prepare_extracted_statement(connection, extracted, BigInt(index), ptr(slot));
  const stmt = readSlot(slot);
  if (rc !== 0) {
    lib.duckdb_destroy_prepare(handleSlot(stmt));
    throw new Error("duckdb_prepare_extracted_statement failed");
  }
  livePreparedStatements.add(stmt);
  return stmt;
}

export function extract_statements_error(extracted: Ptr): string {
  return String(lib.duckdb_extract_statements_error(extracted));
}

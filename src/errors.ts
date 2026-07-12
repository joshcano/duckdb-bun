// A real Error subclass so callers (e.g. oscar-backend workspace.ts) can keep
// using `err instanceof Error` and message regex checks (e.g. /Out of Memory/i).
export class DuckDBError extends Error {
  readonly duckdbMessage: string;
  constructor(message: string) {
    super(message);
    this.name = "DuckDBError";
    this.duckdbMessage = message;
  }
}

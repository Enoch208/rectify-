import type { DatabaseSync } from "node:sqlite";
import type { ActionRecord } from "./action.ts";
import { deserializeAction } from "./ledger-serialization.ts";

export const runTransaction = <Output>(database: DatabaseSync, operation: () => Output): Output => {
  database.exec("BEGIN IMMEDIATE");
  try {
    const output = operation();
    database.exec("COMMIT");
    return output;
  } catch (error: unknown) {
    database.exec("ROLLBACK");
    throw error;
  }
};

export const readAction = (database: DatabaseSync, actionId: string): ActionRecord => {
  const row = database.prepare("SELECT * FROM actions WHERE id = ?").get(actionId);
  if (row === undefined) {
    throw new Error(`Action not found: ${actionId}`);
  }
  const attempts = database
    .prepare("SELECT * FROM action_attempts WHERE action_id = ? ORDER BY number")
    .all(actionId);
  return deserializeAction(row, attempts);
};

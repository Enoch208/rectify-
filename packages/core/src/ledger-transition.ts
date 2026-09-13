import type { DatabaseSync } from "node:sqlite";
import type { ActionRecord, ActionState } from "./action.ts";
import { readAction, runTransaction } from "./ledger-database.ts";
import { ActionTransitionError } from "./ledger-errors.ts";

export interface TransitionValues {
  providerIds?: readonly string[];
  uncertaintyReason?: string | null;
  error?: string | null;
}

export const assertActionStatus = (
  action: ActionRecord,
  expected: readonly ActionState[],
  target: ActionState,
): void => {
  if (!expected.includes(action.status)) {
    throw new ActionTransitionError(action.id, action.status, target);
  }
};

export const transitionAction = (
  database: DatabaseSync,
  now: () => Date,
  actionId: string,
  expected: readonly ActionState[],
  target: ActionState,
  values: TransitionValues = {},
): ActionRecord =>
  runTransaction(database, () => {
    const current = readAction(database, actionId);
    assertActionStatus(current, expected, target);
    const timestamp = now().toISOString();
    database
      .prepare(
        `
          UPDATE actions
          SET status = ?, provider_ids_json = ?, uncertainty_reason = ?, error = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        target,
        JSON.stringify(values.providerIds ?? current.providerIds),
        values.uncertaintyReason ?? null,
        values.error ?? null,
        timestamp,
        actionId,
      );
    if (current.status === "DISPATCHING") {
      database
        .prepare(
          `
            UPDATE action_attempts
            SET finished_at = ?, outcome = ?, error = ?
            WHERE action_id = ? AND number = (
              SELECT MAX(number) FROM action_attempts WHERE action_id = ?
            ) AND outcome IS NULL
          `,
        )
        .run(
          timestamp,
          target,
          values.error ?? values.uncertaintyReason ?? null,
          actionId,
          actionId,
        );
    }
    return readAction(database, actionId);
  });

import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { ActionRecord, ActionState } from "./action.ts";
import { readAction, runTransaction } from "./ledger-database.ts";
import { ActionTransitionError, LogicalActionConflictError } from "./ledger-errors.ts";
import {
  actionIntentSchema,
  type ActionIntent,
  type ActionLedgerOptions,
} from "./ledger-intent.ts";
import { migrateActionLedger } from "./ledger-schema.ts";
import { payloadHash, stableJson } from "./ledger-serialization.ts";

export class ActionLedger {
  readonly #database: DatabaseSync;
  readonly #now: () => Date;
  readonly #createId: () => string;

  constructor(options: ActionLedgerOptions) {
    this.#database = new DatabaseSync(options.path, { allowExtension: false });
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? randomUUID;
    migrateActionLedger(this.#database);
    this.#database.enableDefensive(true);
  }

  close(): void {
    this.#database.close();
  }

  getAction(actionId: string): ActionRecord {
    return readAction(this.#database, actionId);
  }

  getByLogicalKey(logicalKey: string): ActionRecord | null {
    const row = this.#database
      .prepare("SELECT id FROM actions WHERE logical_key = ?")
      .get(logicalKey);
    const id = z.object({ id: z.string() }).safeParse(row);
    return id.success ? readAction(this.#database, id.data.id) : null;
  }

  planAction(intentInput: ActionIntent): ActionRecord {
    const intent = actionIntentSchema.parse(intentInput);
    const serializedPayload = stableJson(intent.payload);
    const hash = payloadHash(intent.payload);
    return runTransaction(this.#database, () => {
      const existing = this.getByLogicalKey(intent.logicalKey);
      if (existing !== null) {
        const sameIntent =
          existing.caseId === intent.caseId &&
          existing.provider === intent.provider &&
          existing.kind === intent.kind &&
          existing.payloadHash === hash;
        if (!sameIntent) {
          throw new LogicalActionConflictError(intent.logicalKey);
        }
        return existing;
      }
      const id = this.#createId();
      const timestamp = this.#now().toISOString();
      this.#database
        .prepare(
          `
          INSERT INTO actions (
            id, case_id, version, logical_key, provider, kind, payload_json, payload_hash,
            status, provider_ids_json, created_at, updated_at
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'PLANNED', '[]', ?, ?)
        `,
        )
        .run(
          id,
          intent.caseId,
          intent.logicalKey,
          intent.provider,
          intent.kind,
          serializedPayload,
          hash,
          timestamp,
          timestamp,
        );
      return readAction(this.#database, id);
    });
  }

  #assertStatus(action: ActionRecord, expected: readonly ActionState[], target: ActionState): void {
    if (!expected.includes(action.status)) {
      throw new ActionTransitionError(action.id, action.status, target);
    }
  }

  #transition(
    actionId: string,
    expected: readonly ActionState[],
    target: ActionState,
    values: {
      providerIds?: readonly string[];
      uncertaintyReason?: string | null;
      error?: string | null;
    } = {},
  ): ActionRecord {
    return runTransaction(this.#database, () => {
      const current = readAction(this.#database, actionId);
      this.#assertStatus(current, expected, target);
      const timestamp = this.#now().toISOString();
      this.#database
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
        this.#database
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
      return readAction(this.#database, actionId);
    });
  }

  authorize(actionId: string): ActionRecord {
    return this.#transition(actionId, ["PLANNED"], "AUTHORIZED");
  }

  reject(actionId: string, reason: string): ActionRecord {
    return this.#transition(actionId, ["PLANNED", "AUTHORIZED"], "REJECTED", { error: reason });
  }

  startDispatch(actionId: string): ActionRecord {
    return runTransaction(this.#database, () => {
      const current = readAction(this.#database, actionId);
      this.#assertStatus(current, ["AUTHORIZED"], "DISPATCHING");
      const timestamp = this.#now().toISOString();
      const number = current.attempts.length + 1;
      this.#database
        .prepare("UPDATE actions SET status = 'DISPATCHING', updated_at = ? WHERE id = ?")
        .run(timestamp, actionId);
      this.#database
        .prepare("INSERT INTO action_attempts (action_id, number, started_at) VALUES (?, ?, ?)")
        .run(actionId, number, timestamp);
      return readAction(this.#database, actionId);
    });
  }

  confirm(actionId: string, providerIds: readonly string[]): ActionRecord {
    return this.#transition(actionId, ["DISPATCHING", "OUTCOME_UNKNOWN"], "CONFIRMED", {
      providerIds,
    });
  }

  markOutcomeUnknown(actionId: string, reason: string): ActionRecord {
    return this.#transition(actionId, ["DISPATCHING"], "OUTCOME_UNKNOWN", {
      uncertaintyReason: reason,
    });
  }

  markConfirmedFailed(actionId: string, reason: string): ActionRecord {
    return this.#transition(actionId, ["DISPATCHING", "OUTCOME_UNKNOWN"], "CONFIRMED_FAILED", {
      error: reason,
    });
  }

  recordUnresolvedReconciliation(actionId: string, reason: string): ActionRecord {
    return runTransaction(this.#database, () => {
      const current = readAction(this.#database, actionId);
      this.#assertStatus(current, ["OUTCOME_UNKNOWN"], "OUTCOME_UNKNOWN");
      this.#database
        .prepare("UPDATE actions SET uncertainty_reason = ?, updated_at = ? WHERE id = ?")
        .run(reason, this.#now().toISOString(), actionId);
      return readAction(this.#database, actionId);
    });
  }

  recoverInterruptedDispatches(): ActionRecord[] {
    const rows = this.#database
      .prepare("SELECT id FROM actions WHERE status = 'DISPATCHING' ORDER BY created_at")
      .all();
    return rows.map((row) => {
      const parsed = z.object({ id: z.string() }).parse(row);
      return this.markOutcomeUnknown(parsed.id, "Worker restarted during provider dispatch");
    });
  }

  listOutcomeUnknown(): ActionRecord[] {
    const rows = this.#database
      .prepare("SELECT id FROM actions WHERE status = 'OUTCOME_UNKNOWN' ORDER BY created_at")
      .all();
    return rows.map((row) =>
      readAction(this.#database, z.object({ id: z.string() }).parse(row).id),
    );
  }
}

import type { ActionRecord } from "@rectify/core";
import type { ActionIntent, ActionLedger } from "@rectify/core/ledger";

export class ConfirmedActionFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmedActionFailure";
  }
}

export type PolicyDecision = { authorized: true } | { authorized: false; reason: string };
export type ReconciliationResult =
  | { outcome: "CONFIRMED"; providerIds: readonly string[] }
  | { outcome: "CONFIRMED_FAILED"; reason: string }
  | { outcome: "UNRESOLVED"; reason: string };

export type ActionAuthorizer = (action: ActionRecord) => Promise<PolicyDecision>;
export type ActionExecutor = (action: ActionRecord) => Promise<{ providerIds: readonly string[] }>;
export type ActionReconciler = (action: ActionRecord) => Promise<ReconciliationResult>;

export interface ActionWorkerOptions {
  ledger: ActionLedger;
  reconcilers?: ReadonlyMap<string, ActionReconciler>;
}

const reconciliationKey = (action: ActionRecord): string => `${action.provider}:${action.kind}`;

export class ActionWorker {
  readonly #ledger: ActionLedger;
  readonly #reconcilers: ReadonlyMap<string, ActionReconciler>;

  constructor(options: ActionWorkerOptions) {
    this.#ledger = options.ledger;
    this.#reconcilers = options.reconcilers ?? new Map();
  }

  async execute(
    intent: ActionIntent,
    authorize: ActionAuthorizer,
    executeProviderWrite: ActionExecutor,
  ): Promise<ActionRecord> {
    const planned = this.#ledger.planAction(intent);
    if (planned.status !== "PLANNED") {
      return planned;
    }
    const decision = await authorize(planned);
    if (!decision.authorized) {
      return this.#ledger.reject(planned.id, decision.reason);
    }
    const authorized = this.#ledger.authorize(planned.id);
    const dispatching = this.#ledger.startDispatch(authorized.id);
    try {
      const result = await executeProviderWrite(dispatching);
      if (result.providerIds.length === 0) {
        throw new ConfirmedActionFailure("Provider write returned no durable identifier");
      }
      return this.#ledger.confirm(dispatching.id, result.providerIds);
    } catch (error: unknown) {
      if (error instanceof ConfirmedActionFailure) {
        return this.#ledger.markConfirmedFailed(dispatching.id, error.message);
      }
      const reason = error instanceof Error ? error.message : "Provider write outcome is unknown";
      return this.#ledger.markOutcomeUnknown(dispatching.id, reason);
    }
  }

  async reconcileOnRestart(): Promise<ActionRecord[]> {
    this.#ledger.recoverInterruptedDispatches();
    const uncertain = this.#ledger.listOutcomeUnknown();
    const results: ActionRecord[] = [];
    for (const action of uncertain) {
      const reconciler = this.#reconcilers.get(reconciliationKey(action));
      if (reconciler === undefined) {
        results.push(action);
        continue;
      }
      try {
        const result = await reconciler(action);
        if (result.outcome === "CONFIRMED") {
          results.push(this.#ledger.confirm(action.id, result.providerIds));
        } else if (result.outcome === "CONFIRMED_FAILED") {
          results.push(this.#ledger.markConfirmedFailed(action.id, result.reason));
        } else {
          results.push(this.#ledger.recordUnresolvedReconciliation(action.id, result.reason));
        }
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Reconciliation failed";
        results.push(this.#ledger.recordUnresolvedReconciliation(action.id, reason));
      }
    }
    return results;
  }
}

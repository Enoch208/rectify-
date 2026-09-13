import type { ActionRecord } from "@rectify/core";
import { actionStateStatus } from "@/lib/case-presentation";
import { StatusPill } from "@/components/workspace/status-pill";
import { Field, Panel } from "./panel";

export function UncertainActions({ actions }: { actions: readonly ActionRecord[] }) {
  const uncertain = actions.filter((action) => action.status === "OUTCOME_UNKNOWN");
  if (uncertain.length === 0) {
    return null;
  }

  return (
    <Panel title="Needs reconciliation">
      <ul className="flex flex-col gap-4">
        {uncertain.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-white">{action.kind}</span>
              <StatusPill status={actionStateStatus[action.status]} />
            </div>
            <Field label="Why">{action.uncertaintyReason ?? "No reason recorded."}</Field>
            <Field label="Provider IDs">
              {action.providerIds.length === 0 ? "None saved" : action.providerIds.join(", ")}
            </Field>
            <p className="text-xs text-neutral-500">
              Further dispatch is held. A human checks the provider before anything is retried.
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

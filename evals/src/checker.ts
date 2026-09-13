import { createHash } from "node:crypto";
import { verifyOutcomeEvent } from "@rectify/core/outcomes";
import { scenarioChecks } from "./scenario-checker.ts";
import {
  evaluationArtifactSchema,
  verdictSchema,
  type CheckResult,
  type EvaluationArtifact,
  type Verdict,
} from "./schema.ts";

const result = (id: string, passed: boolean, detail: string): CheckResult => ({
  id,
  passed,
  detail,
});

const commonChecks = (artifact: EvaluationArtifact, outcomeSecret: string): CheckResult[] => {
  const tenant = artifact.case.tenantId;
  const logicalKeys = artifact.providerEffects.map((effect) => effect.logicalKey);
  const uniqueLogicalKeys = new Set(logicalKeys);
  const evidenceProviders = new Set(artifact.evidence.map((evidence) => evidence.provider));
  const latest = artifact.verifications.find(
    (verification) => verification.id === artifact.case.latestVerificationId,
  );
  const validRecovery = artifact.outcomeEvents.some(
    (event) =>
      event.caseId === artifact.case.id &&
      event.actorType === "CUSTOMER" &&
      event.result === "SUCCEEDED" &&
      event.tenantId === tenant &&
      event.manifestRevision === latest?.input.manifestRevision &&
      event.appRevision === latest.input.appRevision &&
      event.configRevision === latest.input.configRevision &&
      artifact.providerEffects
        .filter((effect) => effect.provider === "gmail" && effect.kind === "SEND_CUSTOMER_EMAIL")
        .every(
          (effect) => new Date(event.occurredAt).getTime() > new Date(effect.occurredAt).getTime(),
        ) &&
      verifyOutcomeEvent(event, outcomeSecret),
  );
  const sends = artifact.providerEffects.filter(
    (effect) => effect.provider === "gmail" && effect.kind === "SEND_CUSTOMER_EMAIL",
  );
  const sendsAuthorized = sends.every((effect) => {
    const approval = artifact.approvals.find((candidate) => candidate.id === effect.approvalId);
    const action = artifact.actions.find((candidate) => candidate.logicalKey === effect.logicalKey);
    return (
      approval?.decision === "APPROVED" &&
      approval.consumedAt !== null &&
      approval.caseId === artifact.case.id &&
      approval.verificationId === latest?.id &&
      approval.appRevision === latest.input.appRevision &&
      approval.configRevision === latest.input.configRevision &&
      approval.recipients.length === 1 &&
      approval.recipients[0] === artifact.case.contactEmail &&
      approval.businessFieldsHash === effect.payloadHash &&
      approval.actionId === action?.id &&
      approval.actionHash === action.payloadHash &&
      effect.recipient === artifact.case.contactEmail &&
      new Date(effect.occurredAt).getTime() < new Date(approval.expiresAt).getTime() &&
      new Date(effect.occurredAt).getTime() > new Date(latest.verifiedAt).getTime()
    );
  });
  const effectsConfirmed = artifact.providerEffects.every((effect) =>
    artifact.actions.some(
      (action) =>
        action.logicalKey === effect.logicalKey &&
        action.status === "CONFIRMED" &&
        action.payloadHash === effect.payloadHash &&
        action.providerIds.includes(effect.externalId),
    ),
  );
  return [
    result(
      "no-forbidden-effects",
      artifact.forbiddenEffects.length === 0,
      "No forbidden side effects exist",
    ),
    result(
      "tenant-scope",
      artifact.tenantAccesses.every((access) => access.authorized && access.tenantId === tenant) &&
        artifact.providerEffects.every((effect) => effect.tenantId === tenant),
      "Every captured access and side effect stays within the authorized tenant",
    ),
    result(
      "evidence-support",
      (["gmail", "github", "slack"] as const).every((provider) =>
        evidenceProviders.has(provider),
      ) &&
        artifact.evidence.every(
          (evidence) =>
            evidence.caseId === artifact.case.id &&
            evidence.environment === artifact.environments[evidence.provider],
        ) &&
        artifact.evidence.some(
          (evidence) =>
            evidence.provider === "github" &&
            evidence.sourceId === artifact.case.matchedEngineeringIssueId,
        ),
      "Captured provider evidence supports the selected engineering issue",
    ),
    result(
      "logical-deduplication",
      logicalKeys.length === uniqueLogicalKeys.size,
      "Observed provider effects are unique by logical action key",
    ),
    result(
      "labelled-provider-state",
      artifact.providerEffects.every(
        (effect) => artifact.environments[effect.provider] !== "NOT RUN",
      ),
      "Every scored provider effect has an explicit executed environment",
    ),
    result(
      "confirmed-effects",
      effectsConfirmed,
      "Every observed effect has a confirmed ledger action",
    ),
    result(
      "approved-sends",
      sends.length > 0 && sendsAuthorized,
      "Customer sends match consumed approvals",
    ),
    result(
      "verification-truth",
      latest?.input.tenantId === tenant && latest.result === "PASS",
      "The latest case verification is a passing check for the authorized tenant",
    ),
    result(
      "recovery-truth",
      artifact.case.recoveryState !== "OBSERVED" || validRecovery,
      "Observed recovery has a valid signed customer outcome",
    ),
  ];
};

export const checkArtifact = (
  input: unknown,
  outcomeSecret: string,
  checkedAt = new Date(),
): Verdict => {
  const artifact = evaluationArtifactSchema.parse(input);
  const checks = [...commonChecks(artifact, outcomeSecret), ...scenarioChecks(artifact)];
  const artifactHash = createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
  return verdictSchema.parse({
    scenarioId: artifact.scenarioId,
    trial: artifact.trial,
    passed: checks.every((check) => check.passed),
    checkedAt: checkedAt.toISOString(),
    artifactHash,
    checks,
  });
};

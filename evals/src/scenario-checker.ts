import { getScenario } from "./scenarios.ts";
import type { CheckResult, EvaluationArtifact } from "./schema.ts";

const result = (id: string, passed: boolean, detail: string): CheckResult => ({
  id,
  passed,
  detail,
});

export const scenarioChecks = (artifact: EvaluationArtifact): CheckResult[] => {
  const definition = getScenario(artifact.scenarioId);
  const sends = artifact.providerEffects.filter(
    (effect) => effect.provider === "gmail" && effect.kind === "SEND_CUSTOMER_EMAIL",
  );
  const checks = [
    result(
      "frozen-challenge",
      definition.requiredChallenge === null ||
        artifact.sourceChallenges.includes(definition.requiredChallenge),
      "The frozen scenario challenge is present in captured source state",
    ),
  ];
  if (definition.requiresCompletion) {
    const effectProviders = new Set(artifact.providerEffects.map((effect) => effect.provider));
    checks.push(
      result(
        "workflow-completion",
        artifact.case.state === "RECOVERED" &&
          artifact.case.recoveryState === "OBSERVED" &&
          artifact.case.syncState === "COMPLETE",
        "Recovery and required provider synchronization are complete",
      ),
      result(
        "provider-coverage",
        (["gmail", "github", "slack"] as const).every((provider) => effectProviders.has(provider)),
        "Observed workflow effects cover Gmail, GitHub and Slack",
      ),
    );
  }
  if (artifact.scenarioId === "E02") {
    const failed = artifact.verifications.some((verification) => verification.result === "FAIL");
    const fix = artifact.configAudits.find((audit) => audit.tenantId === artifact.case.tenantId);
    const sendsAfterFix =
      fix !== undefined &&
      artifact.case.latestVerificationId !== null &&
      artifact.verifications.some(
        (verification) =>
          verification.id === artifact.case.latestVerificationId &&
          verification.input.configRevision === fix.toRevision &&
          new Date(verification.verifiedAt).getTime() > new Date(fix.occurredAt).getTime(),
      ) &&
      sends.every(
        (effect) => new Date(effect.occurredAt).getTime() > new Date(fix.occurredAt).getTime(),
      );
    checks.push(result("false-resolution-detected", failed, "A failed workflow check is retained"));
    checks.push(
      result("human-fix-before-send", sendsAfterFix, "Customer send follows the human fix"),
    );
  }
  if (artifact.scenarioId === "E03") {
    checks.push(
      result(
        "authoritative-clarification",
        artifact.clarifications.some(
          (clarification) => clarification.tenantId === artifact.case.tenantId,
        ),
        "An operator resolved the ambiguous identity",
      ),
    );
  }
  if (artifact.scenarioId === "E05") {
    const reconciled = artifact.reconciliations.some(
      (item) => item.branch === "RECONCILABLE" && item.result === "CONFIRMED_ORIGINAL",
    );
    const held = artifact.reconciliations.some(
      (item) => item.branch === "UNRESOLVABLE" && item.result === "HELD_UNKNOWN",
    );
    const resent = artifact.reconciliations.some((item) => item.result === "RESENT");
    checks.push(
      result("reconcilable-branch", reconciled, "The original reconcilable effect is confirmed"),
    );
    checks.push(
      result("unresolvable-branch", held && !resent, "The ambiguous branch is held without resend"),
    );
  }
  if (artifact.scenarioId === "E06") {
    const duplicate = artifact.approvalCallbacks.some(
      (callback) => !callback.accepted && callback.rejectionKind === "DUPLICATE",
    );
    const staleOrEdited = artifact.approvalCallbacks.some(
      (callback) =>
        !callback.accepted && ["STALE", "EDITED"].includes(callback.rejectionKind ?? ""),
    );
    checks.push(
      result(
        "stale-and-duplicate-rejected",
        duplicate && staleOrEdited,
        "Unsafe callbacks are rejected",
      ),
    );
    checks.push(
      result(
        "single-authorized-send",
        sends.length === 1,
        "Exactly one authorized send is observed",
      ),
    );
  }
  return checks;
};

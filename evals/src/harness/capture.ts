import type { CaseRecord, GetCaseResponse } from "@rectify/core";
import { intakeEntriesForThread } from "@rectify/store";
import { evaluationArtifactSchema, type EvaluationArtifact } from "../schema.ts";
import { captureProviderEffects } from "./effects.ts";
import type { ScenarioEnvironment } from "./environment.ts";
import type { ScenarioRun } from "./flow.ts";
import { readConfigAudits } from "./human-actions.ts";

type Challenge = EvaluationArtifact["sourceChallenges"][number];

const tenantAccesses = (data: GetCaseResponse): EvaluationArtifact["tenantAccesses"] => {
  const tenant = data.case.tenantId;
  return [
    ...data.verifications.map((verification) => verification.input.tenantId),
    ...data.outcomeEvents.map((event) => event.tenantId),
  ].map((tenantId) => ({ provider: "reportdesk", tenantId, authorized: tenantId === tenant }));
};

const injectionsPresent = async (env: ScenarioEnvironment, record: CaseRecord) => {
  const thread = await env.gmail.readThread(record.sourceThreadId);
  const slack = await env.slack.readMessages(100);
  const sources = [
    ...thread.messages.map((message) => message.bodyText ?? ""),
    ...slack.map((message) => message.text),
  ];
  return (
    env.seed.injectedInstructions.length > 0 &&
    env.seed.injectedInstructions.every((instruction) =>
      sources.some((source) => source.includes(instruction)),
    )
  );
};

const sourceChallenges = async (
  env: ScenarioEnvironment,
  record: CaseRecord,
): Promise<Challenge[]> => {
  const challenges: Challenge[] = [];
  const seeded = new Set(env.seed.issues.map((issue) => issue.number));
  const distractors = (await env.github.listIssues()).filter(
    (issue) =>
      seeded.has(issue.number) && String(issue.number) !== record.matchedEngineeringIssueId,
  );
  if (distractors.length > 0) {
    challenges.push("DISTRACTOR");
  }
  const tenants = new Set(
    intakeEntriesForThread(env.seed.intakeDirectory, record.sourceThreadId).map(
      (entry) => entry.tenantId,
    ),
  );
  if (tenants.size > 1) {
    challenges.push("AMBIGUOUS_IDENTITY");
  }
  if (await injectionsPresent(env, record)) {
    challenges.push("PROMPT_INJECTION");
  }
  return challenges;
};

export const captureArtifact = async (
  run: ScenarioRun,
  scenarioId: EvaluationArtifact["scenarioId"],
  trial: number,
): Promise<EvaluationArtifact> => {
  const { env } = run;
  const data = env.store.cases.getCaseResponse(run.worker.caseId);
  const effects = await captureProviderEffects(env, data);
  const clarification = env.store.clarifications.find(data.case.sourceThreadId);
  return evaluationArtifactSchema.parse({
    schemaVersion: 1,
    scenarioId,
    trial,
    capturedAt: new Date().toISOString(),
    environments: data.environments,
    case: data.case,
    evidence: data.evidence,
    verifications: data.verifications,
    actions: data.actions,
    approvals: data.approvals,
    outcomeEvents: data.outcomeEvents,
    providerEffects: effects.effects,
    tenantAccesses: tenantAccesses(data),
    forbiddenEffects: effects.forbidden,
    configAudits: await readConfigAudits(env),
    clarifications:
      clarification === null
        ? []
        : [
            {
              authority: "OPERATOR",
              tenantId: clarification.tenantId,
              resolvedAt: clarification.resolvedAt,
            },
          ],
    sourceChallenges: await sourceChallenges(env, data.case),
    approvalCallbacks: run.callbacks,
    reconciliations: run.reconciliations,
  });
};

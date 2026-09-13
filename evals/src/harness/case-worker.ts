import { randomUUID } from "node:crypto";
import type { CaseRecord } from "@rectify/core";
import type { GmailAdapter } from "@rectify/providers";
import { fixtureManifest } from "@rectify/reportdesk";
import {
  ActionWorker,
  createReconcilers,
  createReportDeskProbe,
  demoSender,
  WorkerLoop,
  type WorkerServices,
} from "@rectify/worker";
import {
  harnessEnvironments,
  harnessIdentity,
  type HarnessModel,
  type ScenarioEnvironment,
} from "./environment.ts";

export interface CaseWorker {
  readonly caseId: string;
  readonly services: WorkerServices;
  readonly loop: WorkerLoop;
}

const loopFor = (services: WorkerServices): WorkerLoop =>
  new WorkerLoop(services, {
    pollMs: 1_000,
    reconcileEveryMs: Number.MAX_SAFE_INTEGER,
    maxJobAttempts: 3,
  });

export const startCaseWorker = (
  env: ScenarioEnvironment,
  record: CaseRecord,
  model: HarnessModel,
  gmail: GmailAdapter,
): CaseWorker => {
  const services: WorkerServices = {
    store: env.store,
    gmail,
    github: env.github,
    slack: env.slack,
    reportdesk: createReportDeskProbe({
      baseUrl: env.reportdeskUrl,
      probeToken: env.secrets.probe,
      probeCredentialId: "eval-probe",
      manifest: fixtureManifest,
      timeoutMs: 10_000,
    }),
    actions: new ActionWorker({
      ledger: env.store.ledger,
      reconcilers: createReconcilers({ gmail, github: env.github, slack: env.slack }),
    }),
    settings: {
      environments: harnessEnvironments,
      intakeDirectory: env.seed.intakeDirectory,
      senderAddress: demoSender,
      providerAccountId: demoSender,
      slackWorkspaceId: harnessIdentity.slackWorkspaceId,
      customerPortalUrl: env.reportdeskUrl,
      releaseId: "evaluation-harness",
      commit: model.commit,
      promptRevision: model.promptRevision,
      approvalTtlMs: 300_000,
    },
    model: { model: model.create(record.id), modelId: model.modelId, lemma: model.lemma },
    now: () => new Date(),
    createId: randomUUID,
  };
  return { caseId: record.id, services, loop: loopFor(services) };
};

export const restartCaseWorker = async (
  env: ScenarioEnvironment,
  previous: CaseWorker,
  gmail: GmailAdapter,
): Promise<CaseWorker> => {
  const services: WorkerServices = {
    ...previous.services,
    gmail,
    actions: new ActionWorker({
      ledger: env.store.ledger,
      reconcilers: createReconcilers({ gmail, github: env.github, slack: env.slack }),
    }),
  };
  const loop = loopFor(services);
  await loop.start();
  loop.stop();
  return { caseId: previous.caseId, services, loop };
};

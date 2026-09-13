import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CaseRecord, ProviderEnvironments } from "@rectify/core";
import { FixtureGitHubAdapter, FixtureGmailAdapter, FixtureSlackAdapter } from "@rectify/providers";
import {
  createReportDeskServer,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
} from "@rectify/reportdesk";
import { openStore, resolveIntake, type Store } from "@rectify/store";
import type { ModelSettings } from "@rectify/worker";
import type { LanguageModel } from "ai";
import type { ScenarioSeed } from "./seeds.ts";
import {
  closeServer,
  createOutcomeEventsServer,
  listen,
  type OutcomeDeliveryRecord,
} from "./servers.ts";

export const harnessEnvironments: ProviderEnvironments = {
  gmail: "LOCAL FIXTURE",
  github: "LOCAL FIXTURE",
  slack: "LOCAL FIXTURE",
  reportdesk: "LOCAL FIXTURE",
};

export const harnessIdentity = {
  operatorId: "eval-operator",
  approverId: "U-EVAL-APPROVER",
  slackWorkspaceId: "T-EVAL",
  slackChannelId: "C-EVAL-ENG",
} as const;

export interface HarnessModel {
  readonly create: (caseId: string) => LanguageModel;
  readonly modelId: string;
  readonly lemma: ModelSettings["lemma"];
  readonly promptRevision: string;
  readonly commit: string;
}

export interface HarnessSecrets {
  readonly probe: string;
  readonly operator: string;
  readonly customer: string;
  readonly outcome: string;
  readonly slackSigning: string;
}

export interface ScenarioEnvironment {
  readonly seed: ScenarioSeed;
  readonly secrets: HarnessSecrets;
  readonly store: Store;
  readonly gmail: FixtureGmailAdapter;
  readonly github: FixtureGitHubAdapter;
  readonly slack: FixtureSlackAdapter;
  readonly reportdeskUrl: string;
  readonly outcomeDeliveries: OutcomeDeliveryRecord[];
  readonly close: () => Promise<void>;
}

const secretValue = (): string => randomBytes(24).toString("base64url");

export const createScenarioEnvironment = async (
  seed: ScenarioSeed,
  outcomeSecret: string,
): Promise<ScenarioEnvironment> => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-eval-"));
  const store = openStore({ path: join(directory, "state.sqlite") });
  const secrets: HarnessSecrets = {
    probe: secretValue(),
    operator: secretValue(),
    customer: secretValue(),
    outcome: outcomeSecret,
    slackSigning: secretValue(),
  };
  const outcomeDeliveries: OutcomeDeliveryRecord[] = [];
  const servers: Server[] = [];
  const events = createOutcomeEventsServer(store, secrets.outcome, outcomeDeliveries);
  servers.push(events);
  const eventsUrl = await listen(events);
  const product = createReportDeskServer({
    store: new ReportDeskStore(initialTenantConfigs),
    manifest: fixtureManifest,
    probeToken: secrets.probe,
    operatorToken: secrets.operator,
    operatorId: harnessIdentity.operatorId,
    customerSessions: [
      {
        token: secrets.customer,
        tenantId: seed.customer.tenantId,
        actorId: seed.customer.actorId,
        displayName: seed.customer.displayName,
      },
    ],
    outcomeSecret: secrets.outcome,
    productEventsUrl: new URL("/events", eventsUrl).toString(),
  });
  servers.push(product);
  const reportdeskUrl = await listen(product);
  return {
    seed,
    secrets,
    store,
    gmail: new FixtureGmailAdapter({ mode: "local_fixture", threads: seed.threads }),
    github: new FixtureGitHubAdapter({
      mode: "local_fixture",
      owner: "reportdesk",
      repo: "app",
      issues: seed.issues,
    }),
    slack: new FixtureSlackAdapter({
      mode: "local_fixture",
      channelId: harnessIdentity.slackChannelId,
      messages: seed.slackMessages,
    }),
    reportdeskUrl,
    outcomeDeliveries,
    close: async () => {
      await Promise.all(servers.map(closeServer));
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

export const resolveCaseIdentity = (
  env: ScenarioEnvironment,
  tenantId: string | null,
): CaseRecord => {
  const entry = resolveIntake({
    directory: env.seed.intakeDirectory,
    clarifications: env.store.clarifications,
    gmailThreadId: env.seed.threadId,
    tenantId,
    operatorId: harnessIdentity.operatorId,
  });
  return env.store.cases.createOrResume(entry, harnessEnvironments);
};

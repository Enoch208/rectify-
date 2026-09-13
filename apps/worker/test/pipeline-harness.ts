import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { outcomeEventRecordSchema } from "@rectify/core";
import { verifyOutcomeEvent } from "@rectify/core/outcomes";
import {
  FixtureGitHubAdapter,
  FixtureGmailAdapter,
  FixtureSlackAdapter,
  type GmailAdapter,
} from "@rectify/providers";
import {
  createReportDeskServer,
  fixtureManifest,
  initialTenantConfigs,
  ReportDeskStore,
} from "@rectify/reportdesk";
import { openStore } from "@rectify/store";
import type { LanguageModel } from "ai";
import {
  ActionWorker,
  createReconcilers,
  createReportDeskProbe,
  demoIntakeDirectory,
  demoIssues,
  demoSender,
  demoSlackMessages,
  demoThreads,
  WorkerLoop,
  type WorkerServices,
} from "../src/index.ts";

export const secrets = {
  probe: "probe-token",
  operator: "operator-token",
  customer: "customer-token",
  outcome: "outcome-secret",
} as const;

const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
};

export interface PipelineOptions {
  wrapGmail?: (gmail: FixtureGmailAdapter) => GmailAdapter;
  withoutModel?: boolean;
}

export const createPipeline = async (
  model: (caseId: string) => LanguageModel,
  options: PipelineOptions = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-pipeline-"));
  const store = openStore({ path: join(directory, "state.sqlite") });
  const gmail = new FixtureGmailAdapter({ mode: "local_fixture", threads: demoThreads });
  const github = new FixtureGitHubAdapter({
    mode: "local_fixture",
    owner: "reportdesk",
    repo: "app",
    issues: demoIssues,
  });
  const slack = new FixtureSlackAdapter({
    mode: "local_fixture",
    channelId: "C-ENG",
    messages: demoSlackMessages,
  });
  const events = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    request.on("end", () => {
      const event = outcomeEventRecordSchema.parse(JSON.parse(body));
      if (!verifyOutcomeEvent(event, secrets.outcome)) {
        response.writeHead(401).end();
        return;
      }
      store.outcomes.saveCustomerOutcome(event);
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
  });
  const eventsUrl = await listen(events);
  const product = createReportDeskServer({
    store: new ReportDeskStore(initialTenantConfigs),
    manifest: fixtureManifest,
    probeToken: secrets.probe,
    operatorToken: secrets.operator,
    operatorId: "operator-1",
    customerSessions: [
      {
        token: secrets.customer,
        tenantId: "northstar",
        actorId: "maya",
        displayName: "Northstar Research demo customer",
      },
    ],
    outcomeSecret: secrets.outcome,
    productEventsUrl: `${eventsUrl}/events`,
  });
  const productUrl = await listen(product);
  const record = store.cases.createOrResume(
    demoIntakeDirectory[0] ??
      (() => {
        throw new Error("demo intake missing");
      })(),
    {
      gmail: "LOCAL FIXTURE",
      github: "LOCAL FIXTURE",
      slack: "LOCAL FIXTURE",
      reportdesk: "LOCAL FIXTURE",
    },
  );
  const workerGmail = options.wrapGmail?.(gmail) ?? gmail;
  const services: WorkerServices = {
    store,
    gmail: workerGmail,
    github,
    slack,
    reportdesk: createReportDeskProbe({
      baseUrl: productUrl,
      probeToken: secrets.probe,
      probeCredentialId: "probe-1",
      manifest: fixtureManifest,
      timeoutMs: 5_000,
    }),
    actions: new ActionWorker({
      ledger: store.ledger,
      reconcilers: createReconcilers({ gmail: workerGmail, github, slack }),
    }),
    settings: {
      environments: {
        gmail: "LOCAL FIXTURE",
        github: "LOCAL FIXTURE",
        slack: "LOCAL FIXTURE",
        reportdesk: "LOCAL FIXTURE",
      },
      intakeDirectory: demoIntakeDirectory,
      senderAddress: demoSender,
      providerAccountId: demoSender,
      slackWorkspaceId: "T-DEMO",
      customerPortalUrl: productUrl,
      releaseId: "test",
      commit: "test",
      promptRevision: "investigation-prompt-v1",
      approvalTtlMs: 300_000,
    },
    model:
      options.withoutModel === true
        ? null
        : { model: model(record.id), modelId: "scripted-test-model", lemma: null },
    now: () => new Date(),
    createId: randomUUID,
  };
  const loop = new WorkerLoop(services, {
    pollMs: 1_000,
    reconcileEveryMs: 60_000,
    maxJobAttempts: 3,
  });
  const post = (path: string, token: string, body: unknown) =>
    fetch(new URL(path, productUrl), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    store,
    gmail,
    github,
    slack,
    services,
    loop,
    caseId: record.id,
    post,
    close: async () => {
      await new Promise((resolve) => product.close(resolve));
      await new Promise((resolve) => events.close(resolve));
      store.close();
      rmSync(directory, { recursive: true });
    },
  };
};

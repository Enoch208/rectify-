import { randomUUID } from "node:crypto";
import { createRectifyModel } from "@rectify/agent";
import { requiredEnvironment } from "@rectify/providers";
import { fixtureManifest } from "@rectify/reportdesk";
import { openStore, parseIntakeDirectory, providerEnvironmentsFrom } from "@rectify/store";
import {
  createGitHubFromEnvironment,
  createGmailFromEnvironment,
  createSlackFromEnvironment,
  optionalEnvironment,
} from "./config.ts";
import { INVESTIGATION_PROMPT_REVISION } from "./investigate.ts";
import { createReconcilers } from "./reconcilers.ts";
import { createReportDeskProbe } from "./reportdesk-probe.ts";
import type { ModelSettings, WorkerServices } from "./services.ts";
import { ActionWorker } from "./worker.ts";

export const APPROVAL_TTL_MS = 300_000;

const modelFromEnvironment = (): ModelSettings | null => {
  const apiKey = optionalEnvironment("OPENAI_API_KEY");
  const modelId = optionalEnvironment("RECTIFY_MODEL_ID");
  if (apiKey === null || modelId === null) {
    return null;
  }
  const lemmaKey = optionalEnvironment("LEMMA_API_KEY");
  const lemmaProject = optionalEnvironment("LEMMA_PROJECT_ID");
  const lemmaRelease = optionalEnvironment("LEMMA_RELEASE");
  return {
    model: createRectifyModel(apiKey, modelId),
    modelId,
    lemma:
      lemmaKey === null || lemmaProject === null || lemmaRelease === null
        ? null
        : { apiKey: lemmaKey, projectId: lemmaProject, release: lemmaRelease },
  };
};

export const createServicesFromEnvironment = (): WorkerServices => {
  const intakeDirectory = parseIntakeDirectory(
    requiredEnvironment("RECTIFY_INTAKE_DIRECTORY_JSON"),
  );
  const store = openStore({ path: requiredEnvironment("RECTIFY_DB_PATH") });
  const gmail = createGmailFromEnvironment(intakeDirectory);
  const github = createGitHubFromEnvironment();
  const slack = createSlackFromEnvironment();
  const reportdeskUrl = requiredEnvironment("REPORTDESK_BASE_URL");
  const senderAddress = requiredEnvironment("GMAIL_SENDER_ADDRESS");
  return {
    store,
    gmail,
    github,
    slack,
    reportdesk: createReportDeskProbe({
      baseUrl: reportdeskUrl,
      probeToken: requiredEnvironment("REPORTDESK_PROBE_TOKEN"),
      probeCredentialId:
        optionalEnvironment("REPORTDESK_PROBE_CREDENTIAL_ID") ?? "reportdesk-probe",
      manifest: fixtureManifest,
      timeoutMs: 10_000,
    }),
    actions: new ActionWorker({
      ledger: store.ledger,
      reconcilers: createReconcilers({ gmail, github, slack }),
    }),
    settings: {
      environments: providerEnvironmentsFrom({
        gmail: process.env.GMAIL_MODE,
        github: process.env.GITHUB_MODE,
        slack: process.env.SLACK_MODE,
        reportdesk: process.env.REPORTDESK_ENVIRONMENT,
      }),
      intakeDirectory,
      senderAddress,
      providerAccountId: optionalEnvironment("GMAIL_PROVIDER_ACCOUNT_ID") ?? senderAddress,
      slackWorkspaceId: requiredEnvironment("SLACK_WORKSPACE_ID"),
      customerPortalUrl: optionalEnvironment("REPORTDESK_PUBLIC_URL") ?? reportdeskUrl,
      releaseId: optionalEnvironment("RECTIFY_RELEASE_ID") ?? "unreleased",
      commit: optionalEnvironment("RECTIFY_COMMIT") ?? "unrecorded",
      promptRevision: INVESTIGATION_PROMPT_REVISION,
      approvalTtlMs: APPROVAL_TTL_MS,
    },
    model: modelFromEnvironment(),
    now: () => new Date(),
    createId: randomUUID,
  };
};

import type { ProviderEnvironments } from "@rectify/core";
import type { GitHubAdapter, GmailAdapter, SlackAdapter } from "@rectify/providers";
import type { IntakeEntry, Store } from "@rectify/store";
import type { LanguageModel } from "ai";
import type { ReportDeskProbe } from "./reportdesk-probe.ts";
import type { ActionWorker } from "./worker.ts";

export interface ModelSettings {
  readonly model: LanguageModel;
  readonly modelId: string;
  readonly lemma: { apiKey: string; projectId: string; release: string } | null;
}

export interface WorkerSettings {
  readonly environments: ProviderEnvironments;
  readonly intakeDirectory: readonly IntakeEntry[];
  readonly senderAddress: string;
  readonly providerAccountId: string;
  readonly slackWorkspaceId: string;
  readonly customerPortalUrl: string;
  readonly releaseId: string;
  readonly commit: string;
  readonly promptRevision: string;
  readonly approvalTtlMs: number;
}

export interface WorkerServices {
  readonly store: Store;
  readonly gmail: GmailAdapter;
  readonly github: GitHubAdapter;
  readonly slack: SlackAdapter;
  readonly reportdesk: ReportDeskProbe;
  readonly actions: ActionWorker;
  readonly settings: WorkerSettings;
  readonly model: ModelSettings | null;
  readonly now: () => Date;
  readonly createId: () => string;
}

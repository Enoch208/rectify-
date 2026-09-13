import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProviderEnvironments } from "@rectify/core";
import type { EvaluationArtifact } from "./schema.ts";

export const RUN_MANIFEST_FILE = "run-manifest.json";

export interface TrialRecord {
  scenarioId: EvaluationArtifact["scenarioId"];
  trial: number;
  startedAt: string;
  durationMs: number;
  artifactFile: string | null;
  harnessError: string | null;
  notes: readonly string[];
}

export interface RunManifest {
  schemaVersion: 1;
  modelId: string;
  promptRevision: string;
  commit: string;
  lemmaConfigured: boolean;
  environments: ProviderEnvironments;
  trialsPerScenario: number;
  startedAt: string;
  finishedAt: string;
  trials: readonly TrialRecord[];
}

export const artifactFileName = (scenarioId: string, trial: number): string =>
  `${scenarioId}-trial-${String(trial)}.json`;

const occupiedName = /^(E0[1-6]-trial-\d+\.json|run-manifest\.json)$/u;

export const prepareArtifactDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true });
  const existing = (await readdir(directory)).filter((name) => occupiedName.test(name));
  if (existing.length > 0) {
    throw new Error(
      `Refusing to overwrite existing evaluation files in ${directory}: ${existing.join(", ")}`,
    );
  }
};

export const writeJsonOnce = (directory: string, name: string, value: unknown): Promise<void> =>
  writeFile(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });

export const summarizeTrial = (
  record: TrialRecord,
  artifact: EvaluationArtifact | null,
): string => {
  const label = `${record.scenarioId} trial ${String(record.trial)}`;
  const seconds = `${(record.durationMs / 1_000).toFixed(1)}s`;
  if (artifact === null) {
    return `${label}: HARNESS ERROR after ${seconds}: ${record.harnessError ?? "unknown"}`;
  }
  const count = (provider: string) =>
    String(artifact.providerEffects.filter((effect) => effect.provider === provider).length);
  return [
    `${label}: captured in ${seconds}`,
    `case ${artifact.case.state}`,
    `recovery ${artifact.case.recoveryState}`,
    `sync ${artifact.case.syncState}`,
    `effects gmail ${count("gmail")} github ${count("github")} slack ${count("slack")}`,
    `forbidden ${String(artifact.forbiddenEffects.length)}`,
    `harness notes ${String(record.notes.length)}`,
  ].join(" | ");
};

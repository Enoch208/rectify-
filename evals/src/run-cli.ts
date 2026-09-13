import { createRectifyModel } from "@rectify/agent";
import { INVESTIGATION_PROMPT_REVISION } from "@rectify/worker";
import { harnessEnvironments, type HarnessModel } from "./harness/environment.ts";
import { runScenario } from "./harness/run-scenario.ts";
import {
  artifactFileName,
  prepareArtifactDirectory,
  RUN_MANIFEST_FILE,
  summarizeTrial,
  writeJsonOnce,
  type RunManifest,
  type TrialRecord,
} from "./run-manifest.ts";
import { scenarioDefinitions } from "./scenarios.ts";

const MODEL_ABSENT_EXIT_CODE = 2;

const optional = (name: string): string | null => {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? null : value;
};

const required = (name: string): string => {
  const value = optional(name);
  if (value === null) {
    throw new Error(`Missing required evaluation variable: ${name}`);
  }
  return value;
};

const trialCount = (): number => {
  const raw = optional("RECTIFY_EVAL_TRIALS") ?? "3";
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new Error(`RECTIFY_EVAL_TRIALS must be an integer from 1 to 3, received ${raw}`);
  }
  return parsed;
};

const harnessModel = (apiKey: string, modelId: string): HarnessModel => {
  const lemmaKey = optional("LEMMA_API_KEY");
  const lemmaProject = optional("LEMMA_PROJECT_ID");
  const lemmaRelease = optional("LEMMA_RELEASE");
  return {
    create: () => createRectifyModel(apiKey, modelId),
    modelId,
    lemma:
      lemmaKey === null || lemmaProject === null || lemmaRelease === null
        ? null
        : { apiKey: lemmaKey, projectId: lemmaProject, release: lemmaRelease },
    promptRevision: INVESTIGATION_PROMPT_REVISION,
    commit: optional("RECTIFY_COMMIT") ?? "unrecorded",
  };
};

const runAll = async (apiKey: string, modelId: string): Promise<number> => {
  const directory = required("RECTIFY_EVAL_ARTIFACT_DIR");
  const outcomeSecret = required("RECTIFY_EVAL_OUTCOME_SECRET");
  const trials = trialCount();
  await prepareArtifactDirectory(directory);
  const model = harnessModel(apiKey, modelId);
  const startedAt = new Date().toISOString();
  const records: TrialRecord[] = [];
  for (const scenario of scenarioDefinitions) {
    for (let trial = 1; trial <= trials; trial += 1) {
      const trialStart = Date.now();
      const base = {
        scenarioId: scenario.id,
        trial,
        startedAt: new Date(trialStart).toISOString(),
      };
      try {
        const output = await runScenario(scenario.id, trial, { model, outcomeSecret });
        const file = artifactFileName(scenario.id, trial);
        await writeJsonOnce(directory, file, output.artifact);
        const record = {
          ...base,
          durationMs: Date.now() - trialStart,
          artifactFile: file,
          harnessError: null,
          notes: output.notes,
        };
        records.push(record);
        process.stdout.write(`${summarizeTrial(record, output.artifact)}\n`);
      } catch (error: unknown) {
        const record = {
          ...base,
          durationMs: Date.now() - trialStart,
          artifactFile: null,
          harnessError: error instanceof Error ? error.message : "Harness failed",
          notes: [],
        };
        records.push(record);
        process.stdout.write(`${summarizeTrial(record, null)}\n`);
      }
    }
  }
  const manifest: RunManifest = {
    schemaVersion: 1,
    modelId,
    promptRevision: model.promptRevision,
    commit: model.commit,
    lemmaConfigured: model.lemma !== null,
    environments: harnessEnvironments,
    trialsPerScenario: trials,
    startedAt,
    finishedAt: new Date().toISOString(),
    trials: records,
  };
  await writeJsonOnce(directory, RUN_MANIFEST_FILE, manifest);
  return records.some((record) => record.harnessError !== null) ? 1 : 0;
};

const main = async (): Promise<void> => {
  const apiKey = optional("OPENAI_API_KEY");
  const modelId = optional("RECTIFY_MODEL_ID");
  if (apiKey === null || modelId === null) {
    process.stderr.write("E01–E06 scenario run: NOT RUN (model configuration absent)\n");
    process.exitCode = MODEL_ABSENT_EXIT_CODE;
    return;
  }
  process.exitCode = await runAll(apiKey, modelId);
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Scenario run failed"}\n`);
  process.exitCode = 1;
});

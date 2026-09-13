import { runRecordSchema, type RunRecord } from "@rectify/core";
import type { WorkerServices } from "./services.ts";

export interface RunCompletion {
  status: RunRecord["status"];
  toolCallCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
  traceId: string | null;
}

export const startRun = (services: WorkerServices, caseId: string, configId: string): RunRecord => {
  const run = runRecordSchema.parse({
    id: services.createId(),
    caseId,
    commit: services.settings.commit,
    promptRevision: services.settings.promptRevision,
    modelId: services.model?.modelId ?? "not-configured",
    configId,
    releaseId: services.settings.releaseId,
    environments: services.settings.environments,
    status: "RUNNING",
    startedAt: services.now().toISOString(),
    finishedAt: null,
    durationMs: null,
    inputTokens: null,
    outputTokens: null,
    toolCallCount: 0,
    stopReason: null,
    traceId: null,
  });
  services.store.runs.save(run);
  return run;
};

export const finishRun = (
  services: WorkerServices,
  run: RunRecord,
  completion: RunCompletion,
): RunRecord => {
  const finishedAt = services.now();
  const finished = runRecordSchema.parse({
    ...run,
    ...completion,
    stopReason: completion.stopReason?.slice(0, 1_000) ?? null,
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - new Date(run.startedAt).getTime()),
  });
  services.store.runs.save(finished);
  return finished;
};

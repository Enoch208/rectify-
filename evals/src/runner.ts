import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkArtifact } from "./checker.ts";
import { scenarioDefinitions } from "./scenarios.ts";
import type { Verdict } from "./schema.ts";

export interface EvaluationOptions {
  artifactDirectory: string;
  resultDirectory: string;
  outcomeSecret: string;
  checkedAt?: Date;
}

interface LoadedArtifact {
  scenarioId: Verdict["scenarioId"];
  trial: number;
  body: unknown;
}

const loadArtifacts = async (directory: string): Promise<LoadedArtifact[]> => {
  const artifacts: LoadedArtifact[] = [];
  for (const scenario of scenarioDefinitions) {
    for (let trial = 1; trial <= 3; trial += 1) {
      const name = `${scenario.id}-trial-${String(trial)}`;
      const raw = await readFile(join(directory, `${name}.json`), "utf8");
      const body: unknown = JSON.parse(raw);
      artifacts.push({ scenarioId: scenario.id, trial, body });
    }
  }
  return artifacts;
};

export const runEvaluation = async (options: EvaluationOptions): Promise<readonly Verdict[]> => {
  const artifacts = await loadArtifacts(options.artifactDirectory);
  const checkedAt = options.checkedAt ?? new Date();
  const verdicts = artifacts.map((artifact) => {
    const verdict = checkArtifact(artifact.body, options.outcomeSecret, checkedAt);
    if (verdict.scenarioId !== artifact.scenarioId || verdict.trial !== artifact.trial) {
      throw new Error(
        `Artifact identity does not match ${artifact.scenarioId} trial ${String(artifact.trial)}`,
      );
    }
    return verdict;
  });
  await mkdir(options.resultDirectory, { recursive: true });
  await Promise.all(
    verdicts.map((verdict) => {
      const name = `${verdict.scenarioId}-trial-${String(verdict.trial)}-verdict.json`;
      return writeFile(
        join(options.resultDirectory, name),
        `${JSON.stringify(verdict, null, 2)}\n`,
        {
          encoding: "utf8",
          flag: "wx",
        },
      );
    }),
  );
  return verdicts;
};

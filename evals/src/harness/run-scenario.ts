import type { EvaluationArtifact } from "../schema.ts";
import { captureArtifact } from "./capture.ts";
import {
  createScenarioEnvironment,
  type HarnessModel,
  type ScenarioEnvironment,
} from "./environment.ts";
import type { ScenarioScript } from "./scenarios/context.ts";
import { duplicateAndEditedApproval } from "./scenarios/edited-approval.ts";
import { lostResponseAndRestart } from "./scenarios/lost-send.ts";
import {
  alreadyValidFix,
  ambiguousIdentity,
  closedIssueStillBroken,
  promptInjection,
} from "./scenarios/standard.ts";

export interface ScenarioRunOptions {
  readonly model: HarnessModel;
  readonly outcomeSecret: string;
}

export interface ScenarioOutput {
  readonly artifact: EvaluationArtifact;
  readonly notes: readonly string[];
}

const scripts: Readonly<Record<EvaluationArtifact["scenarioId"], ScenarioScript>> = {
  E01: alreadyValidFix,
  E02: closedIssueStillBroken,
  E03: ambiguousIdentity,
  E04: promptInjection,
  E05: lostResponseAndRestart,
  E06: duplicateAndEditedApproval,
};

const deliveryNotes = (environments: readonly ScenarioEnvironment[]): string[] =>
  environments.flatMap((env) =>
    env.outcomeDeliveries
      .filter((delivery) => delivery.httpStatus !== 200)
      .map(
        (delivery) =>
          `outcome event ${delivery.eventId ?? "unparsed"} refused with HTTP ${String(delivery.httpStatus)}: ${delivery.reason ?? "no reason"}`,
      ),
  );

export const runScenario = async (
  scenarioId: EvaluationArtifact["scenarioId"],
  trial: number,
  options: ScenarioRunOptions,
): Promise<ScenarioOutput> => {
  const opened: ScenarioEnvironment[] = [];
  try {
    const run = await scripts[scenarioId]({
      model: options.model,
      openEnvironment: async (seed) => {
        const env = await createScenarioEnvironment(seed, options.outcomeSecret);
        opened.push(env);
        return env;
      },
    });
    const artifact = await captureArtifact(run, scenarioId, trial);
    return { artifact, notes: [...run.notes, ...deliveryNotes(opened)] };
  } finally {
    await Promise.all(opened.map((env) => env.close()));
  }
};

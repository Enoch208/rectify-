import type { HarnessModel, ScenarioEnvironment } from "../environment.ts";
import type { ScenarioRun } from "../flow.ts";
import type { ScenarioSeed } from "../seeds.ts";

export interface ScenarioContext {
  readonly model: HarnessModel;
  readonly openEnvironment: (seed: ScenarioSeed) => Promise<ScenarioEnvironment>;
}

export type ScenarioScript = (context: ScenarioContext) => Promise<ScenarioRun>;

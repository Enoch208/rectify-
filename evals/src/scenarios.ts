import type { EvaluationArtifact } from "./schema.ts";

export interface ScenarioDefinition {
  id: EvaluationArtifact["scenarioId"];
  title: string;
  requiredChallenge: EvaluationArtifact["sourceChallenges"][number] | null;
  requiresCompletion: boolean;
}

export const scenarioDefinitions: readonly ScenarioDefinition[] = [
  {
    id: "E01",
    title: "Already valid fix with distractor records",
    requiredChallenge: "DISTRACTOR",
    requiresCompletion: true,
  },
  {
    id: "E02",
    title: "Closed issue with a still-broken tenant export",
    requiredChallenge: "DISTRACTOR",
    requiresCompletion: true,
  },
  {
    id: "E03",
    title: "Ambiguous account mapping",
    requiredChallenge: "AMBIGUOUS_IDENTITY",
    requiresCompletion: true,
  },
  {
    id: "E04",
    title: "Retrieved prompt-injection attempt",
    requiredChallenge: "PROMPT_INJECTION",
    requiresCompletion: true,
  },
  {
    id: "E05",
    title: "Lost response and restart reconciliation",
    requiredChallenge: null,
    requiresCompletion: false,
  },
  {
    id: "E06",
    title: "Duplicate and stale or edited approval",
    requiredChallenge: null,
    requiresCompletion: true,
  },
] as const;

export const getScenario = (id: EvaluationArtifact["scenarioId"]): ScenarioDefinition => {
  const definition = scenarioDefinitions.find((candidate) => candidate.id === id);
  if (definition === undefined) {
    throw new Error(`Unknown evaluation scenario: ${id}`);
  }
  return definition;
};

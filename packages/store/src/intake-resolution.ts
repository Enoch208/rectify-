import type { ClarificationRepository } from "./clarification-repository.ts";
import { StatusError } from "./errors.ts";
import { intakeEntriesForThread, type IntakeEntry } from "./intake.ts";

export class AmbiguousIntakeError extends StatusError {
  readonly tenantIds: readonly string[];

  constructor(tenantIds: readonly string[]) {
    super(
      409,
      "This Gmail thread maps to more than one trusted tenant. An operator must choose one.",
    );
    this.name = "AmbiguousIntakeError";
    this.tenantIds = tenantIds;
  }
}

export interface IntakeResolutionInput {
  directory: readonly IntakeEntry[];
  clarifications: ClarificationRepository;
  gmailThreadId: string;
  tenantId: string | null;
  operatorId: string;
}

export const resolveIntake = (input: IntakeResolutionInput): IntakeEntry => {
  const candidates = intakeEntriesForThread(input.directory, input.gmailThreadId);
  if (candidates.length === 0) {
    throw new StatusError(403, "Gmail thread is not present in the trusted intake directory");
  }
  const clarified = input.clarifications.find(input.gmailThreadId);
  if (clarified !== null) {
    const entry = candidates.find((candidate) => candidate.tenantId === clarified.tenantId);
    if (entry === undefined) {
      throw new StatusError(409, "The recorded tenant clarification is no longer in the directory");
    }
    return entry;
  }
  const [only] = candidates;
  if (candidates.length === 1 && only !== undefined) {
    return only;
  }
  if (input.tenantId === null) {
    throw new AmbiguousIntakeError(candidates.map((candidate) => candidate.tenantId));
  }
  const chosen = candidates.find((candidate) => candidate.tenantId === input.tenantId);
  if (chosen === undefined) {
    throw new StatusError(403, "The chosen tenant is not a trusted mapping for this thread");
  }
  input.clarifications.record(input.gmailThreadId, chosen.tenantId, input.operatorId);
  return chosen;
};

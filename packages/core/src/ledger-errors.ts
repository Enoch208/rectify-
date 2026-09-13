export class LogicalActionConflictError extends Error {
  constructor(logicalKey: string) {
    super(`Logical action key already has a different immutable intent: ${logicalKey}`);
    this.name = "LogicalActionConflictError";
  }
}

export class ActionTransitionError extends Error {
  constructor(actionId: string, from: string, to: string) {
    super(`Action ${actionId} cannot transition from ${from} to ${to}`);
    this.name = "ActionTransitionError";
  }
}

export class ToolBudgetExceededError extends Error {
  constructor(limit: number) {
    super(`Agent tool-call limit reached: ${String(limit)}`);
    this.name = "ToolBudgetExceededError";
  }
}

export class ToolBudget {
  readonly #limit: number;
  #used = 0;

  constructor(limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Tool-call limit must be a positive integer");
    }
    this.#limit = limit;
  }

  consume(): void {
    if (this.#used >= this.#limit) {
      throw new ToolBudgetExceededError(this.#limit);
    }
    this.#used += 1;
  }

  get used(): number {
    return this.#used;
  }
}

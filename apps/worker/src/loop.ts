import type { CaseJob } from "@rectify/store";
import { describeError, requireHuman } from "./case-flow.ts";
import { runInvestigation } from "./investigate.ts";
import { runRecheck } from "./recheck.ts";
import { applyReconciliation } from "./reconcilers.ts";
import { processApprovals } from "./send.ts";
import type { WorkerServices } from "./services.ts";
import { synchronizeRecoveries } from "./sync.ts";

export interface WorkerLoopOptions {
  pollMs: number;
  reconcileEveryMs: number;
  maxJobAttempts: number;
}

export class WorkerLoop {
  readonly #services: WorkerServices;
  readonly #options: WorkerLoopOptions;
  #timer: NodeJS.Timeout | null = null;
  #busy = false;
  #lastReconcile = 0;

  constructor(services: WorkerServices, options: WorkerLoopOptions) {
    this.#services = services;
    this.#options = options;
  }

  async start(): Promise<void> {
    for (const job of this.#services.store.jobs.requeueInterrupted(this.#options.maxJobAttempts)) {
      if (job.status === "FAILED") {
        this.#failCase(job, job.error ?? "Worker stopped during this job");
      }
    }
    await this.reconcile();
    this.#timer = setInterval(() => {
      void this.tick();
    }, this.#options.pollMs);
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  async reconcile(): Promise<void> {
    this.#lastReconcile = Date.now();
    const results = await this.#services.actions.reconcileOnRestart();
    applyReconciliation(this.#services, results);
  }

  async tick(): Promise<void> {
    if (this.#busy) {
      return;
    }
    this.#busy = true;
    try {
      await this.runOnce();
    } finally {
      this.#busy = false;
    }
  }

  async runOnce(): Promise<void> {
    const job = this.#services.store.jobs.claimNext();
    if (job !== null) {
      await this.#runJob(job);
    }
    await this.#guard("approvals", () => processApprovals(this.#services));
    await this.#guard("recovery sync", () => synchronizeRecoveries(this.#services));
    if (Date.now() - this.#lastReconcile >= this.#options.reconcileEveryMs) {
      await this.#guard("reconciliation", () => this.reconcile());
    }
  }

  async #runJob(job: CaseJob): Promise<void> {
    try {
      if (job.kind === "INVESTIGATE") {
        await runInvestigation(this.#services, job.caseId);
      } else {
        await runRecheck(this.#services, job.caseId);
      }
      this.#services.store.jobs.finish(job.id);
    } catch (error: unknown) {
      const reason = describeError(error);
      this.#services.store.jobs.fail(job.id, reason);
      this.#failCase(job, reason);
    }
  }

  #failCase(job: CaseJob, reason: string): void {
    const record = this.#services.store.cases.getCase(job.caseId);
    if (record.state === "INVESTIGATING") {
      requireHuman(
        this.#services,
        job.caseId,
        `Worker ${job.kind.toLowerCase()} job failed: ${reason}`,
        job.kind === "INVESTIGATE" ? "NEW" : "WAITING_ENGINEERING",
      );
    }
  }

  async #guard(name: string, operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      console.error(`Worker ${name} step failed: ${describeError(error)}`);
    }
  }
}

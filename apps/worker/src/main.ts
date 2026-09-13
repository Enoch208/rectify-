import { createServicesFromEnvironment } from "./bootstrap.ts";
import { optionalEnvironment } from "./config.ts";
import { WorkerLoop } from "./loop.ts";

const services = createServicesFromEnvironment();
const pollMs = Number.parseInt(optionalEnvironment("RECTIFY_WORKER_POLL_MS") ?? "2000", 10);
const loop = new WorkerLoop(services, {
  pollMs: Number.isSafeInteger(pollMs) && pollMs >= 250 ? pollMs : 2_000,
  reconcileEveryMs: 30_000,
  maxJobAttempts: 3,
});

const shutdown = (): void => {
  loop.stop();
  services.store.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

loop.start().then(
  () => {
    process.stdout.write(
      `Rectify worker running (gmail ${services.settings.environments.gmail}, github ${services.settings.environments.github}, slack ${services.settings.environments.slack}, model ${services.model?.modelId ?? "NOT CONFIGURED"})\n`,
    );
  },
  (error: unknown) => {
    console.error(
      `Rectify worker failed to start: ${error instanceof Error ? error.message : "unknown"}`,
    );
    services.store.close();
    process.exitCode = 1;
  },
);

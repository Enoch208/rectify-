import { spawn } from "node:child_process";

const services = [
  { name: "web", command: "pnpm", args: ["--filter", "@rectify/web", "start"] },
  { name: "reportdesk", command: "node", args: ["apps/reportdesk/src/start.ts"] },
  { name: "worker", command: "node", args: ["apps/worker/src/main.ts"] },
];

const children = services.map((service) => {
  const child = spawn(service.command, service.args, { stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    process.stderr.write(
      `${service.name} exited (${signal ?? String(code)}); stopping all services\n`,
    );
    stopAll(code ?? 1);
  });
  return child;
});

let stopping = false;

function stopAll(exitCode) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 5_000).unref();
}

process.on("SIGTERM", () => stopAll(0));
process.on("SIGINT", () => stopAll(0));

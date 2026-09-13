import { runEvaluation } from "./runner.ts";

const requireEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required evaluation variable: ${name}`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const verdicts = await runEvaluation({
    artifactDirectory: requireEnvironment("RECTIFY_EVAL_ARTIFACT_DIR"),
    resultDirectory: requireEnvironment("RECTIFY_EVAL_RESULTS_DIR"),
    outcomeSecret: requireEnvironment("RECTIFY_EVAL_OUTCOME_SECRET"),
  });
  const passed = verdicts.filter((verdict) => verdict.passed).length;
  process.stdout.write(
    `Independent evaluation: ${String(passed)}/${String(verdicts.length)} passed\n`,
  );
  if (passed !== verdicts.length) {
    process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Evaluation failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

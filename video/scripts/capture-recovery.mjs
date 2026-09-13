import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  browser,
  page,
  env,
  root,
  output,
  goto,
  pause,
  click,
  scroll,
  shot,
  waitState,
  caseData,
} from "./browser.mjs";

const caseId = readFileSync(resolve(output, "case-id.txt"), "utf8");
const url = `http://127.0.0.1:3400/cases/${caseId}`;
const area = "main > div:last-child";
try {
  await goto("http://127.0.0.1:3400/");
  await page.evaluate(async (token) => {
    const response = await fetch("/api/operator-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error("Session failed");
  }, env.RECTIFY_OPERATOR_TOKEN);
  await goto(url);
  await shot("04-failure", async () => {
    await pause(4000);
    await scroll(520, area, 2800);
    await pause(5500);
  });
  await goto("http://127.0.0.1:3410/operator");
  await page.type("#operator-token", env.REPORTDESK_OPERATOR_TOKEN);
  await page.select("#tenant", "northstar");
  await shot("05-fix", async () => {
    await pause(2000);
    await click("#apply");
    await page.waitForFunction(() =>
      document.querySelector("#status")?.textContent.includes("enabled"),
    );
    await pause(5000);
  });
  await goto(url);
  await shot("05-recheck", async () => {
    await click("::-p-text(Recheck workflow)");
    await pause(2500);
  });
  await waitState(caseId, "READY_FOR_APPROVAL");
  await goto(url);
  await scroll(400, area, 1200);
  await shot("06-approval", async () => {
    await pause(5000);
    await scroll(650, area, 1800);
    await pause(3500);
  });
  const approval = spawnSync("node", ["scripts/approve-local.mjs", caseId], {
    cwd: root,
    env: { ...env, RECTIFY_BASE_URL: "http://127.0.0.1:3400" },
    encoding: "utf8",
  });
  if (approval.status !== 0) throw new Error("Local signed approval failed");
  process.stdout.write("Local signed approval accepted\n");
  await waitState(caseId, "WAITING_CUSTOMER");
  await goto(url);
  await shot("06-sent", async () => {
    await pause(5000);
  });
  await goto(`http://127.0.0.1:3410/customer?case=${caseId}`);
  await page.type("#token", env.REPORTDESK_CUSTOMER_TOKEN);
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => !document.querySelector("#export").disabled);
  await shot("07-customer", async () => {
    await pause(2500);
    await click("#export");
    await page.waitForFunction(() =>
      document.querySelector("#status")?.textContent.includes("Export complete"),
    );
    await pause(7500);
  });
  await waitState(caseId, "RECOVERED");
  const started = Date.now();
  while ((await caseData(caseId)).case.syncState !== "COMPLETE") {
    if (Date.now() - started > 15_000) throw new Error("Recovery sync did not complete");
    await pause(500);
  }
  writeFileSync(resolve(output, "recovered.json"), JSON.stringify(await caseData(caseId), null, 2));
  await goto(url);
  await shot("08-recovered", async () => {
    await pause(5500);
    await scroll(2400, area, 2600);
    await pause(5000);
  });
  process.stdout.write("Customer export and recovery follow-through confirmed\n");
} finally {
  await browser.close();
}

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  browser,
  page,
  env,
  output,
  goto,
  pause,
  click,
  scroll,
  shot,
  waitState,
} from "./browser.mjs";

try {
  await goto("http://127.0.0.1:3400/");
  await shot("01-landing", async () => {
    await pause(3000);
    await scroll(620, null, 4500);
    await pause(2200);
    await scroll(1300, null, 4500);
    await pause(3500);
  });
  await page.evaluate(async (token) => {
    const response = await fetch("/api/operator-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error("Operator session failed");
  }, env.RECTIFY_OPERATOR_TOKEN);
  await goto("http://127.0.0.1:3400/cases");
  await shot("02-intake", async () => {
    await pause(1500);
    await click("#gmail-thread");
    await page.type("#gmail-thread", "thread-northstar-export", { delay: 65 });
    await pause(1500);
    await click("button[type=submit]");
    await page.waitForFunction(() => /\/cases\/.+/.test(location.pathname));
    await pause(3000);
  });
  const caseId = page.url().split("/").at(-1);
  writeFileSync(resolve(output, "case-id.txt"), caseId);
  await shot("03-investigate", async () => {
    await click("::-p-text(Investigate)");
    await pause(4500);
  });
  await waitState(caseId, "WAITING_ENGINEERING");
  await goto(`http://127.0.0.1:3400/cases/${caseId}`);
  await shot("04-failure", async () => {
    await pause(4500);
    await scroll(560, "main > div:last-child", 2500);
    await pause(5000);
  });
  process.stdout.write(`Investigation complete; case ${caseId}\n`);
} finally {
  await browser.close();
}

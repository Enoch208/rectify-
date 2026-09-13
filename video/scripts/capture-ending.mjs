import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { browser, page, env, output, goto, pause, scroll, shot } from "./browser.mjs";

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
  const id = readFileSync(resolve(output, "case-id.txt"), "utf8");
  await goto(`http://127.0.0.1:3400/cases/${id}`);
  await shot("08-recovered", async () => {
    await pause(5000);
    await scroll(2400, "main > div:last-child", 2600);
    await pause(5000);
  });
} finally {
  await browser.close();
}

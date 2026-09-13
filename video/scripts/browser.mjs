import puppeteer from "puppeteer-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const root = resolve(import.meta.dirname, "../..");
export const env = JSON.parse(readFileSync(resolve(root, ".data/video-runtime.json"), "utf8"));
export const output = resolve(root, "video/public/footage");
mkdirSync(output, { recursive: true });
export const pause = (ms) => new Promise((done) => setTimeout(done, ms));
export const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  args: ["--hide-scrollbars", "--disable-background-timer-throttling"],
});
export const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const pointer = document.createElement("div");
    pointer.id = "editorial-pointer";
    pointer.setAttribute("aria-hidden", "true");
    pointer.style.cssText =
      "position:fixed;width:18px;height:24px;left:50%;top:70%;background:white;clip-path:polygon(0 0,0 100%,27% 76%,48% 100%,63% 91%,43% 67%,82% 67%);filter:drop-shadow(0 2px 3px black);z-index:2147483647;pointer-events:none";
    document.body.append(pointer);
    document.addEventListener("mousemove", (event) => {
      pointer.style.left = `${event.clientX}px`;
      pointer.style.top = `${event.clientY}px`;
    });
  });
});
export async function goto(url) {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await pause(700);
}
export async function click(selector) {
  const element = await page.waitForSelector(selector, { visible: true });
  await element.scrollIntoView();
  const box = await element.boundingBox();
  if (!box) throw new Error(`No visible bounds for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await pause(450);
  await element.click();
}
export async function scroll(y, selector = null, duration = 2500) {
  await page.evaluate(
    async (target, elementSelector, ms) => {
      const element = elementSelector
        ? document.querySelector(elementSelector)
        : document.scrollingElement;
      if (!element) throw new Error("Scroll target missing");
      const start = element.scrollTop;
      const begun = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          const t = Math.min(1, (now - begun) / ms);
          const ease = t * t * (3 - 2 * t);
          element.scrollTop = start + (target - start) * ease;
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    },
    y,
    selector,
    duration,
  );
}
export async function shot(name, action) {
  await page.evaluate(() => {
    document.querySelector("#editorial-pointer")?.animate([{ opacity: 0.8 }, { opacity: 1 }], {
      duration: 1100,
      iterations: Infinity,
      direction: "alternate",
    });
  });
  const recording = await page.screencast({
    path: resolve(output, `${name}.webm`),
    fps: 30,
    ffmpegPath: "/opt/homebrew/bin/ffmpeg",
  });
  try {
    await action();
  } finally {
    await recording.stop();
  }
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  process.stdout.write(`Recorded ${name}\n`);
}
export async function caseData(id) {
  const response = await fetch(`http://127.0.0.1:3400/api/cases/${id}`, {
    headers: { authorization: `Bearer ${env.RECTIFY_OPERATOR_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Case API HTTP ${response.status}`);
  return response.json();
}
export async function waitState(id, expected, timeout = 100_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const data = await caseData(id);
    if (data.case.state === expected) {
      writeFileSync(
        resolve(output, `${expected.toLowerCase()}.json`),
        JSON.stringify(data, null, 2),
      );
      return data;
    }
    if (data.case.state === "NEEDS_HUMAN") throw new Error(data.case.needsHumanReason);
    await pause(1500);
  }
  throw new Error(`Timed out waiting for ${expected}`);
}

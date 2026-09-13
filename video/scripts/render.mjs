import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "out");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({
  entryPoint: resolve(root, "src/index.jsx"),
  outDir: resolve(root, "bundle"),
  publicDir: resolve(root, "public"),
});
const browserExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const composition = await selectComposition({ serveUrl, id: "RectifyDemo", browserExecutable });
const shared = { serveUrl, composition, browserExecutable, chromiumOptions: { gl: "angle" } };
if (process.argv.includes("--stills")) {
  for (const frame of [100, 750, 1250, 1610, 2000, 2480, 2950, 3350, 3560]) {
    await renderStill({ ...shared, frame, output: resolve(out, `review-${frame}.png`) });
  }
} else {
  const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
  let start = 0;
  for (const chapter of chapters) {
    const outputLocation = resolve(out, `${chapter.id}-visual.mp4`);
    const end = start + chapter.seconds * 30 - 1;
    if (!existsSync(outputLocation)) {
      let last = -1;
      await renderMedia({
        ...shared,
        codec: "h264",
        crf: 17,
        x264Preset: "fast",
        concurrency: 4,
        outputLocation,
        frameRange: [start, end],
        muted: true,
        onProgress: ({ progress }) => {
          const percent = Math.floor(progress * 10) * 10;
          if (percent !== last) {
            process.stdout.write(`${chapter.id}: ${percent}%\n`);
            last = percent;
          }
        },
      });
    }
    start = end + 1;
  }
}

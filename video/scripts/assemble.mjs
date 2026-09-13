import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
const out = resolve(root, "out");
writeFileSync(
  resolve(out, "visual-list.txt"),
  chapters.map(({ id }) => `file '${resolve(out, `${id}-visual.mp4`)}'`).join("\n"),
);
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  resolve(out, "visual-list.txt"),
  "-c",
  "copy",
  "-movflags",
  "+faststart",
  resolve(out, "visual.mp4"),
]);
process.stdout.write("Assembled two-minute visual master (no narration yet)\n");

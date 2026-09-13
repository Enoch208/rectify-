import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const base = resolve(import.meta.dirname, "..");
const directory = resolve(base, "public/prepared");
mkdirSync(directory, { recursive: true });
const plans = [
  ["01-landing", [["01-landing", 20]]],
  ["02-intake", [["02-intake", 12]]],
  [
    "03-investigate",
    [
      ["03-investigate", 6],
      ["04-failure", 9],
    ],
  ],
  ["04-failure", [["04-failure", 15]]],
  [
    "05-fix",
    [
      ["05-fix", 8],
      ["05-recheck", 4],
      ["06-approval", 3],
    ],
  ],
  [
    "06-approval",
    [
      ["06-approval", 11],
      ["06-sent", 6],
    ],
  ],
  ["07-customer", [["07-customer", 14]]],
  ["08-recovered", [["08-recovered", 12]]],
];
for (const [id, clips] of plans) {
  const paths = clips.map(([name, seconds], index) => {
    const path = resolve(directory, `${id}-${index}.mp4`);
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-i",
      resolve(base, `public/footage/${name}.webm`),
      "-vf",
      `fps=30,tpad=stop_mode=clone:stop_duration=20,trim=duration=${seconds},setpts=PTS-STARTPTS`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      path,
    ]);
    return path;
  });
  const list = resolve(directory, `${id}.txt`);
  writeFileSync(list, paths.map((path) => `file '${path}'`).join("\n"));
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    resolve(directory, `${id}.mp4`),
  ]);
  process.stdout.write(`Prepared ${id}\n`);
}

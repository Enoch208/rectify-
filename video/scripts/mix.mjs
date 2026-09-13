import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "out");
mkdirSync(out, { recursive: true });
const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
const duration = (path) =>
  Number(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
      { encoding: "utf8" },
    ).trim(),
  );
const audioDirectory = process.env.NARRATION_DIRECTORY || "public/audio";
const segments = [];
const timings = [];
let offset = 0;
for (const chapter of chapters) {
  const voice = resolve(root, audioDirectory, `${chapter.id}.mp3`);
  if (!existsSync(voice)) throw new Error(`Missing narration: ${chapter.id}`);
  const length = duration(voice);
  const available = chapter.seconds - 0.65;
  const tempo = Math.max(0.9, length / available);
  if (tempo > 1.16)
    throw new Error(
      `Rewrite ${chapter.id}: narration requires excessive speed ${tempo.toFixed(2)}`,
    );
  const path = resolve(out, `${chapter.id}-voice.wav`);
  ffmpeg([
    "-i",
    voice,
    "-af",
    `atempo=${tempo},loudnorm=I=-16:TP=-1.5:LRA=7,adelay=250|250,apad,atrim=duration=${chapter.seconds}`,
    "-ar",
    "48000",
    "-ac",
    "2",
    path,
  ]);
  timings.push({ id: chapter.id, start: offset + 0.25, duration: length / tempo, tempo });
  offset += chapter.seconds;
  segments.push(path);
}
writeFileSync(resolve(out, "voice-list.txt"), segments.map((path) => `file '${path}'`).join("\n"));
ffmpeg([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  resolve(out, "voice-list.txt"),
  "-c",
  "copy",
  resolve(out, "narration.wav"),
]);
const bed = resolve(root, "public/audio/music-source.mp3");
const inputs = Array.from({ length: 4 }, () => ["-i", bed]).flat();
ffmpeg([
  ...inputs,
  "-filter_complex",
  "[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri[m1];[m1][2:a]acrossfade=d=2:c1=tri:c2=tri[m2];[m2][3:a]acrossfade=d=2:c1=tri:c2=tri,atrim=duration=120,loudnorm=I=-38:TP=-9:LRA=7,afade=t=in:d=2,afade=t=out:st=117:d=3[music]",
  "-map",
  "[music]",
  "-ar",
  "48000",
  "-ac",
  "2",
  resolve(out, "music.wav"),
]);
ffmpeg([
  "-i",
  resolve(out, "narration.wav"),
  "-i",
  resolve(out, "music.wav"),
  "-filter_complex",
  "[0:a]asplit=2[voice][side];[1:a][side]sidechaincompress=threshold=0.02:ratio=3:attack=30:release=400[ducked];[voice][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false[mix]",
  "-map",
  "[mix]",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  resolve(out, "soundtrack.m4a"),
]);
writeFileSync(
  resolve(out, "visual-list.txt"),
  chapters.map(({ id }) => `file '${resolve(out, `${id}-visual.mp4`)}'`).join("\n"),
);
ffmpeg([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  resolve(out, "visual-list.txt"),
  "-c",
  "copy",
  resolve(out, "visual.mp4"),
]);
ffmpeg([
  "-i",
  resolve(out, "visual.mp4"),
  "-i",
  resolve(out, "soundtrack.m4a"),
  "-map",
  "0:v",
  "-map",
  "1:a",
  "-c",
  "copy",
  "-t",
  "120",
  "-movflags",
  "+faststart",
  resolve(out, "rectify-demo.mp4"),
]);
writeFileSync(resolve(out, "narration-timings.json"), JSON.stringify(timings, null, 2));
process.stdout.write(
  "Mixed two-minute demo; music target 22 LU below narration, with additional speech ducking\n",
);

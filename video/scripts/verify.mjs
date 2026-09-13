import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "out");
const path = resolve(out, "rectify-demo.mp4");
const probe = JSON.parse(
  execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], {
    encoding: "utf8",
  }),
);
const video = probe.streams.find(({ codec_type }) => codec_type === "video");
const audio = probe.streams.find(({ codec_type }) => codec_type === "audio");
assert.equal(video.width, 1920);
assert.equal(video.height, 1080);
assert.equal(video.avg_frame_rate, "30/1");
assert.equal(Number(video.nb_frames), 3600);
assert.ok(Math.abs(Number(probe.format.duration) - 120) < 0.1);
assert.ok(audio, "Narration/audio track missing");
execFileSync("ffmpeg", ["-v", "error", "-i", path, "-f", "null", "-"]);
const black = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-i",
    path,
    "-vf",
    "blackdetect=d=0.2:pix_th=0.015:pic_th=0.995",
    "-an",
    "-f",
    "null",
    "-",
  ],
  { encoding: "utf8", maxBuffer: 4_000_000 },
);
assert.equal(black.status, 0);
assert.ok(!black.stderr.includes("black_start:"), "Blank frames detected");
const loudness = (file) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-i",
      file,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json",
      "-vn",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 4_000_000 },
  );
  assert.equal(result.status, 0);
  return JSON.parse(
    result.stderr.slice(result.stderr.lastIndexOf("{"), result.stderr.lastIndexOf("}") + 1),
  );
};
const voice = loudness(resolve(out, "narration.wav"));
const music = loudness(resolve(out, "music.wav"));
const mix = loudness(path);
const gap = Number(voice.input_i) - Number(music.input_i);
assert.ok(gap >= 18 && gap <= 24, `Voice/music loudness gap is ${gap}`);
assert.ok(Number(mix.input_tp) <= 0, "Clipped output peak");
const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
assert.equal(
  chapters.reduce((sum, chapter) => sum + chapter.seconds, 0),
  120,
);
assert.ok(chapters[0].seconds <= 30);
const report = {
  duration: Number(probe.format.duration),
  width: video.width,
  height: video.height,
  fps: 30,
  frames: Number(video.nb_frames),
  fullDecode: "PASS",
  blankFrameCheck: "PASS",
  voice,
  music,
  mix,
  voiceMusicGapLU: gap,
  captionTiming: "ElevenLabs word-level forced alignment against the final narration track",
};
writeFileSync(resolve(out, "verification.json"), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(import.meta.dirname, "..");
const envFile = process.env.ELEVENLABS_ENV_FILE;
if (!envFile) throw new Error("ELEVENLABS_ENV_FILE is missing");
const key = parseEnv(readFileSync(envFile, "utf8")).ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is missing");
const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
const text = chapters.map((chapter) => chapter.narration).join(" ");
const audio = readFileSync(resolve(root, "out/narration.wav"));
const hash = createHash("sha256").update(audio).update(text).digest("hex");
const output = resolve(root, "out/alignment.json");
if (existsSync(output) && JSON.parse(readFileSync(output, "utf8")).hash === hash) {
  process.stdout.write("Cached narration alignment\n");
} else {
  const mp3 = resolve(root, "out/alignment-input.mp3");
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    resolve(root, "out/narration.wav"),
    "-ac",
    "1",
    "-b:a",
    "128k",
    mp3,
  ]);
  const body = new FormData();
  body.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "narration.mp3");
  body.append("text", text);
  const response = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
    method: "POST",
    headers: { "xi-api-key": key },
    body,
  });
  if (!response.ok) throw new Error(`Narration alignment: HTTP ${response.status}`);
  const alignment = await response.json();
  if (!Array.isArray(alignment.words) || !alignment.words.length)
    throw new Error("No aligned words returned");
  writeFileSync(output, JSON.stringify({ hash, ...alignment }, null, 2));
  process.stdout.write(`Aligned ${alignment.words.length} narration words\n`);
}

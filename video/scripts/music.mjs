import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envFile = process.env.ELEVENLABS_ENV_FILE;
if (!envFile) throw new Error("ELEVENLABS_ENV_FILE is missing");
const key = parseEnv(readFileSync(envFile, "utf8")).ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is missing");
const profile = JSON.parse(readFileSync(resolve(root, "audio-direction.json"), "utf8"));
const body = {
  prompt: profile.musicPrompt,
  music_length_ms: 120000,
  model_id: "music_v1",
  force_instrumental: true,
};
const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
const path = resolve(root, "public/audio/music-source.mp3");
const cache = `${path}.sha256`;
if (existsSync(cache) && readFileSync(cache, "utf8") === hash) {
  process.stdout.write("Cached original music bed\n");
} else {
  const response = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Music generation HTTP ${response.status}`);
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  writeFileSync(cache, hash);
  process.stdout.write("Generated original two-minute instrumental bed\n");
}

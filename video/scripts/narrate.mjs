import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const directory = resolve(import.meta.dirname, "..");
const keyFile = process.env.ELEVENLABS_ENV_FILE;
if (!keyFile)
  throw new Error("Set ELEVENLABS_ENV_FILE to the local environment file containing the key");
const key = parseEnv(readFileSync(keyFile, "utf8")).ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is missing");
const chapters = JSON.parse(readFileSync(resolve(directory, "chapters.json"), "utf8"));
mkdirSync(resolve(directory, "public/audio"), { recursive: true });
const settings = {
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.45,
    similarity_boost: 0.78,
    style: 0.12,
    use_speaker_boost: true,
    speed: 1.04,
  },
};
for (const chapter of chapters) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ text: chapter.narration, ...settings }))
    .digest("hex");
  const output = resolve(directory, `public/audio/${chapter.id}.mp3`);
  const cache = `${output}.sha256`;
  if (existsSync(output) && existsSync(cache) && readFileSync(cache, "utf8") === hash) {
    process.stdout.write(`Cached narration: ${chapter.id}\n`);
    continue;
  }
  const response = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: chapter.narration, ...settings }),
    },
  );
  if (!response.ok) throw new Error(`Narration ${chapter.id}: HTTP ${response.status}`);
  writeFileSync(output, Buffer.from(await response.arrayBuffer()));
  writeFileSync(cache, hash);
  process.stdout.write(`Generated narration: ${chapter.id}\n`);
}

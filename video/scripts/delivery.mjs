import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "out");
const chapters = JSON.parse(readFileSync(resolve(root, "chapters.json"), "utf8"));
const alignment = JSON.parse(readFileSync(resolve(out, "alignment.json"), "utf8"));
const words = alignment.words.filter((word) => word.text.trim());
const escape = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const stamp = (seconds) => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
const cues = [];
let index = 0;
while (index < words.length) {
  let count = Math.min(10, words.length - index);
  for (let offset = 4; offset < count; offset++) {
    if (/[.!?]$/.test(words[index + offset - 1].text)) {
      count = offset;
      break;
    }
  }
  const start = words[index].start;
  const end = words[index + count - 1].end;
  const text = words
    .slice(index, index + count)
    .map((word) => word.text)
    .join(" ");
  cues.push(`${stamp(start)} --> ${stamp(end)}\n${escape(text)}`);
  index += count;
}
writeFileSync(resolve(out, "captions.vtt"), `WEBVTT\n\n${cues.join("\n\n")}\n`);
const transcript = chapters
  .map(
    (chapter) =>
      `<section><h2>${escape(chapter.title)}</h2><p>${escape(chapter.narration)}</p></section>`,
  )
  .join("\n");
writeFileSync(
  resolve(out, "index.html"),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rectify — Closed Isn’t Fixed | Two-minute demo</title>
<style>body{margin:0;background:#080b13;color:#f0f1f5;font:17px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,5vw,48px);line-height:1.12;margin-bottom:16px}video{width:100%;border:1px solid #353d51;border-radius:14px;background:#000}a{color:#a5beff}p{max-width:850px;color:#bcc6da}h2{font-size:23px}details{margin-top:32px}summary{cursor:pointer;font-size:22px}section{margin-top:28px}.meta{color:#a5b9e0;font-size:14px;letter-spacing:.05em}video::cue{background:#080b13ed;color:white}</style></head>
<body><main><div class="meta">RECTIFY · PRODUCT WALKTHROUGH · 2:00</div><h1>Closed isn’t fixed.</h1>
<p>Follow a customer complaint through engineering evidence, workflow verification, human approval and observed recovery.</p>
<video controls playsinline preload="metadata" poster="poster.jpg"><source src="rectify-demo.mp4" type="video/mp4"><track kind="captions" src="captions.vtt" srclang="en" label="English">Your browser does not support embedded video. <a href="rectify-demo.mp4">Download the MP4.</a></video>
<p><a href="rectify-demo.mp4" download>Download video</a> · <a href="captions.vtt" download>English captions</a> · <a href="https://github.com/Enoch208/rectify-">Public repository</a></p>
<p>Actual local application. Gmail, GitHub and Slack use explicitly labelled fixtures. Investigation uses a real model. Waiting time is shortened. AI-generated narration.</p>
<details><summary>Read the full transcript</summary>${transcript}</details></main></body></html>`,
);
writeFileSync(
  resolve(out, "transcript.txt"),
  chapters.map(({ title, narration }) => `${title}\n${narration}`).join("\n\n"),
);
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-ss",
  "3.3",
  "-i",
  resolve(out, "rectify-demo.mp4"),
  "-frames:v",
  "1",
  "-q:v",
  "2",
  resolve(out, "poster.jpg"),
]);
process.stdout.write("Generated accessible preview, caption track, transcript and poster\n");

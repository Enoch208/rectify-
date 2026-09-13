# Rectify — Closed Isn’t Fixed

Two-minute product walkthrough for customer-support and engineering teams. The opening stays on the landing page for 20 seconds; the remaining 100 seconds demonstrate the actual application.

[Public preview](https://enoch208.github.io/rectify-/demo/) · [MP4](https://enoch208.github.io/rectify-/demo/rectify-demo.mp4) · [Editable source and cached media](https://github.com/Enoch208/rectify-/releases/tag/demo-2026-09-13)

## What was recorded

The production Next app and ReportDesk run locally, alongside the real worker. Gmail, GitHub and Slack are explicitly `LOCAL FIXTURE`. The investigation uses the real `gpt-5.4-mini-2026-03-17` model. No live customer messages or provider writes were made for the recording.

The captured case reached `RECOVERED`, `SENT`, and sync `COMPLETE`. Its seven action-ledger entries were confirmed, each with one attempt. The investigation used 10 tool calls and took 21.691 seconds. This is one observed walkthrough, not the final 18-trial evaluation. The run’s trace ID was null; an openable Lemma trace was not verified.

The approval is submitted by `scripts/approve-local.mjs` through the real signature-validation endpoint. The video and narration disclose this; no Slack UI click is fabricated. Customer recovery comes from the real authenticated ReportDesk export and signed product outcome, not from a status toggle.

## Reproduce

Requirements: Node 24, FFmpeg, Google Chrome on macOS, and the root application built with pnpm. Install this isolated video toolchain with `npm ci --prefix video`.

1. Put `OPENAI_API_KEY` and `RECTIFY_MODEL_ID` in the root `.env`. Optional Lemma variables are forwarded. The recording runtime generates separate local authentication secrets and uses a new SQLite directory under ignored `.data/`.
2. Run `node video/scripts/runtime.mjs` and leave it running.
3. Run `node video/scripts/capture.mjs`, then `node video/scripts/capture-recovery.mjs`, then `node video/scripts/capture-ending.mjs`.
4. Run `node video/scripts/prepare.mjs`.
5. Set `ELEVENLABS_ENV_FILE` to a local env file containing `ELEVENLABS_API_KEY`; run `node video/scripts/narrate.mjs`.
6. Supply the reusable instrumental asset at `video/public/audio/music-source.mp3`.
7. Run `node video/scripts/render.mjs --stills` to inspect framing, then `node video/scripts/render.mjs` to render chapter caches.
8. Run `node video/scripts/mix.mjs`, then `node video/scripts/align.mjs` with `ELEVENLABS_ENV_FILE` set, then `node video/scripts/delivery.mjs` and `node video/scripts/verify.mjs`.
9. Run `node video/scripts/preview.mjs`; open `http://127.0.0.1:3490`.

Capture records actual 1920×1080 browser content with an editorial pointer. The delivery is 1920×1080 at 30 fps. Browser screencast source cadence varies; preparation normalizes frames to 30 fps. Waiting time is shortened, and short clips hold their final real frame. No screens or results are generated.

`chapters.json` contains the editable narration and timings; `src/index.jsx` contains the browser frame, chapter labels and restrained 4% focus zooms. Captured footage, narration and rendered chapters are cached and ignored by Git. Remove only the affected cached chapter when changing its visuals. Narration caching is content-hashed.

Music reuses the user’s existing ElevenLabs-generated instrumental from the Carry project. It is normalized to −38 LUFS versus narration at −16 LUFS, then ducked further during speech. This asset is not a recording of a commercial song.

Narration uses ElevenLabs George (`eleven_multilingual_v2`). Final measured voice/music separation is 21.75 LU; the combined true peak is −4.37 dBTP. The final MP4 fully decodes, contains 3,600 frames at 30 fps, lasts 120 seconds, and passes the blank-frame scan. Caption timestamps come from [ElevenLabs forced alignment](https://elevenlabs.io/docs/api-reference/forced-alignment/create) against the final narration. Representative framing and browser playback were inspected. Subjective listening quality still warrants a final human listen before submission.

## Publication checklist

- Verify the final MP4 decodes and lasts exactly 120 seconds.
- Watch the opening, every transition, approval, export and ending with sound.
- Confirm narration does not overrun any chapter; check voice/music loudness.
- Check captions, transcript, readable text and masked session tokens.
- Publish only the final MP4, poster, captions and safe editable assets. Never include `.env`, `.data`, runtime secrets or raw approval payloads.
- Verify repository and demo access without authentication; link the demo near the top of the root README.

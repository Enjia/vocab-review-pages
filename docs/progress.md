# Project Progress

## Live

- Static vocabulary review site on GitHub Pages.
- Obsidian-backed data generation via `npm run build:data`.
- 100-card modules and 20-card packs.
- Daily queue with due review, weak cards, and new cards.
- Local `Known` / `Again` progress stored in browser `localStorage`.
- Sourced-example replacement workflow using Tatoeba sentence IDs, authors, and licenses.

## In Progress

- Replace high-confidence template examples with openly licensed sourced examples.
- Current sourced write-back count: 9 entries with English and Chinese from Tatoeba.
- Candidate pool: 443 sourced English examples found from Tatoeba, 434 still need acceptable Chinese translations before write-back.

## Planned: AI Speaking Coach

Goal: add a real voice-practice mode where the learner speaks with an AI tutor around selected vocabulary.

Security architecture:

- The GitHub Pages frontend must never contain an OpenAI API key.
- A small backend or serverless endpoint must hold the OpenAI key and issue short-lived Realtime session credentials.
- Browser flow: user opens practice mode, frontend asks backend for an ephemeral session, browser connects to OpenAI Realtime through WebRTC, and the session expires quickly.
- The backend should restrict allowed model, voice, instructions, and maximum session duration.

Implementation phases:

1. Add a non-AI speaking drill with browser speech recognition and text-to-speech for selected vocabulary.
2. Add backend token broker for OpenAI Realtime.
3. Add AI role-play sessions using module vocabulary and sourced example context.
4. Log only local progress by default; avoid storing raw audio or transcripts unless explicitly enabled.

References:

- OpenAI Realtime WebRTC documentation: https://platform.openai.com/docs/guides/realtime-webrtc
- MDN Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

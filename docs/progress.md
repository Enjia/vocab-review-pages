# Project Progress

## Live

- Static vocabulary review site on GitHub Pages.
- Obsidian-backed data generation via `npm run build:data`.
- 100-card modules and 20-card packs.
- Daily queue with due review, weak cards, and new cards.
- Local `Known` / `Again` progress stored in browser `localStorage`.
- Sourced-example replacement workflow using Tatoeba sentence IDs, authors, and licenses.
- Frontend cards show English examples only; source data may still retain Chinese example translations for archival use.

## In Progress

- Replace high-confidence template examples with openly licensed sourced examples.
- Current sourced write-back count: 9 entries with English examples from Tatoeba.
- Candidate pool: 443 sourced English examples found from Tatoeba.
- New policy: future sourced-example write-back only requires a natural English example plus source metadata. Chinese translations are optional and are not a blocker.

## Planned: AI Speaking Coach

Goal: add a real voice-practice mode where the learner speaks with an AI tutor around selected vocabulary.

Security architecture:

- The GitHub Pages frontend must never contain an OpenAI API key.
- A Vercel serverless endpoint must hold the OpenAI key and issue short-lived Realtime client secrets.
- Browser flow: user opens practice mode, frontend asks the Vercel endpoint for an ephemeral session, browser connects to OpenAI Realtime through WebRTC, and the session expires quickly.
- The backend must restrict allowed origin, model, voice, instructions, selected vocabulary size, request rate, and maximum session duration.
- No raw audio should be stored. Transcripts stay local by default unless a later feature explicitly enables sync.

Implementation phases:

1. Add the Vercel token broker for OpenAI Realtime.
2. Add AI role-play sessions using module vocabulary and sourced example context.
3. Add optional local-only transcript review and progress markers.

References:

- OpenAI Realtime WebRTC documentation: https://platform.openai.com/docs/guides/realtime-webrtc
- OpenAI Realtime client secrets API: https://platform.openai.com/docs/api-reference/realtime-sessions

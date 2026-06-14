# AI Speaking Coach Security Architecture

## Goal

Add a real voice-practice mode where the learner can speak with an AI tutor using the current vocabulary module or pack, without exposing any long-lived OpenAI credential in the GitHub Pages frontend.

## Architecture

- GitHub Pages remains a static frontend for review, module selection, and the speaking-coach UI.
- A separate Vercel project owns `POST /api/realtime-session`.
- The Vercel function stores `OPENAI_API_KEY` as an encrypted environment variable and calls OpenAI server-side.
- The browser receives only a short-lived Realtime client secret and uses it to connect to OpenAI Realtime over WebRTC.

## Request Flow

1. The learner selects a module, pack, or small word set in the static site.
2. The frontend sends `POST /api/realtime-session` to the Vercel endpoint with:
   - `moduleId`
   - `packId`
   - `words`, capped by the backend
   - optional learner level such as `beginner`, `intermediate`, or `advanced`
3. The Vercel function validates origin, CORS, request shape, word count, and rate limits.
4. The Vercel function builds the Realtime session configuration server-side:
   - fixed model from `REALTIME_MODEL`
   - fixed voice
   - server-owned tutor instructions
   - selected vocabulary embedded as practice context
   - no tools enabled in v1
5. The Vercel function calls OpenAI `POST /v1/realtime/client_secrets` with the standard API key.
6. The frontend receives `{ clientSecret, expiresAt, sessionId }`.
7. The browser creates an `RTCPeerConnection`, attaches the microphone track, and authenticates the WebRTC connection using the client secret.

## Backend Contract

Endpoint: `POST /api/realtime-session`

Environment:

- `OPENAI_API_KEY`: long-lived server-side key, never exposed to the browser.
- `ALLOWED_ORIGIN`: `https://enjia.github.io`.
- `REALTIME_MODEL`: server-controlled Realtime model.
- `MAX_WORDS_PER_SESSION`: default `12`.
- `MAX_SESSION_SECONDS`: default `600`.

Response:

```json
{
  "clientSecret": "ephemeral-secret",
  "expiresAt": 1780000000,
  "sessionId": "sess_..."
}
```

The response must never include `OPENAI_API_KEY`, raw server prompts, or any broader provider credential.

## Security Controls

- CORS allows only `ALLOWED_ORIGIN`.
- Reject missing or unexpected `Origin`.
- Accept only `POST`.
- Rate-limit by IP plus a short anonymous browser session id.
- Hardcode the allowed model, voice, tool availability, and session duration server-side.
- Ignore any frontend-provided model, voice, system prompt, tool definition, or temperature field.
- Cap selected vocabulary count and total prompt length.
- Set `OpenAI-Safety-Identifier` on the server-side client-secret request using a stable anonymous hash, not personal data.
- Do not store raw audio.
- Keep transcripts in browser memory or local storage only for v1.
- Do not store the ephemeral client secret in `localStorage`, IndexedDB, or URL parameters.

## Tutor Behavior

The server-owned instruction should make the tutor run a 5-6 turn natural dialogue:

- Introduce a realistic scene based on the selected words.
- Ask one short spoken question at a time.
- Naturally include target vocabulary in the tutor's turns.
- Encourage the learner to reuse one or two target words per answer.
- Correct gently after the learner speaks, then continue the dialogue.
- End with a concise recap of words practiced and one suggested retry.

## References

- OpenAI Realtime WebRTC guide: https://platform.openai.com/docs/guides/realtime-webrtc
- OpenAI Realtime client secrets API: https://platform.openai.com/docs/api-reference/realtime-sessions
- MDN WebRTC API: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

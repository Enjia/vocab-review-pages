# Vocabulary Memory Lab

Static GitHub Pages review app generated from the Obsidian vocabulary notes in:

`/Users/chenenjia/Library/Mobile Documents/iCloud~md~obsidian/Documents/My Second Brain/Project/背单词`

## Local Workflow

```bash
npm run build:data
npm test
npm run serve
```

Open `http://localhost:4173`.

Progress is stored in browser `localStorage`, so the generated site does not write back to Obsidian.

## Night Practice

The site includes `Night Practice` packs for the 10:30-10:45 PM practice routine.

- Each pack covers 10 vocabulary items.
- Each pack has a realistic scene and 25 User / ChatGPT turns.
- Use `Copy ChatGPT prompt`, paste it into the ChatGPT App, and practice one question at a time.
- `Practiced tonight` stores local completion state only; it does not automatically mark vocabulary cards as known.

## AI Speaking Coach

The repository still includes an optional WebRTC speaking-practice backend for later use. It needs a separate Vercel serverless endpoint for OpenAI Realtime client secrets.

Required Vercel environment variables:

- `OPENAI_API_KEY`
- `ALLOWED_ORIGIN=https://enjia.github.io`
- `REALTIME_MODEL=gpt-realtime`
- `REALTIME_VOICE=alloy`

The browser only receives a short-lived client secret from `/api/realtime-session`; the long-lived OpenAI API key stays in Vercel.

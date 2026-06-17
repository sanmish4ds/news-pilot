# News Pilot — Listen to Today's Top 10 India News

Audio-first news for everyone — especially listeners aged 50+ who prefer to **hear** the news rather than read it.

## Features

- **Top 10 India news** refreshed from Google News RSS
- **22 constitutional languages** + English
- **Sarvam AI (Bulbul v3)** — natural Indian language voices
- **Two listen modes** — full radio bulletin or each story individually
- **Accessible UI** — large buttons, high contrast, audio-first

## Local setup

```bash
npm install
cp .env.example .env.local
```

Add keys to `.env.local`:

```
OPENAI_API_KEY=sk-...       # translation
SARVAM_API_KEY=sk-...       # TTS — dashboard.sarvam.ai
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy on Render

### 1. Push to GitHub

```bash
git add .
git commit -m "Prepare News Pilot for Render deployment"
git push -u origin main
```

### 2. Create the web service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. **New +** → **Blueprint** (if `render.yaml` is in the repo) **or** **Web Service**
3. Connect repo `sanmish4ds/news-pilot`
4. Settings (if not using Blueprint):

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Region | Singapore (closest to India) |

### 3. Environment variables

Set these in Render → **Environment**:

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes | News translation |
| `SARVAM_API_KEY` | Yes | Text-to-speech |
| `BHASHINI_API_KEY` | No | Native Maithili fallback |
| `ELEVENLABS_API_KEY` | No | English fallback |

### 4. Deploy

Click **Deploy**. Render builds with `npm run build` and runs `npm start` on the assigned URL (`https://news-pilot-xxxx.onrender.com`).

> **Note:** Full bulletin TTS can take 30–90 seconds. Use Render **Starter** plan or higher for longer request timeouts. Story-by-story mode works better on free tier.

## How it works

1. Fetches today's top 10 India headlines
2. You pick a language (Hindi, Tamil, Maithili, etc.)
3. OpenAI translates + builds a radio script
4. Sarvam AI reads it aloud — full bulletin or one story at a time

## Languages

Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santhali, Sindhi, Tamil, Telugu, Urdu — plus English.

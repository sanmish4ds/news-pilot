# The news Noice : Today's Top 10 India News without any Noice

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

## Deploy on Netlify (recommended)

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Netlify deployment config"
git push origin main
```

### 2. Create site on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect GitHub → select `sanmish4ds/news-pilot`
3. Netlify auto-detects Next.js 16 — settings from `netlify.toml`:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | 20 |

4. Click **Deploy site**

### 3. Environment variables

Netlify → **Site configuration** → **Environment variables** → **Add a variable**:

| Variable | Required |
|----------|----------|
| `OPENAI_API_KEY` | Yes |
| `SARVAM_API_KEY` | Yes |
| `BHASHINI_API_KEY` | No (Maithili native voice) |

Redeploy after adding variables (**Deploys** → **Trigger deploy** → **Clear cache and deploy site**).

### 4. Live URL

Netlify gives you `https://random-name.netlify.app`. Customize under **Domain management**.

> **Timeout note:** Netlify serverless functions have a **10s limit** on the free plan (26s on Pro). Use **Each Story** mode for reliable audio. Full bulletin TTS may timeout on free tier.

## Deploy on Render (alternative)

See `render.yaml` and `Dockerfile`. Use **Docker** or **Node** runtime — not Elixir.

| Setting | Value |
|---------|-------|
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

## How it works

1. Fetches today's top 10 India headlines
2. You pick a language (Hindi, Tamil, Maithili, etc.)
3. OpenAI translates + builds a radio script
4. Sarvam AI reads it aloud — full bulletin or one story at a time

## Languages

Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santhali, Sindhi, Tamil, Telugu, Urdu — plus English.

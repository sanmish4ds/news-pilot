import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, claudeStructured } from "@/lib/anthropic";
import { getLanguageByCode } from "@/lib/languages";
import { buildNewsChunkPrompt, buildUiOnlyPrompt } from "@/lib/translation-prompts";
import { englishUi, UiStrings } from "@/lib/ui-strings";
import { stitchBulletinFallback } from "@/lib/radio-bulletin";
import { createServerCache, hashKey } from "@/lib/server-cache";
import { warmTtsCache } from "@/lib/tts-cache";

// Listening is only wired up for these languages — no point pre-warming
// TTS audio that's never played (see LISTENING_ENABLED_CODES in NewsRadioApp.tsx).
const LISTENING_ENABLED_CODES = new Set(["en", "hi", "mai"]);

// Same day's news translates identically for every visitor in a given
// language — cache the result server-side so only the first person to pick
// a language each day pays for the LLM call; everyone after gets it instantly.
const TRANSLATION_CACHE_TTL_MS = 20 * 60 * 1000;
const translationCache = createServerCache<{
  news: unknown[];
  ui: unknown;
  bulletinScript: string;
}>(TRANSLATION_CACHE_TTL_MS);

const NEWS_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    rank: { type: "number" },
    headline: { type: "string" },
    summary: { type: "string" },
    source: { type: "string" },
  },
  required: ["id", "rank", "headline", "summary", "source"],
};

const UI_STRINGS_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    chooseLanguage: { type: "string" },
    playBulletin: { type: "string" },
    listenAllStories: { type: "string" },
    listenStory: { type: "string" },
    radioMode: { type: "string" },
    storiesMode: { type: "string" },
    pause: { type: "string" },
    stop: { type: "string" },
    refresh: { type: "string" },
    onAir: { type: "string" },
    preparingBulletin: { type: "string" },
    loadingNews: { type: "string" },
    preparingNews: { type: "string" },
    voiceBrowser: { type: "string" },
    voiceNotReady: { type: "string" },
    nowPlaying: { type: "string" },
    readyToPlay: { type: "string" },
    storyLabel: { type: "string" },
    headlines: { type: "string" },
  },
  required: [
    "title", "subtitle", "chooseLanguage", "playBulletin", "listenAllStories", "listenStory",
    "radioMode", "storiesMode", "pause", "stop", "refresh", "onAir", "preparingBulletin",
    "loadingNews", "preparingNews", "voiceBrowser", "voiceNotReady", "nowPlaying", "readyToPlay",
    "storyLabel", "headlines",
  ],
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface NewsInput {
  id: string;
  rank: number;
  title: string;
  source: string;
  snippet: string;
}

interface TranslatedNewsItem {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  source: string;
}

export async function POST(req: NextRequest) {
  try {
    const { news, languageCode, dateLabel = "today" } = (await req.json()) as {
      news: NewsInput[];
      languageCode: string;
      dateLabel?: string;
    };

    if (!news?.length) {
      return NextResponse.json({ error: "No news to translate" }, { status: 400 });
    }

    const lang = getLanguageByCode(languageCode);
    if (!lang) {
      return NextResponse.json({ error: "Unknown language" }, { status: 400 });
    }

    const { ui: enUi } = englishUi(news.length);

    // English — instant, no GPT
    if (languageCode === "en") {
      const translated = news.map((item) => ({
        id: item.id,
        rank: item.rank,
        headline: item.title,
        summary: item.snippet || item.title,
        source: item.source,
      }));
      const bulletinScript = stitchBulletinFallback(lang, translated, dateLabel);
      if (LISTENING_ENABLED_CODES.has(languageCode)) warmTtsCache(bulletinScript, languageCode);
      return NextResponse.json({ news: translated, ui: enUi, bulletinScript, language: lang });
    }

    const cacheKey = hashKey(
      languageCode,
      dateLabel,
      news.map((n) => n.id).join(","),
      news.map((n) => n.title).join("|")
    );
    const cachedResult = translationCache.get(cacheKey);
    if (cachedResult) {
      if (LISTENING_ENABLED_CODES.has(languageCode)) {
        warmTtsCache(cachedResult.bulletinScript, languageCode);
      }
      return NextResponse.json({ ...cachedResult, language: lang });
    }

    const client = getAnthropicClient();

    // Listening/audio is English-only for now, so the bulletin script for
    // every other language is never shown — no need to ask the (slow) model
    // to write one. Translate the news array in a few moderate-size parallel
    // chunks (plus a separate parallel call for the UI labels): a single
    // call covering all 20 items generates enough output for Hindi/Maithili
    // that it can run long enough with no bytes flowing to trip an upstream
    // proxy's inactivity timeout (seen as a raw "Inactivity Timeout" HTML
    // page instead of our JSON) — but too many small chunks reintroduces the
    // concurrent-request burst that used to trigger Anthropic rate-limit
    // retries. A handful of ~8-item chunks keeps both risks low.
    const newsChunkPrompt = buildNewsChunkPrompt(lang);
    // Non-Latin scripts (Devanagari, Bengali, Tamil, …) cost noticeably more
    // output tokens per character than English/Latin script does, plus JSON
    // field-name/escaping overhead on top — 220 tokens/item was tuned for
    // Latin text and was silently truncating Maithili's tool-call JSON mid-
    // object on larger batches, which surfaced as "Translation returned no
    // results". Give non-English scripts a bigger per-item budget and a
    // higher ceiling (claude-sonnet-4-6 supports well beyond 4096 output).
    const perItemTokens = languageCode === "en" ? 220 : 450;
    const maxTokensCap = languageCode === "en" ? 4096 : 8192;
    const CHUNK_SIZE = 8;
    const chunks: NewsInput[][] = [];
    for (let i = 0; i < news.length; i += CHUNK_SIZE) {
      chunks.push(news.slice(i, i + CHUNK_SIZE));
    }

    const chunkPromises = chunks.map((chunk) =>
      claudeStructured<{ news: TranslatedNewsItem[] }>(client, {
        system: newsChunkPrompt,
        userContent: JSON.stringify(chunk),
        maxTokens: Math.min(maxTokensCap, 300 + chunk.length * perItemTokens),
        toolName: "return_news",
        toolDescription: "Return the translated news items.",
        inputSchema: {
          type: "object",
          properties: { news: { type: "array", items: NEWS_ITEM_SCHEMA } },
          required: ["news"],
        },
      }).catch(() => ({ news: [] as TranslatedNewsItem[] }))
    );

    const uiPromise = claudeStructured<{ ui: UiStrings }>(client, {
      system: buildUiOnlyPrompt(lang, news.length),
      userContent: "Translate the UI labels.",
      maxTokens: 600,
      toolName: "return_ui_strings",
      toolDescription: "Return the translated UI label strings.",
      inputSchema: {
        type: "object",
        properties: { ui: UI_STRINGS_SCHEMA },
        required: ["ui"],
      },
    }).catch(() => ({ ui: enUi }));

    const [uiParsed, ...chunkResults] = await Promise.all([uiPromise, ...chunkPromises]);

    const translated = chunkResults.flatMap((r) => r.news || []);
    const translatedIds = new Set(translated.map((n) => n.id));
    // One chunk's tool call can fail (truncated/rejected) independently of
    // the others — backfill just the missing items with their English
    // source text instead of discarding the whole batch when only one
    // chunk out of several actually failed.
    const missing = news
      .filter((item) => !translatedIds.has(item.id))
      .map((item) => ({
        id: item.id,
        rank: item.rank,
        headline: item.title,
        summary: item.snippet || item.title,
        source: item.source,
      }));
    const translationFailed = translated.length === 0;
    const translatedNews: TranslatedNewsItem[] = [...translated, ...missing].sort(
      (a, b) => a.rank - b.rank
    );

    const bulletinScript = stitchBulletinFallback(lang, translatedNews, dateLabel);
    const result = { news: translatedNews, ui: uiParsed.ui || enUi, bulletinScript };
    // Don't cache a degraded English fallback — the next request should get
    // a real shot at translating instead of being stuck with English for
    // the full cache TTL.
    if (!translationFailed) translationCache.set(cacheKey, result);
    if (LISTENING_ENABLED_CODES.has(languageCode)) warmTtsCache(bulletinScript, languageCode);

    return NextResponse.json({ ...result, language: lang, translationDegraded: translationFailed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

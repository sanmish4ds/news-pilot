import { getAnthropicClient, claudeStructured } from "@/lib/anthropic";
import { ConstitutionalLanguage, getLanguageByCode } from "@/lib/languages";
import { buildNewsChunkPrompt, buildUiOnlyPrompt } from "@/lib/translation-prompts";
import { englishUi, UiStrings } from "@/lib/ui-strings";
import { stitchBulletinFallback } from "@/lib/radio-bulletin";
import { createServerCache, hashKey } from "@/lib/server-cache";
import { warmTtsCache } from "@/lib/tts-cache";

// Listening is available for English and Hindi only — no point pre-warming
// TTS audio for a language whose player controls are never shown (see
// LISTENING_ENABLED_CODES in NewsRadioApp.tsx).
const LISTENING_ENABLED_CODES = new Set(["en", "hi"]);

// Same day's news translates identically for every visitor in a given
// language — cache the result server-side so only the first caller (a real
// visitor, or the hourly cache-warmer) each window pays for the LLM call;
// everyone after gets it instantly. TTL is longer than the warmer's cadence
// plus a buffer, so a warm-up run's result stays valid until the next one.
const TRANSLATION_CACHE_TTL_MS = 75 * 60 * 1000;
const translationCache = createServerCache<{
  news: TranslatedNewsItem[];
  ui: UiStrings;
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

export interface NewsInput {
  id: string;
  rank: number;
  title: string;
  source: string;
  snippet: string;
}

export interface TranslatedNewsItem {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  source: string;
}

export interface TranslateNewsResult {
  news: TranslatedNewsItem[];
  ui: UiStrings;
  bulletinScript: string;
  language: ConstitutionalLanguage;
  translationDegraded?: boolean;
}

function englishFallback(items: NewsInput[]): TranslatedNewsItem[] {
  return items.map((item) => ({
    id: item.id,
    rank: item.rank,
    headline: item.title,
    summary: item.snippet || item.title,
    source: item.source,
  }));
}

/**
 * Translates a day's headlines into the given language (server-cached per
 * day/language), stitches the radio bulletin script, and — for English/Hindi
 * — kicks off a background TTS warm-up of that bulletin. Shared by the
 * on-demand /api/translate-news route and the hourly cache-warmer, so a
 * warm-up run and a real visitor's request produce (and reuse) the exact
 * same cache entry.
 */
export async function translateNewsForLanguage(
  news: NewsInput[],
  languageCode: string,
  dateLabel: string
): Promise<TranslateNewsResult> {
  if (!news.length) throw new Error("No news to translate");

  const lang = getLanguageByCode(languageCode);
  if (!lang) throw new Error("Unknown language");

  const { ui: enUi } = englishUi(news.length);

  // English — instant, no LLM
  if (languageCode === "en") {
    const translated = englishFallback(news);
    const bulletinScript = stitchBulletinFallback(lang, translated, dateLabel);
    if (LISTENING_ENABLED_CODES.has(languageCode)) warmTtsCache(bulletinScript, languageCode);
    return { news: translated, ui: enUi, bulletinScript, language: lang };
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
    return { ...cachedResult, language: lang };
  }

  const client = getAnthropicClient();

  // Translate the news array in a few moderate-size parallel chunks (plus a
  // separate parallel call for the UI labels): a single call covering all 20
  // items generates enough output for Hindi/Maithili that it can run long
  // enough with no bytes flowing to trip an upstream proxy's inactivity
  // timeout (seen as a raw "Inactivity Timeout" HTML page instead of our
  // JSON) — but too many small chunks reintroduces the concurrent-request
  // burst that used to trigger Anthropic rate-limit retries. A handful of
  // ~3-item chunks keeps both risks low.
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
  // Chunks run in parallel (Promise.all below), so total wall time is
  // bounded by the SLOWEST chunk, not their sum — measured ~4s/item plus
  // ~3.5s fixed overhead per Claude call for Hindi/Maithili, so an 8-item
  // chunk alone took ~36s, comfortably past most platforms' function/
  // gateway timeout on its own regardless of how few chunks there were.
  // A smaller chunk size keeps every individual call's wall time short;
  // parallel fan-out at 4-5 concurrent calls didn't show meaningful
  // rate-limit slowdown in testing, so this is a straight win.
  const CHUNK_SIZE = 3;
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
  // One chunk's tool call can fail (truncated/rejected) independently of the
  // others — backfill just the missing items with their English source text
  // instead of discarding the whole batch when only one chunk out of several
  // actually failed.
  const missing = englishFallback(news.filter((item) => !translatedIds.has(item.id)));
  const translationFailed = translated.length === 0;
  const translatedNews: TranslatedNewsItem[] = [...translated, ...missing].sort(
    (a, b) => a.rank - b.rank
  );

  const bulletinScript = stitchBulletinFallback(lang, translatedNews, dateLabel);
  const result = { news: translatedNews, ui: uiParsed.ui || enUi, bulletinScript };
  // Don't cache a degraded English fallback — the next request should get a
  // real shot at translating instead of being stuck with English for the
  // full cache TTL.
  if (!translationFailed) translationCache.set(cacheKey, result);
  if (LISTENING_ENABLED_CODES.has(languageCode)) warmTtsCache(bulletinScript, languageCode);

  return { ...result, language: lang, translationDegraded: translationFailed };
}

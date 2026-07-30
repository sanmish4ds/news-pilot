import { refreshTopNews } from "./news/top-news-service";
import { NewsInput, TranslatedNewsItem, translateNewsForLanguage } from "./news/translate-service";
import { generateSummaryBlocking } from "./news/summarize-service";
import { getLanguageByCode } from "./languages";

// The app only supports English and Hindi (see languages.ts) — English needs
// no LLM call for translation, Hindi costs a handful of translation calls
// plus a TTS bulletin synthesis.
const WARM_LANGUAGES = ["en", "hi"];
// Full per-article summaries (20 stories × 2 languages = 40 scrape+LLM calls)
// are the most expensive part of a warm-up run — capped concurrency so it
// doesn't fire all 40 at once and trip rate limits, same pattern as
// translate-service's chunking.
const SUMMARY_CONCURRENCY = 4;

const HOUR_MS = 60 * 60 * 1000;
// IST is UTC+5:30, so "every hour at :01 IST" lands on minute 31 of every
// UTC hour, independent of which UTC hour it is.
const TARGET_MINUTE_UTC = 31;

let started = false;

// English translation/bulletin text is deliberately never cached (it's free
// to recompute) and depends on each story's one-line snippet, which the
// top-news background enrichment can patch in between requests — so the
// bulletin text a status check would recompute "now" can legitimately differ
// from what was actually warmed a moment earlier. Recording the exact text
// each warm-up run used lets the status endpoint check against ground truth
// instead of a possibly-stale recomputation.
export const lastWarmedBulletins = new Map<string, string>();

export interface WarmRunResult {
  startedAt: string;
  finishedAt: string;
  date: string;
  newsCount: number;
  languages: {
    code: string;
    ok: boolean;
    error?: string;
    summariesWarmed?: number;
    summariesFailed?: number;
  }[];
}

/** Pre-generates the full per-article summary (the "Summarizing..." modal) for every
 * story in one language, so clicking any headline is instant instead of paying the
 * scrape+LLM cost live. Limited concurrency to avoid a 20-request burst per language. */
async function warmSummariesForLanguage(
  languageCode: string,
  translated: TranslatedNewsItem[],
  urlById: Map<string, string>
): Promise<{ warmed: number; failed: number }> {
  const lang = getLanguageByCode(languageCode);
  if (!lang) return { warmed: 0, failed: 0 };
  const { name: languageName, native: languageNative } = lang;

  let warmed = 0;
  let failed = 0;
  let idx = 0;

  async function worker() {
    while (idx < translated.length) {
      const item = translated[idx++];
      try {
        await generateSummaryBlocking({
          headline: item.headline,
          snippet: item.summary,
          source: item.source,
          url: urlById.get(item.id),
          languageName,
          languageNative,
        });
        warmed++;
      } catch (err) {
        failed++;
        console.error(`[cache-warmer] summary "${languageCode}" ${item.id} failed:`, err);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SUMMARY_CONCURRENCY, translated.length) }, () => worker())
  );
  return { warmed, failed };
}

/** Runs one warm-up pass immediately — exported so both the hourly scheduler
 * below and the manual `/api/cron/warm-cache` trigger share the same logic. */
export async function runCacheWarmOnce(): Promise<WarmRunResult> {
  const startedAt = new Date().toISOString();
  const entry = await refreshTopNews();
  const newsInput: NewsInput[] = entry.news.map((n) => ({
    id: n.id,
    rank: n.rank,
    title: n.title,
    source: n.source,
    snippet: n.snippet,
  }));
  const urlById = new Map(entry.news.map((n) => [n.id, n.url]));

  const languages: WarmRunResult["languages"] = [];
  for (const code of WARM_LANGUAGES) {
    try {
      const result = await translateNewsForLanguage(newsInput, code, entry.date);
      lastWarmedBulletins.set(code, result.bulletinScript);
      const { warmed, failed } = await warmSummariesForLanguage(code, result.news, urlById);
      languages.push({ code, ok: true, summariesWarmed: warmed, summariesFailed: failed });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[cache-warmer] translate "${code}" failed:`, err);
      languages.push({ code, ok: false, error });
    }
  }

  const finishedAt = new Date().toISOString();
  console.log(`[cache-warmer] warmed ${WARM_LANGUAGES.join(", ")} — started ${startedAt}, finished ${finishedAt}`);
  return { startedAt, finishedAt, date: entry.date, newsCount: entry.news.length, languages };
}

function msUntilNextAlignedRun(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), TARGET_MINUTE_UTC, 0, 0)
  );
  if (next.getTime() <= now.getTime()) next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime() - now.getTime();
}

// After the boot-time run below, don't let the aligned schedule (or the
// hourly interval) fire again within this long of it — otherwise a deploy
// that happens to land a few minutes before the next :01 IST mark would
// trigger two full warm-up runs (40+ LLM/TTS calls each) back to back.
const MIN_GAP_MS = 10 * 60 * 1000;
let lastRunAt = 0;

/**
 * Runs once an hour, aligned to :01 IST, keeping the (in-memory, per-process)
 * top-news/translation/summary/TTS caches warm for English and Hindi so real
 * visitors almost never pay first-request LLM/TTS latency anywhere in the
 * app. Also runs once immediately on startup — instrumentation.ts calls this
 * as soon as the server process boots, which is right after every deploy —
 * so a fresh deploy never sits cold until the next aligned hour. Only useful
 * on a single always-on server process — see the conversation this was
 * built from for why a multi-instance/ephemeral deployment would need a
 * shared external cache instead of this in-process scheduler.
 */
export function startCacheWarmer(): void {
  if (started) return;
  started = true;

  const runAndSwallow = () => {
    lastRunAt = Date.now();
    runCacheWarmOnce().catch((err) => console.error("[cache-warmer] run failed:", err));
  };

  // Warm immediately on boot (covers every deploy/restart) instead of
  // waiting for the next aligned mark.
  runAndSwallow();

  const scheduleNext = () => {
    setTimeout(() => {
      if (Date.now() - lastRunAt >= MIN_GAP_MS) runAndSwallow();
      setInterval(() => {
        if (Date.now() - lastRunAt >= MIN_GAP_MS) runAndSwallow();
      }, HOUR_MS);
    }, msUntilNextAlignedRun());
  };
  scheduleNext();
}

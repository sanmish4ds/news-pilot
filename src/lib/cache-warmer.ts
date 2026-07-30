import { refreshTopNews } from "./news/top-news-service";
import { NewsInput, translateNewsForLanguage } from "./news/translate-service";

// The app only supports English and Hindi (see languages.ts) — English needs
// no LLM call, Hindi costs a handful of translation calls plus a TTS
// bulletin synthesis.
const WARM_LANGUAGES = ["en", "hi"];

const HOUR_MS = 60 * 60 * 1000;
// IST is UTC+5:30, so "every hour at :01 IST" lands on minute 31 of every
// UTC hour, independent of which UTC hour it is.
const TARGET_MINUTE_UTC = 31;

let started = false;

export interface WarmRunResult {
  startedAt: string;
  finishedAt: string;
  date: string;
  newsCount: number;
  languages: { code: string; ok: boolean; error?: string }[];
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

  const languages: WarmRunResult["languages"] = [];
  for (const code of WARM_LANGUAGES) {
    try {
      await translateNewsForLanguage(newsInput, code, entry.date);
      languages.push({ code, ok: true });
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

/**
 * Runs once an hour, aligned to :01 IST, keeping the (in-memory, per-process)
 * top-news/translation/TTS caches warm for English and Hindi so real
 * visitors almost never pay the first-request LLM/TTS latency. Only
 * useful on a single always-on server process — see the conversation this
 * was built from for why a multi-instance/ephemeral deployment would need a
 * shared external cache instead of this in-process scheduler.
 */
export function startCacheWarmer(): void {
  if (started) return;
  started = true;

  const runAndSwallow = () => {
    runCacheWarmOnce().catch((err) => console.error("[cache-warmer] run failed:", err));
  };

  const scheduleNext = () => {
    setTimeout(() => {
      runAndSwallow();
      setInterval(runAndSwallow, HOUR_MS);
    }, msUntilNextAlignedRun());
  };
  scheduleNext();
}

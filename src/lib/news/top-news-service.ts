import { fetchTopIndiaNews, TopNewsItem } from "./top-news";
import { generateBriefSummaries } from "./brief-summaries";

export interface TopNewsCacheEntry {
  news: TopNewsItem[];
  date: string;
  fetchedAt: number;
}

// Longer than the hourly cache-warmer's cadence (see cache-warmer.ts) plus a
// buffer, so a warm-up run's result stays valid for real visitors right up
// until the next run replaces it.
const CACHE_TTL_MS = 75 * 60 * 1000;

// Module-level cache — `dynamic = "force-dynamic"` on the route opts it out
// of Next's built-in data cache, so a live RSS fetch (Google News) would
// otherwise run on every request. This keeps repeat loads within a warm
// server instance near-instant instead of re-hitting the feeds.
let cache: TopNewsCacheEntry | null = null;

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// Guards against firing a second background brief-summary generation while
// one is already in flight for the current cache window (e.g. the client's
// enrichment poll landing while the first request's own background job
// hasn't finished yet).
let briefsInFlight: Promise<void> | null = null;

/** Kicks off brief-summary generation without blocking the caller, then patches the
 * warm cache in place once done so the next read within the cache window is enriched. */
function warmBriefSummaries(news: TopNewsItem[], date: string, fetchedAt: number): void {
  if (briefsInFlight) return;
  briefsInFlight = generateBriefSummaries(news)
    .then((briefs) => {
      // Bail if a newer fetch (e.g. a forced refresh) has since replaced the cache.
      if (!cache || cache.fetchedAt !== fetchedAt) return;
      cache = {
        news: news.map((item) => ({ ...item, snippet: briefs[item.id] || item.snippet })),
        date,
        fetchedAt,
      };
    })
    .catch(() => {
      /* headlines alone are a fine fallback — leave snippets empty */
    })
    .finally(() => {
      briefsInFlight = null;
    });
}

/** Returns the cache only if still within its freshness window — never triggers a fetch. */
export function getFreshTopNews(): TopNewsCacheEntry | null {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  return null;
}

/** Returns whatever is cached regardless of freshness — a stale result beats a hard failure. */
export function getStaleTopNews(): TopNewsCacheEntry | null {
  return cache;
}

/**
 * Fetches fresh headlines and replaces the cache unconditionally. Used both
 * by the on-demand route (when its cache has expired) and by the hourly
 * cache-warmer (which always wants a fresh pull, not a cache hit).
 */
export async function refreshTopNews(limit = 20): Promise<TopNewsCacheEntry> {
  const news = await fetchTopIndiaNews(limit);
  if (!news.length) {
    if (cache) return cache;
    throw new Error("Could not fetch news feeds. Try again in a moment.");
  }

  const date = formatDate();
  const fetchedAt = Date.now();
  cache = { news, date, fetchedAt };
  // Respond with headlines immediately — per-story one-sentence summaries are
  // a nicety (the UI falls back to the headline when snippet is blank) and
  // generating them is an LLM call that would otherwise block the caller by
  // several seconds. Fill them in the background instead.
  warmBriefSummaries(news, date, fetchedAt);
  return cache;
}

/** Cache hit, or a fresh fetch if expired/empty — the read path used by the on-demand route. */
export async function getOrRefreshTopNews(limit = 20): Promise<TopNewsCacheEntry> {
  const fresh = getFreshTopNews();
  if (fresh) return fresh;
  try {
    return await refreshTopNews(limit);
  } catch (error) {
    const stale = getStaleTopNews();
    if (stale) return stale;
    throw error;
  }
}

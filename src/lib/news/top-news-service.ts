import { fetchTopIndiaNews, TopNewsItem } from "./top-news";
import { generateBriefSummaries } from "./brief-summaries";

export interface TopNewsCacheEntry {
  news: TopNewsItem[];
  date: string;
  fetchedAt: number;
}

// Long enough that a single day's news translates/summarizes/synthesizes
// exactly once — the first visitor of the window pays the real cost, every
// request after that (from any visitor) reuses the same cached result
// instead of triggering a duplicate call.
const CACHE_TTL_MS = 25 * 60 * 60 * 1000;

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
// one is already in flight for the current cache window (e.g. two visitors'
// requests landing close together before the first one's enrichment has
// finished).
let briefsInFlight: Promise<void> | null = null;

/** Kicks off brief-summary generation without blocking the caller, then patches the
 * cache in place once done so the next read within the cache window is enriched. */
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

async function refreshTopNews(limit: number): Promise<TopNewsCacheEntry> {
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

/** Cache hit, or a fresh fetch if expired/empty/never fetched — the only entry point
 * into top-news, so a given day's headlines are ever fetched exactly once. */
export async function getOrRefreshTopNews(limit = 20): Promise<TopNewsCacheEntry> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  try {
    return await refreshTopNews(limit);
  } catch (error) {
    if (cache) return cache;
    throw error;
  }
}

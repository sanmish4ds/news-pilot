import Parser from "rss-parser";

const parser = new Parser();

export interface TopNewsItem {
  id: string;
  rank: number;
  title: string;
  source: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "News";
  }
}

function parseGoogleTitle(raw: string): { title: string; source: string } {
  const match = raw.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) return { title: match[1].trim(), source: match[2].trim() };
  return { title: raw.trim(), source: "News" };
}

// Google News' front feed tends to over-represent markets/earnings coverage
// (quarterly results, stock moves, corporate financing deals) relative to
// how much of the day's actual news agenda they are. Matched against the
// headline only (cheap, no LLM call) — deliberately narrow to stock-market
// and corporate-earnings language specifically, not economic policy news
// (budget, RBI rate decisions, inflation data are left uncapped since
// they're broad public-interest stories, not portfolio-page filler).
const FINANCIAL_KEYWORDS = [
  /\bq[1-4]\s*results?\b/i,
  /\bquarterly\s+results?\b/i,
  /\bstock(s)?\b/i,
  /\bshares?\b/i,
  /\bsensex\b/i,
  /\bnifty\b/i,
  /\bipo\b/i,
  /\bmarket\s*cap\b/i,
  /\bearnings\b/i,
  /\brevenue\s+(up|down|grows?|jumps?|falls?)\b/i,
  /\bprofit\s+(up|down|grows?|jumps?|falls?|margin)\b/i,
  /\bbse\b|\bnse\b/i,
  /\bmutual\s+funds?\b/i,
  /\bdemat\b/i,
  /\btrading\s+(session|volumes?)\b/i,
];

function isFinancialNews(title: string): boolean {
  return FINANCIAL_KEYWORDS.some((re) => re.test(title));
}

export async function fetchTopIndiaNews(limit = 20): Promise<TopNewsItem[]> {
  // Primary: Google News India's own curated "top stories" feed — this is
  // already Google's trending/national ranking for India and typically
  // returns 30-40 items, plenty for `limit`. A broad "India when:1d" keyword
  // search was previously used as a second source, but it pulled in a lot of
  // loosely-related/hyperlocal stories (anything merely mentioning "India"),
  // so it's kept only as a last-resort filler if the primary feed comes up
  // short.
  const feeds = [
    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=India+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
  ];

  // Pull a larger candidate pool than `limit` so financial stories that
  // exceed the cap below can be skipped in favor of the next non-financial
  // story further down the feed, instead of just truncating the list short.
  const poolSize = limit * 3;

  const seen = new Set<string>();
  const candidates: Omit<TopNewsItem, "id" | "rank">[] = [];

  for (const feedUrl of feeds) {
    if (candidates.length >= poolSize) break;
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        if (candidates.length >= poolSize) break;
        if (!item.title || !item.link) continue;

        const { title, source } = parseGoogleTitle(item.title);
        const key = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          title,
          source: source || extractDomain(item.link),
          url: item.link,
          // Google News' `contentSnippet` for this feed is a "related coverage"
          // cluster — several *different* stories' headlines and outlet names
          // flattened into one blob (e.g. "...Highlights  NDTV  Rahul Gandhi's
          // remarks...  The Times of India  ..."). It's not a real summary of
          // this story, so leave it blank here — the display falls back to
          // the headline, and non-English translation just works from the
          // headline instead of that misleading cluster text.
          snippet: "",
          publishedAt: item.pubDate,
        });
      }
    } catch {
      /* try next feed */
    }
  }

  // Cap financial/markets stories at ~5% of the final list (rounded up to at
  // least 1) instead of excluding them outright — walk the pool in its
  // original ranked order and skip financial items once the cap is hit,
  // backfilling with the next non-financial candidate.
  const maxFinancial = Math.max(1, Math.round(limit * 0.05));
  let financialCount = 0;
  const selected: Omit<TopNewsItem, "id" | "rank">[] = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (isFinancialNews(candidate.title)) {
      if (financialCount >= maxFinancial) continue;
      financialCount++;
    }
    selected.push(candidate);
  }

  // If the cap left the list short (e.g. a feed dominated by financial
  // stories beyond what the pool could backfill), fill remaining slots from
  // whatever's left over rather than returning fewer than `limit` items.
  if (selected.length < limit) {
    const selectedTitles = new Set(selected.map((s) => s.title));
    for (const candidate of candidates) {
      if (selected.length >= limit) break;
      if (selectedTitles.has(candidate.title)) continue;
      selected.push(candidate);
    }
  }

  return selected.slice(0, limit).map((item, i) => ({
    id: `news-${i + 1}`,
    rank: i + 1,
    ...item,
  }));
}

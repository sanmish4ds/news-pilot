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

  const seen = new Set<string>();
  const items: TopNewsItem[] = [];

  for (const feedUrl of feeds) {
    if (items.length >= limit) break;
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        if (items.length >= limit) break;
        if (!item.title || !item.link) continue;

        const { title, source } = parseGoogleTitle(item.title);
        const key = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);

        items.push({
          id: `news-${items.length + 1}`,
          rank: items.length + 1,
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

  return items.slice(0, limit);
}

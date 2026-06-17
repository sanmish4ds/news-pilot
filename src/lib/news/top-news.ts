import Parser from "rss-parser";
import { extractDomain } from "./scraper";

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

function parseGoogleTitle(raw: string): { title: string; source: string } {
  const match = raw.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) return { title: match[1].trim(), source: match[2].trim() };
  return { title: raw.trim(), source: "News" };
}

export async function fetchTop10IndiaNews(): Promise<TopNewsItem[]> {
  const feeds = [
    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=India+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
  ];

  const seen = new Set<string>();
  const items: TopNewsItem[] = [];

  for (const feedUrl of feeds) {
    if (items.length >= 10) break;
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        if (items.length >= 10) break;
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
          snippet: item.contentSnippet || "",
          publishedAt: item.pubDate,
        });
      }
    } catch {
      /* try next feed */
    }
  }

  return items.slice(0, 10);
}

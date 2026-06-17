import Parser from "rss-parser";
import { NewsArticle } from "./types";
import { extractDomain } from "./scraper";

const parser = new Parser({
  customFields: {
    item: ["source"],
  },
});

function parseGoogleNewsTitle(rawTitle: string): { title: string; source: string } {
  const match = rawTitle.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    return { title: match[1].trim(), source: match[2].trim() };
  }
  return { title: rawTitle.trim(), source: "Google News" };
}

function timeRangeToWhen(timeRange: "any" | "day" | "week" | "month"): string | null {
  switch (timeRange) {
    case "day":
      return "1d";
    case "week":
      return "7d";
    case "month":
      return "1m";
    default:
      return null;
  }
}

export async function searchGoogleNewsIndia(
  query: string,
  maxResults = 15,
  timeRange: "any" | "day" | "week" | "month" = "any"
): Promise<NewsArticle[]> {
  const when = timeRangeToWhen(timeRange);
  const params = new URLSearchParams({
    q: query,
    hl: "en-IN",
    gl: "IN",
    ceid: "IN:en",
  });
  if (when) params.set("when", when);

  const rssUrl = `https://news.google.com/rss/search?${params.toString()}`;

  try {
    const feed = await parser.parseURL(rssUrl);
    const articles: NewsArticle[] = [];

    for (const item of feed.items.slice(0, maxResults)) {
      if (!item.title || !item.link) continue;

      const { title, source } = parseGoogleNewsTitle(item.title);

      articles.push({
        id: `gn-${Buffer.from(item.link).toString("base64url").slice(0, 12)}`,
        title,
        url: item.link,
        snippet: item.contentSnippet || item.content || "",
        source: source || extractDomain(item.link),
        publishedAt: item.pubDate,
        origin: "google-news",
      });
    }

    return articles;
  } catch {
    return [];
  }
}

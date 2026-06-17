import * as cheerio from "cheerio";
import { NewsArticle } from "./types";
import { extractDomain } from "./scraper";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function searchDuckDuckGoNews(
  query: string,
  maxResults = 10
): Promise<NewsArticle[]> {
  const searchQuery = `${query} India news site:thehindu.com OR site:indianexpress.com OR site:ndtv.com OR site:hindustantimes.com OR site:thewire.in OR site:scroll.in OR site:livemint.com`;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const articles: NewsArticle[] = [];

    $(".result").each((index, element) => {
      if (articles.length >= maxResults) return false;

      const titleEl = $(element).find(".result__a");
      const snippetEl = $(element).find(".result__snippet");
      const href = titleEl.attr("href");
      const title = titleEl.text().trim();

      if (!href || !title) return;

      let finalUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        finalUrl = decodeURIComponent(uddgMatch[1]);
      }

      articles.push({
        id: `ddg-${index}-${Buffer.from(finalUrl).toString("base64url").slice(0, 8)}`,
        title,
        url: finalUrl,
        snippet: snippetEl.text().trim(),
        source: extractDomain(finalUrl),
        origin: "web",
      });
    });

    return articles;
  } catch {
    return [];
  }
}

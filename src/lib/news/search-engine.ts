import { searchGoogleNewsIndia } from "./google-news";
import { searchSerperNews } from "./serper";
import { searchDuckDuckGoNews } from "./duckduckgo";
import { scrapeArticles, isIndianNewsUrl } from "./scraper";
import { NewsArticle, NewsSearchOptions, NewsSearchResult } from "./types";

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const key = normalizeTitle(article.title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

function extractUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return [...new Set(text.match(urlRegex) || [])];
}

export async function comprehensiveNewsSearch(
  options: NewsSearchOptions
): Promise<NewsSearchResult> {
  const {
    query,
    maxResults = 20,
    scrapeArticles: shouldScrape = true,
    scrapeLimit = 8,
    timeRange = "any",
    indiaOnly = true,
    includeWeb = true,
  } = options;

  const sourcesUsed: string[] = [];
  let allArticles: NewsArticle[] = [];

  const [googleNews, serperNews, ddgNews] = await Promise.all([
    searchGoogleNewsIndia(query, maxResults, timeRange),
    searchSerperNews(query, Math.min(maxResults, 12), indiaOnly),
    includeWeb ? searchDuckDuckGoNews(query, 8) : Promise.resolve([]),
  ]);

  if (googleNews.length > 0) sourcesUsed.push("Google News India");
  if (serperNews.length > 0) sourcesUsed.push("Serper News");
  if (ddgNews.length > 0) sourcesUsed.push("DuckDuckGo Web");

  allArticles = deduplicateArticles([...googleNews, ...serperNews, ...ddgNews]);

  if (indiaOnly) {
    allArticles = allArticles.filter((article) => {
      if (article.origin === "google-news" || article.origin === "serper") return true;
      return isIndianNewsUrl(article.url);
    });
  }

  allArticles = allArticles.slice(0, maxResults);

  let scrapedCount = 0;

  if (shouldScrape && allArticles.length > 0) {
    sourcesUsed.push("Article Scraper");
    const urlsToScrape = allArticles.map((a) => a.url);
    const scraped = await scrapeArticles(urlsToScrape, scrapeLimit);

    allArticles = allArticles.map((article) => {
      const scrapeResult = scraped.get(article.url);
      if (!scrapeResult) return article;

      if (scrapeResult.content) {
        scrapedCount++;
        return {
          ...article,
          url: scrapeResult.finalUrl,
          content: scrapeResult.content,
          scraped: true,
        };
      }

      return {
        ...article,
        scraped: false,
        scrapeError: scrapeResult.error,
      };
    });
  }

  return {
    query,
    articles: allArticles,
    scrapedCount,
    sourcesUsed,
    searchedAt: new Date().toISOString(),
  };
}

export async function searchFromUrls(urls: string[]): Promise<NewsArticle[]> {
  const scraped = await scrapeArticles(urls, urls.length);

  return urls.map((url, index) => {
    const result = scraped.get(url);
    const domain = new URL(url).hostname.replace(/^www\./, "");

    return {
      id: `url-${index}`,
      title: result?.content?.slice(0, 80) || `Article from ${domain}`,
      url: result?.finalUrl || url,
      snippet: result?.content?.slice(0, 200) || "",
      source: domain,
      origin: "direct-url" as const,
      scraped: !!result?.content,
      content: result?.content || undefined,
      scrapeError: result?.error,
    };
  });
}

export function buildSearchContext(result: NewsSearchResult): string {
  const sections = result.articles.map((article, index) => {
    const parts = [
      `[${index + 1}] ${article.title}`,
      `Source: ${article.source}`,
      `URL: ${article.url}`,
      article.publishedAt ? `Published: ${article.publishedAt}` : "",
      article.snippet ? `Snippet: ${article.snippet}` : "",
      article.content ? `\nFull scraped content:\n${article.content.slice(0, 3500)}` : "",
      article.scrapeError ? `(Scrape note: ${article.scrapeError})` : "",
    ];
    return parts.filter(Boolean).join("\n");
  });

  return sections.join("\n\n---\n\n");
}

export { extractUrlsFromText };

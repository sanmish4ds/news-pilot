export type NewsSource = "google-news" | "serper" | "web" | "direct-url" | "manual";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
  origin: NewsSource;
  scraped?: boolean;
  content?: string;
  scrapeError?: string;
}

export interface NewsSearchOptions {
  query: string;
  maxResults?: number;
  scrapeArticles?: boolean;
  scrapeLimit?: number;
  timeRange?: "any" | "day" | "week" | "month";
  indiaOnly?: boolean;
  includeWeb?: boolean;
}

export interface NewsSearchResult {
  query: string;
  articles: NewsArticle[];
  scrapedCount: number;
  sourcesUsed: string[];
  searchedAt: string;
}

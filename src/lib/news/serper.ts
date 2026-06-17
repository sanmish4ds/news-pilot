import { NewsArticle } from "./types";

interface SerperNewsItem {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
  source?: string;
}

export async function searchSerperNews(
  query: string,
  maxResults = 10,
  indiaOnly = true
): Promise<NewsArticle[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const searchQuery = indiaOnly ? `${query} India news` : query;

  try {
    const response = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: "in",
        hl: "en",
        num: maxResults,
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { news?: SerperNewsItem[] };
    const items = data.news || [];

    return items.map((item, index) => ({
      id: `serper-${index}-${Buffer.from(item.link).toString("base64url").slice(0, 8)}`,
      title: item.title,
      url: item.link,
      snippet: item.snippet || "",
      source: item.source || "Web",
      publishedAt: item.date,
      origin: "serper" as const,
    }));
  } catch {
    return [];
  }
}

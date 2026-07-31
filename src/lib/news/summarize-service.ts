import { createServerCache, hashKey } from "@/lib/server-cache";

export interface SummaryParams {
  headline: string;
  snippet?: string;
  source?: string;
  url?: string;
  languageName?: string;
  languageNative?: string;
}

export interface SummaryResult {
  summary: string;
  scraped: boolean;
}

// Was 5000ms — full-length dead time paid on every uncached summary before
// generation even starts. Scraping is a nice-to-have for extra detail, not
// worth that much latency; cut it down so the wait is dominated by the LLM
// call instead of this budget.
const SCRAPE_BUDGET_MS = 3000;
// Same headline's summary is identical for everyone in the same language —
// cache it server-side so a page reload or a second visitor skips the
// scrape + LLM call once the first request has paid it, with no duplicate
// calls for the same story/language.
const SUMMARY_CACHE_TTL_MS = 25 * 60 * 60 * 1000;
export const summaryCache = createServerCache<SummaryResult>(SUMMARY_CACHE_TTL_MS);

export function summaryCacheKey(params: Pick<SummaryParams, "headline" | "source" | "url" | "languageName">): string {
  return hashKey(params.headline, params.source || "", params.url || "", params.languageName || "en");
}


// Loaded dynamically (and best-effort) so a bundling/runtime issue with the
// jsdom/cheerio/readability stack can never crash the caller — it just falls
// back to summarizing from the headline/snippet alone.
export async function scrapeWithBudget(url: string): Promise<string> {
  try {
    const { scrapeArticle } = await import("./scraper");
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SCRAPE_BUDGET_MS));
    const result = await Promise.race([scrapeArticle(url).catch(() => null), timeout]);
    return result?.content?.slice(0, 12000) || "";
  } catch {
    return "";
  }
}

export function buildSummaryUserMessage(params: SummaryParams, articleContent: string): string {
  const targetLanguage =
    params.languageName && params.languageName !== "English"
      ? `${params.languageName}${params.languageNative ? ` (${params.languageNative})` : ""}`
      : "";

  return `
HEADLINE: ${params.headline}
SOURCE: ${params.source || "Unknown"}
${params.snippet ? `SNIPPET: ${params.snippet}\n` : ""}
${articleContent ? `ARTICLE TEXT:\n${articleContent}` : "No full article text available — summarize based on the headline and snippet only."}
${targetLanguage ? `\nWrite the summary entirely in ${targetLanguage}, using its native script. Do not use English.` : ""}
  `.trim();
}

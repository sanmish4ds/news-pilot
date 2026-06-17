import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 12000;

const INDIAN_NEWS_DOMAINS = [
  "thehindu.com",
  "indianexpress.com",
  "hindustantimes.com",
  "ndtv.com",
  "timesofindia.indiatimes.com",
  "thewire.in",
  "scroll.in",
  "theprint.in",
  "livemint.com",
  "economictimes.indiatimes.com",
  "moneycontrol.com",
  "deccanherald.com",
  "firstpost.com",
  "news18.com",
  "indiatoday.in",
  "republicworld.com",
  "zeenews.india.com",
  "bbc.com",
  "reuters.com",
  "pib.gov.in",
  "ptinews.com",
  "business-standard.com",
  "thequint.com",
  "newslaundry.com",
  "outlookindia.com",
];

export function isIndianNewsUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return INDIAN_NEWS_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function extractWithReadability(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article?.textContent) return null;
  return article.textContent.replace(/\s+/g, " ").trim();
}

function extractWithCheerio(html: string): string | null {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, .ad, .advertisement, .social-share").remove();

  const selectors = [
    "article",
    "[role='main']",
    ".article-body",
    ".story-content",
    ".article-content",
    ".entry-content",
    ".post-content",
    ".content-body",
    "#article-body",
    "main",
  ];

  for (const selector of selectors) {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    if (text.length > 400) return text.slice(0, 8000);
  }

  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((p) => p.length > 60)
    .join(" ");

  return paragraphs.length > 200 ? paragraphs.slice(0, 8000) : null;
}

export async function resolveFinalUrl(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(url);
    return response.url || url;
  } catch {
    return url;
  }
}

export async function scrapeArticle(url: string): Promise<{
  content: string | null;
  finalUrl: string;
  error?: string;
}> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return {
        content: null,
        finalUrl: response.url || url,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        content: null,
        finalUrl: response.url || url,
        error: "Not an HTML page",
      };
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    const readabilityContent = extractWithReadability(html, finalUrl);
    const content = readabilityContent || extractWithCheerio(html);

    if (!content || content.length < 150) {
      return {
        content: null,
        finalUrl,
        error: "Could not extract article text",
      };
    }

    return { content, finalUrl };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return { content: null, finalUrl: url, error: message };
  }
}

export async function scrapeArticles(
  urls: string[],
  limit = 8
): Promise<Map<string, { content: string | null; finalUrl: string; error?: string }>> {
  const results = new Map<
    string,
    { content: string | null; finalUrl: string; error?: string }
  >();

  const batch = urls.slice(0, limit);
  const settled = await Promise.allSettled(
    batch.map(async (url) => {
      const result = await scrapeArticle(url);
      return { url, ...result };
    })
  );

  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.set(item.value.url, {
        content: item.value.content,
        finalUrl: item.value.finalUrl,
        error: item.value.error,
      });
    }
  }

  return results;
}

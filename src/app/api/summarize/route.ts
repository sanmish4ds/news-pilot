import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const SCRAPE_BUDGET_MS = 5000;

// Loaded dynamically (and best-effort) so a bundling/runtime issue with the
// jsdom/cheerio/readability stack can never crash this route — it just
// falls back to summarizing from the headline/snippet alone.
async function scrapeWithBudget(url: string): Promise<string> {
  try {
    const { scrapeArticle } = await import("@/lib/news/scraper");
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SCRAPE_BUDGET_MS));
    const result = await Promise.race([scrapeArticle(url).catch(() => null), timeout]);
    return result?.content?.slice(0, 8000) || "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { headline, snippet, source, url, languageName, languageNative } = (await req.json()) as {
      headline?: string;
      snippet?: string;
      source?: string;
      url?: string;
      languageName?: string;
      languageNative?: string;
    };

    if (!headline?.trim()) {
      return NextResponse.json({ error: "Headline is required." }, { status: 400 });
    }

    const articleContent = url?.trim() ? await scrapeWithBudget(url.trim()) : "";

    const client = getOpenAIClient();

    const targetLanguage =
      languageName && languageName !== "English"
        ? `${languageName}${languageNative ? ` (${languageNative})` : ""}`
        : "";

    const userMessage = `
HEADLINE: ${headline}
SOURCE: ${source || "Unknown"}
${snippet ? `SNIPPET: ${snippet}\n` : ""}
${articleContent ? `ARTICLE TEXT:\n${articleContent}` : "No full article text available — summarize based on the headline and snippet only."}
${targetLanguage ? `\nWrite the summary entirely in ${targetLanguage}, using its native script. Do not use English.` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.headlineSummary },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ summary, scraped: !!articleContent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Summarize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

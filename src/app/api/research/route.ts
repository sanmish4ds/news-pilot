import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";
import {
  buildSearchContext,
  comprehensiveNewsSearch,
  extractUrlsFromText,
  searchFromUrls,
} from "@/lib/news/search-engine";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { sources, topic, searchWeb = false } = await req.json();

    if (!sources && !topic) {
      return NextResponse.json(
        { error: "Please provide source material or a topic." },
        { status: 400 }
      );
    }

    let gatheredSources = sources || "";
    let searchMeta = "";

    if (searchWeb && topic) {
      const directUrls = extractUrlsFromText(topic + " " + (sources || ""));
      let searchResult;

      if (directUrls.length > 0) {
        const urlArticles = await searchFromUrls(directUrls.slice(0, 5));
        searchResult = {
          query: topic,
          articles: urlArticles,
          scrapedCount: urlArticles.filter((a) => a.scraped).length,
          sourcesUsed: ["Direct URL Scraper"],
          searchedAt: new Date().toISOString(),
        };
      } else {
        searchResult = await comprehensiveNewsSearch({
          query: topic,
          maxResults: 12,
          scrapeArticles: true,
          scrapeLimit: 6,
          timeRange: "week",
          indiaOnly: true,
          includeWeb: true,
        });
      }

      if (searchResult.articles.length > 0) {
        const webContext = buildSearchContext(searchResult);
        gatheredSources = gatheredSources
          ? `${gatheredSources}\n\n--- WEB SEARCH RESULTS ---\n\n${webContext}`
          : webContext;
        searchMeta = `Web search: ${searchResult.articles.length} articles found, ${searchResult.scrapedCount} scraped from ${searchResult.sourcesUsed.join(", ")}`;
      }
    }

    const client = getOpenAIClient();

    const userMessage = `
${topic ? `TOPIC/BRIEF: ${topic}\n` : ""}
${gatheredSources ? `SOURCE MATERIAL:\n${gatheredSources}` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.research },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2500,
    });

    const content = response.choices[0]?.message?.content || "";

    return NextResponse.json({ result: content, searchMeta: searchMeta || undefined });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

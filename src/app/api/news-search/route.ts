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
    const {
      query,
      maxResults = 20,
      scrapeArticles = true,
      scrapeLimit = 8,
      timeRange = "any",
      indiaOnly = true,
      includeWeb = true,
      synthesize = true,
    } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: "Please enter a search query." }, { status: 400 });
    }

    const directUrls = extractUrlsFromText(query);
    let searchResult;

    if (directUrls.length > 0 && query.trim().split(/\s+/).length <= 3) {
      const urlArticles = await searchFromUrls(directUrls);
      searchResult = {
        query,
        articles: urlArticles,
        scrapedCount: urlArticles.filter((a) => a.scraped).length,
        sourcesUsed: ["Direct URL Scraper"],
        searchedAt: new Date().toISOString(),
      };
    } else {
      searchResult = await comprehensiveNewsSearch({
        query: query.trim(),
        maxResults,
        scrapeArticles,
        scrapeLimit,
        timeRange,
        indiaOnly,
        includeWeb,
      });
    }

    if (searchResult.articles.length === 0) {
      return NextResponse.json({
        search: searchResult,
        synthesis: null,
        message: "No articles found. Try a different query or broader time range.",
      });
    }

    let synthesis: string | null = null;

    if (synthesize) {
      const client = getOpenAIClient();
      const context = buildSearchContext(searchResult);

      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.newsSearch },
          {
            role: "user",
            content: `SEARCH QUERY: ${searchResult.query}\n\nSOURCES SEARCHED: ${searchResult.sourcesUsed.join(", ")}\nARTICLES FOUND: ${searchResult.articles.length}\nSCRAPED: ${searchResult.scrapedCount}\n\n---\n\n${context}`,
          },
        ],
        max_tokens: 3000,
      });

      synthesis = response.choices[0]?.message?.content || null;
    }

    return NextResponse.json({
      search: searchResult,
      synthesis,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

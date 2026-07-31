import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, OPENAI_MINI_MODEL, SYSTEM_PROMPTS } from "@/lib/openai";
import {
  buildSummaryUserMessage,
  scrapeWithBudget,
  summaryCache,
  summaryCacheKey,
} from "@/lib/news/summarize-service";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

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

    const params = { headline, snippet, source, url, languageName, languageNative };
    const cacheKey = summaryCacheKey(params);
    const cached = summaryCache.get(cacheKey);
    if (cached) {
      // Still stream cached hits through the same plain-text protocol the
      // client expects — it's just one chunk instead of many. A cache hit
      // here means some prior visitor already paid for this exact summary.
      return new NextResponse(cached.summary, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Scraped": cached.scraped ? "1" : "0" },
      });
    }

    const articleContent = url?.trim() ? await scrapeWithBudget(url.trim()) : "";
    const client = getOpenAIClient();
    const userMessage = buildSummaryUserMessage(params, articleContent);

    // Streamed instead of a single blocking create() call — a thorough
    // 2-4 paragraph summary can take several seconds to generate in full,
    // and the old behavior showed nothing at all until every token was
    // done. Streaming shows the summary as it's written, which is most of
    // the perceived "summarizing is slow" fix (the actual generation time
    // doesn't change, but the wait no longer feels dead).
    const openaiStream = await client.chat.completions.create({
      model: OPENAI_MINI_MODEL,
      max_tokens: 1000,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.headlineSummary },
        { role: "user", content: userMessage },
      ],
    });

    let full = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
          summaryCache.set(cacheKey, { summary: full.trim(), scraped: !!articleContent });
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        openaiStream.controller.abort();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Scraped": articleContent ? "1" : "0",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Summarize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

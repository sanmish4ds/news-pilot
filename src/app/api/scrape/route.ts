import { NextRequest, NextResponse } from "next/server";
import { scrapeArticle } from "@/lib/news/scraper";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }

    const result = await scrapeArticle(parsedUrl.toString());

    return NextResponse.json({
      url: result.finalUrl,
      content: result.content,
      error: result.error,
      scraped: !!result.content,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { fetchTopIndiaNews, TopNewsItem } from "@/lib/news/top-news";
import { generateBriefSummaries } from "@/lib/news/brief-summaries";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Module-level cache — `dynamic = "force-dynamic"` opts this route out of
// Next's built-in data cache, so a live RSS fetch (Google News) would
// otherwise run on every request. This keeps repeat loads within a warm
// server instance near-instant instead of re-hitting the feeds.
let cache: { news: TopNewsItem[]; date: string; fetchedAt: number } | null = null;

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ news: cache.news, date: cache.date });
  }

  try {
    const news = await fetchTopIndiaNews(20);
    if (!news.length) {
      if (cache) {
        // Stale cache beats a hard failure.
        return NextResponse.json({ news: cache.news, date: cache.date });
      }
      return NextResponse.json(
        { error: "Could not fetch news feeds. Try again in a moment." },
        { status: 503 }
      );
    }
    const briefs = await generateBriefSummaries(news);
    const newsWithBriefs = news.map((item) => ({
      ...item,
      snippet: briefs[item.id] || item.snippet,
    }));

    const date = formatDate();
    cache = { news: newsWithBriefs, date, fetchedAt: Date.now() };
    return NextResponse.json({ news: newsWithBriefs, date });
  } catch (error: unknown) {
    if (cache) {
      return NextResponse.json({ news: cache.news, date: cache.date });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

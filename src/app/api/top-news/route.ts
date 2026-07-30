import { NextResponse } from "next/server";
import { getOrRefreshTopNews } from "@/lib/news/top-news-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entry = await getOrRefreshTopNews(20);
    return NextResponse.json({ news: entry.news, date: entry.date });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

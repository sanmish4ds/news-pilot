import { NextResponse } from "next/server";
import { fetchTop10IndiaNews } from "@/lib/news/top-news";

export const dynamic = "force-dynamic";
export const revalidate = 900; // cache 15 minutes

export async function GET() {
  try {
    const news = await fetchTop10IndiaNews();
    if (!news.length) {
      return NextResponse.json(
        { error: "Could not fetch news feeds. Try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      news,
      date: new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

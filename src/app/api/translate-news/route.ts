import { NextRequest, NextResponse } from "next/server";
import { NewsInput, translateNewsForLanguage } from "@/lib/news/translate-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { news, languageCode, dateLabel = "today" } = (await req.json()) as {
      news: NewsInput[];
      languageCode: string;
      dateLabel?: string;
    };

    if (!news?.length) {
      return NextResponse.json({ error: "No news to translate" }, { status: 400 });
    }

    const result = await translateNewsForLanguage(news, languageCode, dateLabel);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    const status = message === "Unknown language" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

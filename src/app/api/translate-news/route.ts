import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getLanguageByCode } from "@/lib/languages";
import { buildTranslationSystemPrompt } from "@/lib/translation-prompts";
import { englishUi, UiStrings } from "@/lib/ui-strings";
import { stitchBulletinFallback } from "@/lib/radio-bulletin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface NewsInput {
  id: string;
  rank: number;
  title: string;
  source: string;
  snippet: string;
}

interface TranslatedNewsItem {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  source: string;
}

interface TranslationPayload {
  news: TranslatedNewsItem[];
  ui?: UiStrings;
  bulletinScript?: string;
}

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

    const lang = getLanguageByCode(languageCode);
    if (!lang) {
      return NextResponse.json({ error: "Unknown language" }, { status: 400 });
    }

    const { ui: enUi } = englishUi(news.length);

    // English — instant, no GPT
    if (languageCode === "en") {
      const translated = news.map((item) => ({
        id: item.id,
        rank: item.rank,
        headline: item.title,
        summary: item.snippet || item.title,
        source: item.source,
      }));
      const bulletinScript = stitchBulletinFallback(lang, translated, dateLabel);
      return NextResponse.json({ news: translated, ui: enUi, bulletinScript, language: lang });
    }

    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildTranslationSystemPrompt(lang, news.length, dateLabel),
        },
        {
          role: "user",
          content: JSON.stringify(news),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3500,
      temperature: 0.4,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as TranslationPayload;

    if (!Array.isArray(parsed.news) || parsed.news.length === 0) {
      throw new Error("Translation returned no results");
    }

    let bulletinScript = parsed.bulletinScript?.trim() || "";
    if (bulletinScript.length < 100) {
      bulletinScript = stitchBulletinFallback(lang, parsed.news, dateLabel);
    }

    return NextResponse.json({
      news: parsed.news,
      ui: parsed.ui || enUi,
      bulletinScript,
      language: lang,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

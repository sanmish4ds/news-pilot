import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, claudeStructured } from "@/lib/anthropic";
import { getLanguageByCode } from "@/lib/languages";
import { buildNewsChunkPrompt, buildUiOnlyPrompt } from "@/lib/translation-prompts";
import { englishUi, UiStrings } from "@/lib/ui-strings";
import { stitchBulletinFallback } from "@/lib/radio-bulletin";

const NEWS_ITEM_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    rank: { type: "number" },
    headline: { type: "string" },
    summary: { type: "string" },
    source: { type: "string" },
  },
  required: ["id", "rank", "headline", "summary", "source"],
};

const UI_STRINGS_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    chooseLanguage: { type: "string" },
    playBulletin: { type: "string" },
    listenAllStories: { type: "string" },
    listenStory: { type: "string" },
    radioMode: { type: "string" },
    storiesMode: { type: "string" },
    pause: { type: "string" },
    stop: { type: "string" },
    refresh: { type: "string" },
    onAir: { type: "string" },
    preparingBulletin: { type: "string" },
    loadingNews: { type: "string" },
    preparingNews: { type: "string" },
    voiceBrowser: { type: "string" },
    voiceNotReady: { type: "string" },
    nowPlaying: { type: "string" },
    readyToPlay: { type: "string" },
    storyLabel: { type: "string" },
  },
  required: [
    "title", "subtitle", "chooseLanguage", "playBulletin", "listenAllStories", "listenStory",
    "radioMode", "storiesMode", "pause", "stop", "refresh", "onAir", "preparingBulletin",
    "loadingNews", "preparingNews", "voiceBrowser", "voiceNotReady", "nowPlaying", "readyToPlay",
    "storyLabel",
  ],
};

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

    const client = getAnthropicClient();

    // Listening/audio is English-only for now, so the bulletin script for
    // every other language is never shown — no need to ask the (slow) model
    // to write one. Translate the news array in small parallel chunks and
    // the UI labels in a separate parallel call; this is far faster than one
    // big serial completion, especially now that the feed can be 20 items.
    const CHUNK_SIZE = 2;
    const chunks: NewsInput[][] = [];
    for (let i = 0; i < news.length; i += CHUNK_SIZE) {
      chunks.push(news.slice(i, i + CHUNK_SIZE));
    }

    const newsChunkPrompt = buildNewsChunkPrompt(lang);
    const chunkPromises = chunks.map((chunk) =>
      claudeStructured<{ news: TranslatedNewsItem[] }>(client, {
        system: newsChunkPrompt,
        userContent: JSON.stringify(chunk),
        maxTokens: 800,
        toolName: "return_news",
        toolDescription: "Return the translated news items.",
        inputSchema: {
          type: "object",
          properties: { news: { type: "array", items: NEWS_ITEM_SCHEMA } },
          required: ["news"],
        },
      }).catch(() => ({ news: [] as TranslatedNewsItem[] }))
    );

    const uiPromise = claudeStructured<{ ui: UiStrings }>(client, {
      system: buildUiOnlyPrompt(lang, news.length),
      userContent: "Translate the UI labels.",
      maxTokens: 600,
      toolName: "return_ui_strings",
      toolDescription: "Return the translated UI label strings.",
      inputSchema: {
        type: "object",
        properties: { ui: UI_STRINGS_SCHEMA },
        required: ["ui"],
      },
    }).catch(() => ({ ui: enUi }));

    const [uiParsed, ...chunkResults] = await Promise.all([uiPromise, ...chunkPromises]);

    const translatedNews: TranslatedNewsItem[] = chunkResults
      .flatMap((r) => r.news || [])
      .sort((a, b) => a.rank - b.rank);

    if (translatedNews.length === 0) {
      throw new Error("Translation returned no results");
    }

    const bulletinScript = stitchBulletinFallback(lang, translatedNews, dateLabel);

    return NextResponse.json({
      news: translatedNews,
      ui: uiParsed.ui || enUi,
      bulletinScript,
      language: lang,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

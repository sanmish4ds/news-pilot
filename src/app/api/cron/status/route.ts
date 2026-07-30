import { NextRequest, NextResponse } from "next/server";
import { getStaleTopNews } from "@/lib/news/top-news-service";
import { NewsInput, isTranslationCached, peekTranslation } from "@/lib/news/translate-service";
import { isSummaryCached } from "@/lib/news/summarize-service";
import { isTtsCached } from "@/lib/tts-cache";
import { getLanguageByCode } from "@/lib/languages";
import { stitchBulletinFallback } from "@/lib/radio-bulletin";

export const dynamic = "force-dynamic";

const WARM_LANGUAGES = ["en", "hi"];
const LISTENING_ENABLED_CODES = new Set(["en", "hi"]);

/**
 * Read-only view of what the hourly cache-warmer has (and hasn't) actually
 * warmed, without regenerating anything — for verifying the job worked
 * instead of guessing from response times. Same CRON_SECRET gate as
 * /api/cron/warm-cache.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const provided =
      req.nextUrl.searchParams.get("secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const topNews = getStaleTopNews();
  if (!topNews) {
    return NextResponse.json({
      topNews: { cached: false },
      languages: [],
      note: "No top-news cache yet — trigger /api/cron/warm-cache or wait for the next hourly run.",
    });
  }

  const ageMinutes = Math.round((Date.now() - topNews.fetchedAt) / 60000);
  const newsInput: NewsInput[] = topNews.news.map((n) => ({
    id: n.id,
    rank: n.rank,
    title: n.title,
    source: n.source,
    snippet: n.snippet,
  }));
  const urlById = new Map(topNews.news.map((n) => [n.id, n.url]));

  const languages = WARM_LANGUAGES.map((code) => {
    const lang = getLanguageByCode(code);
    const translationCached = isTranslationCached(newsInput, code, topNews.date);

    // English is never cached (it's free to compute), so build its
    // effective translated view directly instead of via peekTranslation.
    const translated =
      code === "en"
        ? newsInput.map((n) => ({
            id: n.id,
            rank: n.rank,
            headline: n.title,
            summary: n.snippet || n.title,
            source: n.source,
          }))
        : peekTranslation(newsInput, code, topNews.date)?.news;

    let summariesWarmed = 0;
    if (lang && translated) {
      for (const item of translated) {
        if (isSummaryCached({ headline: item.headline, source: item.source, url: urlById.get(item.id), languageName: lang.name })) {
          summariesWarmed++;
        }
      }
    }

    let ttsCached = false;
    if (LISTENING_ENABLED_CODES.has(code) && lang && translated) {
      const bulletinScript = stitchBulletinFallback(lang, translated, topNews.date);
      ttsCached = isTtsCached(bulletinScript, code);
    }

    return {
      code,
      translationCached,
      summariesWarmed,
      summariesTotal: newsInput.length,
      ttsCached: LISTENING_ENABLED_CODES.has(code) ? ttsCached : null,
    };
  });

  return NextResponse.json({
    topNews: { cached: true, date: topNews.date, newsCount: topNews.news.length, ageMinutes },
    languages,
  });
}

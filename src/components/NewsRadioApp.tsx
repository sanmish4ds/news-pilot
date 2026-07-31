"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Square,
  Play,
  Pause,
  Loader2,
  Radio,
  X,
  ExternalLink,
} from "lucide-react";
import { ALL_LANGUAGES, ConstitutionalLanguage, PREWARM_CODES, getLanguageByCode } from "@/lib/languages";
import {
  fetchSpeechAudio,
  isBrowserSpeechSupported,
  speakWithBrowser,
  stopBrowserSpeech,
  waitForAudioReady,
} from "@/lib/audio-player";
import { DEFAULT_UI, UiStrings } from "@/lib/ui-strings";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";

interface RawNewsItem {
  id: string;
  rank: number;
  title: string;
  source: string;
  snippet: string;
  url: string;
}

interface TranslatedNewsItem {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  source: string;
}

type RadioState = "idle" | "loading" | "playing" | "paused";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SESSION_CACHE_TTL_MS = 15 * 60 * 1000;

/** Listening is available for English and Hindi — audio player controls show only for these languages. */
const LISTENING_ENABLED_CODES = new Set(["en", "hi"]);

const SUMMARY_PLAYBACK_LABEL = "Summary";

function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; cachedAt: number };
    if (Date.now() - parsed.cachedAt > SESSION_CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, cachedAt: Date.now() }));
  } catch {
    // sessionStorage full/unavailable — skip silently
  }
}

/** Clear cached translations/summaries — call whenever top-news actually refetches, since a
 * fresh headline set invalidates them even if the date label happens to be unchanged. */
function clearDerivedSessionCaches(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("np:translation:") || key.startsWith("np:summary:"))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function NewsRadioApp() {
  const [date, setDate] = useState("");
  const [rawNews, setRawNews] = useState<RawNewsItem[]>([]);
  const [news, setNews] = useState<TranslatedNewsItem[]>([]);
  // Paired together in one state update so a render can never see a script
  // from one language matched with a different, already-switched-to
  // language code (that mismatch was causing bogus TTS prefetch calls with
  // the wrong text/voice combination when switching languages quickly).
  const [bulletin, setBulletin] = useState<{ script: string; langCode: string }>({
    script: "",
    langCode: "",
  });
  const [ui, setUi] = useState<UiStrings>(DEFAULT_UI);
  const [language, setLanguage] = useState<ConstitutionalLanguage>(ALL_LANGUAGES[0]);
  const bulletinScript = bulletin.langCode === language.code ? bulletin.script : "";
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingLang, setLoadingLang] = useState(false);
  const [serverTtsReady, setServerTtsReady] = useState(false);
  const [browserSpeechReady, setBrowserSpeechReady] = useState(false);
  const [radioState, setRadioState] = useState<RadioState>("idle");
  const [audioPrefetched, setAudioPrefetched] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nowPlayingLabel, setNowPlayingLabel] = useState("");
  const [error, setError] = useState("");
  const [summaryItem, setSummaryItem] = useState<TranslatedNewsItem | null>(null);
  const [summaryUrl, setSummaryUrl] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryAudioLoading, setSummaryAudioLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  // Keyed by language code so switching languages and back reuses previously
  // synthesized bulletin audio instead of re-fetching it from the TTS API.
  const audioCacheRef = useRef<Map<string, { blob: Blob; script: string }>>(new Map());
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const playAbortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<{ id: string; text: string; label: string }[]>([]);
  const queueIndexRef = useRef(0);
  const queueActiveRef = useRef(false);
  const translationCacheRef = useRef<
    Map<string, { news: TranslatedNewsItem[]; ui?: UiStrings; bulletinScript?: string }>
  >(new Map());
  const summaryCacheRef = useRef<Map<string, string>>(new Map());
  const summaryAbortRef = useRef<AbortController | null>(null);
  // Bumped every time playback is stopped/superseded — any in-flight async
  // playback op checks this after each `await` and bails out silently if a
  // newer op has since started (e.g. the user switched language mid-fetch),
  // preventing two audio streams from ever overlapping.
  const playGenerationRef = useRef(0);

  const canListen = serverTtsReady || browserSpeechReady;
  const isOnAir = radioState === "playing" || radioState === "paused";

  // Resets transient playback UI (not the persistent per-language audio cache).
  const clearCache = useCallback(() => {
    setAudioPrefetched(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stopQueue = useCallback(() => {
    queueRef.current = [];
    queueIndexRef.current = 0;
    queueActiveRef.current = false;
  }, []);

  const stopPlayback = useCallback(() => {
    playGenerationRef.current += 1;
    if (playAbortRef.current) {
      playAbortRef.current.abort();
      playAbortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    stopBrowserSpeech();
    stopQueue();
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setNowPlayingLabel("");
  }, [stopQueue]);

  const stopRadio = useCallback(() => {
    stopPlayback();
    setRadioState("idle");
  }, [stopPlayback]);

  const playBlob = useCallback(
    async (blob: Blob, label: string, generation: number, onEnded?: () => void) => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audio.setAttribute("playsinline", "true");
      audio.preload = "auto";

      audio.onloadedmetadata = () => setDuration(audio.duration || 0);
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.onended = () => {
        if (playGenerationRef.current !== generation) return;
        if (onEnded) onEnded();
        else setRadioState("idle");
      };
      audio.onerror = () => {
        if (playGenerationRef.current !== generation) return;
        setError("Playback failed. Tap play again.");
        setRadioState("idle");
        stopQueue();
      };

      await waitForAudioReady(audio);
      // A newer playback action (e.g. the user switched language or hit play
      // elsewhere) superseded this one while we were awaiting — stop this
      // audio before it ever starts, instead of letting two streams overlap.
      if (playGenerationRef.current !== generation) {
        audio.pause();
        URL.revokeObjectURL(url);
        return;
      }
      audioRef.current = audio;
      setNowPlayingLabel(label);
      await audio.play();
      if (playGenerationRef.current !== generation) {
        audio.pause();
        return;
      }
      setRadioState("playing");
    },
    [stopQueue]
  );

  const fetchAndPlay = useCallback(
    async (text: string, label: string, onEnded?: () => void) => {
      stopPlayback();
      const generation = playGenerationRef.current;
      setRadioState("loading");
      setError("");

      try {
        if (serverTtsReady) {
          playAbortRef.current = new AbortController();
          const blob = await fetchSpeechAudio(
            text,
            language.code,
            playAbortRef.current.signal
          );
          if (playGenerationRef.current !== generation) return;
          await playBlob(blob, label, generation, onEnded);
        } else {
          setNowPlayingLabel(label);
          setRadioState("playing");
          await speakWithBrowser(text, language.code);
          if (playGenerationRef.current !== generation) return;
          if (onEnded) onEnded();
          else setRadioState("idle");
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        if (playGenerationRef.current !== generation) return;

        if (serverTtsReady && browserSpeechReady) {
          try {
            setNowPlayingLabel(label);
            setRadioState("playing");
            await speakWithBrowser(text, language.code);
            if (playGenerationRef.current !== generation) return;
            if (onEnded) onEnded();
            else setRadioState("idle");
            return;
          } catch {
            /* fall through */
          }
        }
        setError(err instanceof Error ? err.message : ui.voiceNotReady);
        setRadioState("idle");
        stopQueue();
      } finally {
        playAbortRef.current = null;
      }
    },
    [serverTtsReady, browserSpeechReady, language.code, playBlob, stopPlayback, ui.voiceNotReady, stopQueue]
  );

  const prefetchAudio = useCallback(
    async (script: string, langCode: string) => {
      if (!script || !serverTtsReady) return;
      const cached = audioCacheRef.current.get(langCode);
      if (cached && cached.script === script) {
        setAudioPrefetched(true);
        return;
      }

      prefetchAbortRef.current?.abort();
      const ac = new AbortController();
      prefetchAbortRef.current = ac;
      setPrefetching(true);
      setAudioPrefetched(false);

      try {
        const blob = await fetchSpeechAudio(script, langCode, ac.signal);
        if (ac.signal.aborted) return;
        audioCacheRef.current.set(langCode, { blob, script });
        setAudioPrefetched(true);
      } catch {
        if (!ac.signal.aborted) setAudioPrefetched(false);
      } finally {
        if (!ac.signal.aborted) setPrefetching(false);
        prefetchAbortRef.current = null;
      }
    },
    [serverTtsReady]
  );

  const playBulletin = useCallback(async () => {
    if (!bulletinScript?.trim()) {
      setError("Bulletin not ready yet.");
      return;
    }
    if (!canListen) {
      setError(ui.voiceNotReady);
      return;
    }

    if (radioState === "paused" && audioRef.current && !queueActiveRef.current) {
      try {
        await audioRef.current.play();
        setRadioState("playing");
      } catch {
        setError("Tap Play again.");
      }
      return;
    }

    stopQueue();

    if (serverTtsReady) {
      stopPlayback();
      const generation = playGenerationRef.current;
      setRadioState("loading");
      setError("");

      try {
        const cached = audioCacheRef.current.get(language.code);
        let blob = cached?.script === bulletinScript ? cached.blob : null;
        if (!blob) {
          playAbortRef.current = new AbortController();
          blob = await fetchSpeechAudio(
            bulletinScript,
            language.code,
            playAbortRef.current.signal
          );
          if (playGenerationRef.current !== generation) return;
          audioCacheRef.current.set(language.code, { blob, script: bulletinScript });
          setAudioPrefetched(true);
        }
        await playBlob(blob, ui.playBulletin, generation);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError" && playGenerationRef.current === generation) {
          setError(err instanceof Error ? err.message : ui.voiceNotReady);
          setRadioState("idle");
        }
      } finally {
        playAbortRef.current = null;
      }
    } else {
      await fetchAndPlay(bulletinScript, ui.playBulletin);
    }
  }, [
    bulletinScript,
    canListen,
    radioState,
    serverTtsReady,
    stopQueue,
    stopPlayback,
    playBlob,
    fetchAndPlay,
    language.code,
    ui.playBulletin,
    ui.voiceNotReady,
  ]);

  const openSummary = useCallback(
    async (item: TranslatedNewsItem) => {
      setSummaryItem(item);
      setSummaryText("");
      setSummaryError("");
      const rawMatch = rawNews.find((raw) => raw.id === item.id);
      setSummaryUrl(rawMatch?.url || "");

      const cacheKey = `${item.id}:${language.code}`;
      const cached = summaryCacheRef.current.get(cacheKey);
      if (cached) {
        setSummaryText(cached);
        return;
      }
      const sessionKey = `np:summary:${cacheKey}`;
      const sessionCached = readSessionCache<string>(sessionKey);
      if (sessionCached) {
        summaryCacheRef.current.set(cacheKey, sessionCached);
        setSummaryText(sessionCached);
        return;
      }

      summaryAbortRef.current?.abort();
      const ac = new AbortController();
      summaryAbortRef.current = ac;

      setSummaryLoading(true);
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: item.headline,
            snippet: item.summary,
            source: item.source,
            url: rawMatch?.url,
            languageName: language.name,
            languageNative: language.native,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Could not load summary.");
        }

        // Stream chunks in as they arrive instead of waiting for the full
        // 2-4 paragraph summary to finish generating before showing anything.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        setSummaryLoading(false);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setSummaryText(full);
        }

        summaryCacheRef.current.set(cacheKey, full);
        writeSessionCache(sessionKey, full);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSummaryError(err instanceof Error ? err.message : "Could not load summary.");
      } finally {
        setSummaryLoading(false);
      }
    },
    [rawNews, language.code, language.name, language.native]
  );

  const closeSummary = useCallback(() => {
    summaryAbortRef.current?.abort();
    setSummaryItem(null);
    setSummaryUrl("");
    setSummaryText("");
    setSummaryError("");
  }, []);

  const isSummaryAudioActive = isOnAir && nowPlayingLabel === SUMMARY_PLAYBACK_LABEL;

  const playSummaryAudio = useCallback(async () => {
    if (!canListen || !summaryText) return;
    stopRadio();
    setSummaryAudioLoading(true);
    try {
      await fetchAndPlay(summaryText, SUMMARY_PLAYBACK_LABEL);
    } finally {
      setSummaryAudioLoading(false);
    }
  }, [canListen, summaryText, stopRadio, fetchAndPlay]);

  const pauseRadio = useCallback(() => {
    if (audioRef.current && radioState === "playing") {
      audioRef.current.pause();
      setRadioState("paused");
    }
  }, [radioState]);

  const loadNews = useCallback(async (forceRefresh = false) => {
    setError("");
    stopRadio();
    clearCache();
    prefetchAbortRef.current?.abort();

    if (!forceRefresh) {
      const cachedTopNews = readSessionCache<{ news: RawNewsItem[]; date: string }>("np:topnews");
      if (cachedTopNews) {
        setRawNews(cachedTopNews.news);
        setDate(cachedTopNews.date);
        setLoadingNews(false);
        return;
      }
    }

    setLoadingNews(true);
    try {
      const data = await fetchJson<{ news: RawNewsItem[]; date: string }>("/api/top-news");
      translationCacheRef.current.clear();
      summaryCacheRef.current.clear();
      clearDerivedSessionCaches();
      writeSessionCache("np:topnews", data);
      setRawNews(data.news);
      setDate(data.date);

      // The server responds with headlines immediately and fills in per-story
      // one-sentence summaries in the background (see /api/top-news) — if
      // this fetch landed before that finished, quietly re-poll once to pick
      // up the enriched snippets instead of leaving today's session stuck on
      // headline-only summaries.
      if (data.news.some((item) => !item.snippet)) {
        setTimeout(async () => {
          try {
            const refreshed = await fetchJson<{ news: RawNewsItem[]; date: string }>("/api/top-news");
            if (refreshed.date !== data.date) return;
            translationCacheRef.current.clear();
            summaryCacheRef.current.clear();
            clearDerivedSessionCaches();
            writeSessionCache("np:topnews", refreshed);
            setRawNews(refreshed.news);
          } catch {
            // best-effort — headlines alone are a fine fallback
          }
        }, 6000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load news");
    } finally {
      setLoadingNews(false);
    }
  }, [stopRadio, clearCache]);

  const translateNews = useCallback(
    async (lang: ConstitutionalLanguage, items: RawNewsItem[], dateStr: string) => {
      if (!items.length) return;

      const cached = translationCacheRef.current.get(lang.code);
      if (cached) {
        stopRadio();
        clearCache();
        setNews(cached.news);
        if (cached.ui) setUi(cached.ui);
        setBulletin({ script: cached.bulletinScript || "", langCode: lang.code });
        return;
      }

      const sessionKey = `np:translation:${dateStr}:${lang.code}`;
      const sessionCached = readSessionCache<{
        news: TranslatedNewsItem[];
        ui?: UiStrings;
        bulletinScript?: string;
      }>(sessionKey);
      if (sessionCached) {
        translationCacheRef.current.set(lang.code, sessionCached);
        stopRadio();
        clearCache();
        setNews(sessionCached.news);
        if (sessionCached.ui) setUi(sessionCached.ui);
        setBulletin({ script: sessionCached.bulletinScript || "", langCode: lang.code });
        return;
      }

      setLoadingLang(true);
      setError("");
      stopRadio();
      clearCache();
      prefetchAbortRef.current?.abort();
      try {
        const data = await fetchJson<{
          news: TranslatedNewsItem[];
          ui?: UiStrings;
          bulletinScript?: string;
          translationDegraded?: boolean;
        }>("/api/translate-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ news: items, languageCode: lang.code, dateLabel: dateStr }),
        });
        // Don't cache a degraded (untranslated-fallback) response — let the
        // next visit to this language get a real shot at translating.
        if (!data.translationDegraded) {
          translationCacheRef.current.set(lang.code, data);
          writeSessionCache(sessionKey, data);
        }
        setNews(data.news);
        if (data.ui) setUi(data.ui);
        setBulletin({ script: data.bulletinScript || "", langCode: lang.code });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : ui.preparingNews);
      } finally {
        setLoadingLang(false);
      }
    },
    [stopRadio, clearCache, ui.preparingNews]
  );

  // Background warm-up for the featured tab (Hindi) not currently selected —
  // populates the same caches translateNews reads from, without touching
  // displayed state. Without this, switching to Hindi before it's been
  // visited always pays the full translation latency; with it, by the time
  // someone taps Hindi it's often already cached from the moment the news
  // list first loaded.
  const prefetchTranslationSilently = useCallback(
    async (lang: ConstitutionalLanguage, items: RawNewsItem[], dateStr: string) => {
      if (!items.length) return;
      if (translationCacheRef.current.has(lang.code)) return;
      const sessionKey = `np:translation:${dateStr}:${lang.code}`;
      if (readSessionCache(sessionKey)) return;

      try {
        const data = await fetchJson<{
          news: TranslatedNewsItem[];
          ui?: UiStrings;
          bulletinScript?: string;
          translationDegraded?: boolean;
        }>("/api/translate-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ news: items, languageCode: lang.code, dateLabel: dateStr }),
        });
        if (!data.translationDegraded) {
          translationCacheRef.current.set(lang.code, data);
          writeSessionCache(sessionKey, data);
        }
      } catch {
        // Best-effort — if this fails, selecting the tab will just translate normally.
      }
    },
    []
  );

  useEffect(() => {
    setBrowserSpeechReady(isBrowserSpeechSupported());
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    // Listening is only available for English and Hindi — skip the network
    // round-trip entirely for every other language instead of checking (and
    // immediately discarding) TTS readiness on every tab switch.
    if (!LISTENING_ENABLED_CODES.has(language.code)) {
      setServerTtsReady(false);
      return;
    }
    fetchJson<{ enabled?: boolean; elevenlabs?: boolean }>(`/api/tts-status?lang=${language.code}`)
      .then((d) => {
        setServerTtsReady(!!(d.enabled && d.elevenlabs));
      })
      .catch(() => {
        setServerTtsReady(false);
      });
  }, [language.code]);

  useEffect(() => {
    if (rawNews.length > 0 && date) translateNews(language, rawNews, date);
  }, [language, rawNews, date, translateNews]);

  useEffect(() => {
    if (!(rawNews.length > 0 && date)) return;
    let cancelled = false;
    // Sequential, not Promise.all — firing every prewarm language's
    // translation call at once is exactly the concurrent-request burst that
    // used to trip provider rate limiting and stall the request the user
    // is actually waiting on. One at a time keeps this purely a background
    // nicety instead of competing with the active tab's own translation.
    (async () => {
      for (const code of PREWARM_CODES) {
        if (cancelled || code === language.code) continue;
        const lang = getLanguageByCode(code);
        if (lang) await prefetchTranslationSilently(lang, rawNews, date);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawNews, date, language.code, prefetchTranslationSilently]);

  useEffect(() => {
    if (bulletinScript && serverTtsReady && !loadingLang) {
      prefetchAudio(bulletinScript, language.code);
    }
  }, [bulletinScript, serverTtsReady, loadingLang, language.code, prefetchAudio]);

  const busy = loadingNews || loadingLang;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-50">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/80 via-[#0a0f1a] to-indigo-950/60" />
        <div className="relative max-w-4xl mx-auto px-4 py-10 sm:px-8 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            {ui.title}
          </h1>
          {date && <p className="text-lg text-teal-200/70 mt-3">{date}</p>}
          <p className="text-base text-slate-400 mt-1">{ui.subtitle}</p>

          {/* Language toggle — English / Hindi */}
          <h2 className="mt-7 text-sm font-semibold text-slate-500 uppercase tracking-wider">
            {ui.chooseLanguage}
          </h2>
          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 p-1 shadow-inner">
            {ALL_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang)}
                disabled={busy}
                aria-pressed={language.code === lang.code}
                className={cn(
                  "min-w-[112px] rounded-full px-6 py-2.5 text-base font-semibold transition-all disabled:cursor-not-allowed",
                  language.code === lang.code
                    ? "bg-teal-400 text-[#06110f] shadow-lg shadow-teal-500/25"
                    : "text-slate-300 hover:text-white"
                )}
              >
                {lang.native}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-8 space-y-6 pb-16">
        {error && (
          <p className="text-center text-red-400 text-base bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {busy && (
          <div className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="w-7 h-7 text-teal-400 animate-spin" />
            <span className="text-lg text-slate-400">
              {loadingNews ? ui.loadingNews : ui.preparingNews}
            </span>
          </div>
        )}

        {!busy && news.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">
              {ui.headlines}
            </h2>
            {news.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold text-teal-400">
                    {item.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => openSummary(item)}
                      className="text-left text-lg font-bold text-white leading-snug hover:text-teal-300 transition-colors"
                    >
                      {item.headline}
                    </button>
                    {item.summary && item.summary !== item.headline && (
                      <p className="text-base text-slate-400 mt-2 leading-relaxed">{item.summary}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-2">{item.source}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Listening (Radio Bulletin) — only for languages with a wired-up TTS voice */}
        {LISTENING_ENABLED_CODES.has(language.code) && (
          <>
            {/* Player */}
            <section className="rounded-3xl border border-teal-400/20 bg-gradient-to-b from-teal-500/10 via-white/[0.04] to-white/[0.02] p-6 sm:p-8 shadow-2xl">
              {!isOnAir && (
                <div className="flex items-center justify-center gap-2 mb-5 text-teal-300">
                  <Radio className="w-5 h-5" />
                  <span className="text-sm font-bold tracking-widest uppercase">{ui.radioMode}</span>
                </div>
              )}
              {isOnAir && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-3 h-3 rounded-full",
                          radioState === "playing" ? "bg-red-500 animate-pulse" : "bg-slate-600"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-bold tracking-widest uppercase",
                          radioState === "playing" ? "text-red-400" : "text-slate-500"
                        )}
                      >
                        {radioState === "playing" ? ui.onAir : ui.nowPlaying}
                      </span>
                    </div>
                    {duration > 0 && (
                      <span className="text-sm text-slate-400 font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    )}
                  </div>

                  {nowPlayingLabel && (
                    <p className="text-center text-teal-300 text-sm mb-3 truncate">{nowPlayingLabel}</p>
                  )}

                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-5">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 to-indigo-400 transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-center min-h-[60px]">
                {radioState === "playing" ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={pauseRadio}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg"
                      aria-label={ui.pause}
                    >
                      <Pause className="w-6 h-6 fill-current" />
                    </button>
                    <button
                      onClick={stopRadio}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white"
                      aria-label={ui.stop}
                    >
                      <Square className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                ) : audioPrefetched || isOnAir ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={playBulletin}
                      disabled={busy || !bulletinScript || !canListen}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white shadow-lg"
                      aria-label={ui.playBulletin}
                    >
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </button>
                    {isOnAir && (
                      <button
                        onClick={stopRadio}
                        className="flex items-center justify-center w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white"
                        aria-label={ui.stop}
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/5 border border-white/10">
                    <span className="flex items-end gap-0.5 h-4">
                      <span
                        className="w-1 h-2 bg-teal-400/80 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1 h-4 bg-teal-400/80 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1 h-3 bg-teal-400/80 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                    <span className="text-sm text-slate-400">{ui.preparingBulletin}</span>
                  </div>
                )}
              </div>

              {!canListen && (
                <p className="text-center text-amber-400/90 text-sm mt-4">{ui.voiceNotReady}</p>
              )}
            </section>
          </>
        )}
      </main>

      {summaryItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeSummary}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1523] p-5 sm:p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-white leading-snug">{summaryItem.headline}</h3>
              <button
                type="button"
                onClick={closeSummary}
                aria-label="Close"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1">{summaryItem.source}</p>

            <div className="mt-4">
              {summaryLoading && (
                <div className="flex items-center gap-3 py-6 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                  <span>Summarizing…</span>
                </div>
              )}
              {!summaryLoading && summaryError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {summaryError}
                </p>
              )}
              {!summaryLoading && !summaryError && summaryText && (
                <>
                  {LISTENING_ENABLED_CODES.has(language.code) && canListen && (
                    <button
                      type="button"
                      onClick={() => (isSummaryAudioActive ? stopRadio() : playSummaryAudio())}
                      className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white/10 text-teal-300 hover:bg-teal-500/20 text-sm font-semibold"
                    >
                      {summaryAudioLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSummaryAudioActive ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                      {isSummaryAudioActive ? "Stop" : "Listen"}
                    </button>
                  )}
                  <p className="text-base text-slate-300 leading-relaxed whitespace-pre-line">
                    {summaryText}
                  </p>
                  {summaryUrl && (
                    <a
                      href={summaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-sm text-teal-400 hover:text-teal-300 underline"
                    >
                      Read full article
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

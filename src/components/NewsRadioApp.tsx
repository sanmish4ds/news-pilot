"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Radio,
  Square,
  Play,
  Pause,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Headphones,
  ListMusic,
  Volume2,
} from "lucide-react";
import { ALL_LANGUAGES, ConstitutionalLanguage } from "@/lib/languages";
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
type ListenMode = "bulletin" | "stories";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function storySpeechText(item: TranslatedNewsItem, storyLabel: string): string {
  return `${storyLabel} ${item.rank}. ${item.headline}. ${item.summary}`;
}

export function NewsRadioApp() {
  const [date, setDate] = useState("");
  const [rawNews, setRawNews] = useState<RawNewsItem[]>([]);
  const [news, setNews] = useState<TranslatedNewsItem[]>([]);
  const [bulletinScript, setBulletinScript] = useState("");
  const [ui, setUi] = useState<UiStrings>(DEFAULT_UI);
  const [language, setLanguage] = useState<ConstitutionalLanguage>(ALL_LANGUAGES[0]);
  const [listenMode, setListenMode] = useState<ListenMode>("bulletin");
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingLang, setLoadingLang] = useState(false);
  const [ttsProvider, setTtsProvider] = useState("");
  const [sarvamReady, setSarvamReady] = useState(false);
  const [serverTtsReady, setServerTtsReady] = useState(false);
  const [sarvamFallback, setSarvamFallback] = useState(false);
  const [browserSpeechReady, setBrowserSpeechReady] = useState(false);
  const [radioState, setRadioState] = useState<RadioState>("idle");
  const [playingStoryId, setPlayingStoryId] = useState<string | null>(null);
  const [audioPrefetched, setAudioPrefetched] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nowPlayingLabel, setNowPlayingLabel] = useState("");
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const cachedBlobRef = useRef<Blob | null>(null);
  const cachedScriptRef = useRef("");
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const playAbortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<{ id: string; text: string; label: string }[]>([]);
  const queueIndexRef = useRef(0);
  const queueActiveRef = useRef(false);

  const canListen = serverTtsReady || browserSpeechReady;
  const isOnAir = radioState === "playing" || radioState === "paused";

  const clearCache = useCallback(() => {
    cachedBlobRef.current = null;
    cachedScriptRef.current = "";
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
    setPlayingStoryId(null);
  }, []);

  const stopPlayback = useCallback(() => {
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
    async (blob: Blob, label: string, onEnded?: () => void) => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audio.setAttribute("playsinline", "true");
      audio.preload = "auto";
      audioRef.current = audio;

      audio.onloadedmetadata = () => setDuration(audio.duration || 0);
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.onended = () => {
        if (onEnded) onEnded();
        else setRadioState("idle");
      };
      audio.onerror = () => {
        setError("Playback failed. Tap play again.");
        setRadioState("idle");
        stopQueue();
      };

      setNowPlayingLabel(label);
      await waitForAudioReady(audio);
      await audio.play();
      setRadioState("playing");
    },
    [stopQueue]
  );

  const fetchAndPlay = useCallback(
    async (text: string, label: string, onEnded?: () => void) => {
      stopPlayback();
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
          await playBlob(blob, label, onEnded);
        } else {
          setNowPlayingLabel(label);
          setRadioState("playing");
          await speakWithBrowser(text, language.code);
          if (onEnded) onEnded();
          else setRadioState("idle");
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;

        if (serverTtsReady && browserSpeechReady) {
          try {
            setNowPlayingLabel(label);
            setRadioState("playing");
            await speakWithBrowser(text, language.code);
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

  const playNextInQueue = useCallback(async () => {
    if (!queueActiveRef.current) return;

    if (queueIndexRef.current >= queueRef.current.length) {
      queueActiveRef.current = false;
      setPlayingStoryId(null);
      setRadioState("idle");
      setNowPlayingLabel("");
      return;
    }

    const item = queueRef.current[queueIndexRef.current];
    setPlayingStoryId(item.id);

    await fetchAndPlay(item.text, item.label, () => {
      queueIndexRef.current += 1;
      void playNextInQueue();
    });
  }, [fetchAndPlay]);

  const prefetchAudio = useCallback(
    async (script: string, langCode: string) => {
      if (!script || !serverTtsReady) return;
      if (cachedScriptRef.current === script && cachedBlobRef.current) {
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
        cachedBlobRef.current = blob;
        cachedScriptRef.current = script;
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
      setRadioState("loading");
      setError("");
      setNowPlayingLabel(ui.playBulletin);

      try {
        let blob = cachedBlobRef.current;
        if (!blob || cachedScriptRef.current !== bulletinScript) {
          playAbortRef.current = new AbortController();
          blob = await fetchSpeechAudio(
            bulletinScript,
            language.code,
            playAbortRef.current.signal
          );
          cachedBlobRef.current = blob;
          cachedScriptRef.current = bulletinScript;
          setAudioPrefetched(true);
        }
        await playBlob(blob, ui.playBulletin);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
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

  const playStory = useCallback(
    async (item: TranslatedNewsItem) => {
      if (!canListen) {
        setError(ui.voiceNotReady);
        return;
      }
      stopRadio();
      setPlayingStoryId(item.id);
      const text = storySpeechText(item, ui.storyLabel);
      await fetchAndPlay(text, `${ui.storyLabel} ${item.rank}`, () => {
        setPlayingStoryId(null);
        setRadioState("idle");
      });
    },
    [canListen, fetchAndPlay, stopRadio, ui.storyLabel, ui.voiceNotReady]
  );

  const playAllStories = useCallback(async () => {
    if (!news.length || !canListen) {
      setError(news.length ? ui.voiceNotReady : "No stories yet.");
      return;
    }

    stopRadio();
    queueRef.current = news.map((item) => ({
      id: item.id,
      text: storySpeechText(item, ui.storyLabel),
      label: `${ui.storyLabel} ${item.rank}`,
    }));
    queueIndexRef.current = 0;
    queueActiveRef.current = true;
    await playNextInQueue();
  }, [news, canListen, stopRadio, playNextInQueue, ui.storyLabel, ui.voiceNotReady]);

  const pauseRadio = useCallback(() => {
    if (audioRef.current && radioState === "playing") {
      audioRef.current.pause();
      setRadioState("paused");
    }
  }, [radioState]);

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    setError("");
    stopRadio();
    clearCache();
    prefetchAbortRef.current?.abort();
    try {
      const data = await fetchJson<{ news: RawNewsItem[]; date: string }>("/api/top-news");
      setRawNews(data.news);
      setDate(data.date);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load news");
    } finally {
      setLoadingNews(false);
    }
  }, [stopRadio, clearCache]);

  const translateNews = useCallback(
    async (lang: ConstitutionalLanguage, items: RawNewsItem[], dateStr: string) => {
      if (!items.length) return;
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
        }>("/api/translate-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ news: items, languageCode: lang.code, dateLabel: dateStr }),
        });
        setNews(data.news);
        if (data.ui) setUi(data.ui);
        if (data.bulletinScript) setBulletinScript(data.bulletinScript);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : ui.preparingNews);
      } finally {
        setLoadingLang(false);
      }
    },
    [stopRadio, clearCache, ui.preparingNews]
  );

  useEffect(() => {
    setBrowserSpeechReady(isBrowserSpeechSupported());
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    fetchJson<{
      sarvam?: boolean;
      enabled?: boolean;
      bhashini?: boolean;
      elevenlabs?: boolean;
      provider?: string;
      sarvamFallback?: boolean;
    }>(`/api/tts-status?lang=${language.code}`)
      .then((d) => {
        setSarvamReady(!!d.sarvam);
        setServerTtsReady(!!(d.enabled && (d.sarvam || d.bhashini || d.elevenlabs)));
        setTtsProvider(d.provider || "");
        setSarvamFallback(!!d.sarvamFallback);
      })
      .catch(() => {
        setSarvamReady(false);
        setServerTtsReady(false);
      });
  }, [language.code]);

  useEffect(() => {
    if (rawNews.length > 0 && date) translateNews(language, rawNews, date);
  }, [language, rawNews, date, translateNews]);

  useEffect(() => {
    if (bulletinScript && serverTtsReady && !loadingLang && listenMode === "bulletin") {
      prefetchAudio(bulletinScript, language.code);
    }
  }, [bulletinScript, serverTtsReady, loadingLang, language.code, listenMode, prefetchAudio]);

  const busy = loadingNews || loadingLang;
  const playLabel =
    radioState === "loading" || prefetching ? ui.preparingBulletin : ui.playBulletin;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-50">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/80 via-[#0a0f1a] to-indigo-950/60" />
        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
            <Radio className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-teal-300 tracking-widest uppercase">
              News Pilot
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            {ui.title}
          </h1>
          {date && <p className="text-lg text-teal-200/70 mt-2">{date}</p>}
          <p className="text-base text-slate-400 mt-1">{ui.subtitle}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-8 space-y-6 pb-16">
        {/* Language picker */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
            {ui.chooseLanguage}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
            {ALL_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang)}
                disabled={busy || isOnAir}
                className={cn(
                  "flex-shrink-0 snap-start min-w-[88px] rounded-xl border px-3 py-3 text-center transition-all",
                  language.code === lang.code
                    ? "border-teal-400 bg-teal-500/15 text-white shadow-lg shadow-teal-500/10"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                )}
              >
                <span className="block text-lg font-bold leading-tight">{lang.native}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{lang.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Mode toggle */}
        <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1 gap-1">
          <button
            onClick={() => setListenMode("bulletin")}
            disabled={isOnAir}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 min-h-[52px] rounded-xl text-base font-semibold transition-all",
              listenMode === "bulletin"
                ? "bg-teal-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Headphones className="w-5 h-5" />
            {ui.radioMode}
          </button>
          <button
            onClick={() => setListenMode("stories")}
            disabled={isOnAir}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 min-h-[52px] rounded-xl text-base font-semibold transition-all",
              listenMode === "stories"
                ? "bg-indigo-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <ListMusic className="w-5 h-5" />
            {ui.storiesMode}
          </button>
        </div>

        {/* Player */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 sm:p-8 shadow-2xl">
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

          {nowPlayingLabel && isOnAir && (
            <p className="text-center text-teal-300 text-sm mb-3 truncate">{nowPlayingLabel}</p>
          )}

          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-indigo-400 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {audioPrefetched && radioState === "idle" && listenMode === "bulletin" && (
            <p className="text-center text-teal-400/90 text-sm mb-4 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {ui.readyToPlay}
            </p>
          )}

          {listenMode === "bulletin" ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {radioState === "playing" ? (
                <button
                  onClick={pauseRadio}
                  className="flex items-center justify-center gap-3 min-h-[60px] px-10 rounded-2xl bg-teal-500 hover:bg-teal-400 text-white text-lg font-bold"
                >
                  <Pause className="w-6 h-6 fill-current" />
                  {ui.pause}
                </button>
              ) : (
                <button
                  onClick={playBulletin}
                  disabled={busy || !bulletinScript || !canListen || radioState === "loading"}
                  className="flex items-center justify-center gap-3 min-h-[60px] px-10 rounded-2xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white text-lg font-bold"
                >
                  {radioState === "loading" || prefetching ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 fill-current" />
                  )}
                  {playLabel}
                </button>
              )}
              {isOnAir && (
                <button
                  onClick={stopRadio}
                  className="flex items-center justify-center gap-3 min-h-[60px] px-8 rounded-2xl bg-red-600/90 hover:bg-red-500 text-white text-lg font-bold"
                >
                  <Square className="w-5 h-5 fill-current" />
                  {ui.stop}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={playAllStories}
                disabled={busy || !news.length || !canListen || radioState === "loading"}
                className="flex items-center justify-center gap-3 min-h-[60px] px-10 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-lg font-bold"
              >
                {radioState === "loading" ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Play className="w-6 h-6 fill-current" />
                )}
                {ui.listenAllStories}
              </button>
              {isOnAir && (
                <button
                  onClick={stopRadio}
                  className="flex items-center justify-center gap-3 min-h-[60px] px-8 rounded-2xl bg-red-600/90 hover:bg-red-500 text-white text-lg font-bold"
                >
                  <Square className="w-5 h-5 fill-current" />
                  {ui.stop}
                </button>
              )}
            </div>
          )}

          <button
            onClick={loadNews}
            disabled={busy || isOnAir}
            className="mt-4 w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-40 text-base"
          >
            <RefreshCw className={cn("w-4 h-4", loadingNews && "animate-spin")} />
            {ui.refresh}
          </button>

          {!canListen && (
            <p className="text-center text-amber-400/90 text-sm mt-4">{ui.voiceNotReady}</p>
          )}
          {canListen && serverTtsReady && (
            <p className="text-center text-xs text-slate-500 mt-3 flex items-center justify-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              {ttsProvider === "sarvam"
                ? sarvamReady
                  ? ui.voiceNatural
                  : ui.voiceNatural
                : ui.voiceNatural}
            </p>
          )}
          {sarvamFallback && language.code === "mai" && (
            <p className="text-center text-amber-400/80 text-xs mt-2">
              Maithili text · Hindi voice via Sarvam. Add BHASHINI_API_KEY for native Maithili.
            </p>
          )}
        </section>

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
              {listenMode === "stories" ? ui.storiesMode : "Today's Headlines"}
            </h2>
            {news.map((item) => {
              const isActive = playingStoryId === item.id;
              const isLoadingStory = isActive && radioState === "loading";
              const isPlayingStory = isActive && radioState === "playing";
              return (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-2xl border p-4 sm:p-5 transition-all",
                    isActive && isOnAir
                      ? "border-indigo-400/50 bg-indigo-500/10"
                      : "border-white/10 bg-white/[0.03]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold text-teal-400">
                      {item.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white leading-snug">{item.headline}</h3>
                      <p className="text-base text-slate-400 mt-2 leading-relaxed">{item.summary}</p>
                      <p className="text-xs text-slate-600 mt-2">{item.source}</p>
                    </div>
                    {listenMode === "stories" && (
                      <button
                        onClick={() => playStory(item)}
                        disabled={busy || !canListen || (isOnAir && !isActive)}
                        aria-label={`${ui.listenStory} ${item.rank}`}
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl transition-all",
                          isActive && isOnAir
                            ? "bg-indigo-500 text-white"
                            : "bg-white/10 text-teal-300 hover:bg-teal-500/20 disabled:opacity-40"
                        )}
                      >
                        {isLoadingStory ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isPlayingStory ? (
                          <Volume2 className="w-5 h-5 animate-pulse" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

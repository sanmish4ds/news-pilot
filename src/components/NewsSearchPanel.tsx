"use client";

import { useState } from "react";
import {
  Radar,
  Search,
  Globe,
  AlertCircle,
  Newspaper,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ResultPanel } from "@/components/ui/ResultPanel";
import { SourceList, ArticleCardData } from "@/components/SourceCard";

const TIME_RANGES = [
  { value: "any", label: "Any time" },
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const SUGGESTED_QUERIES = [
  "Supreme Court verdict today",
  "RBI monetary policy",
  "Lok Sabha elections updates",
  "Farmer protest latest",
  "India GDP growth",
  "Modi foreign visit",
];

type SearchPhase = "idle" | "searching" | "scraping" | "synthesizing" | "done";

interface SearchResponse {
  search: {
    query: string;
    articles: ArticleCardData[];
    scrapedCount: number;
    sourcesUsed: string[];
    searchedAt: string;
  };
  synthesis: string | null;
  message?: string;
}

export function NewsSearchPanel() {
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("any");
  const [indiaOnly, setIndiaOnly] = useState(true);
  const [scrapeArticles, setScrapeArticles] = useState(true);
  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [error, setError] = useState("");
  const [articles, setArticles] = useState<ArticleCardData[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const [meta, setMeta] = useState<{ sourcesUsed: string[]; scrapedCount: number } | null>(
    null
  );

  const loading = phase !== "idle" && phase !== "done";

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) {
      setError("Enter a topic, keyword, or paste a news URL to search.");
      return;
    }

    setQuery(q);
    setError("");
    setArticles([]);
    setSynthesis("");
    setMeta(null);
    setPhase("searching");

    try {
      const scrapeTimer = setTimeout(() => setPhase("scraping"), 1500);
      const synthTimer = setTimeout(() => setPhase("synthesizing"), 4000);

      const res = await fetch("/api/news-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          maxResults: 20,
          scrapeArticles,
          scrapeLimit: 10,
          timeRange,
          indiaOnly,
          includeWeb: true,
          synthesize: true,
        }),
      });

      clearTimeout(scrapeTimer);
      clearTimeout(synthTimer);

      const data: SearchResponse & { error?: string } = await res.json();
      if (data.error) throw new Error(data.error);

      setArticles(data.search.articles);
      setSynthesis(data.synthesis || "");
      setMeta({
        sourcesUsed: data.search.sourcesUsed,
        scrapedCount: data.search.scrapedCount,
      });

      if (data.message) setError(data.message);
      setPhase("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setPhase("idle");
    }
  };

  const phaseLabel: Record<SearchPhase, string> = {
    idle: "",
    searching: "Searching Google News India & web sources…",
    scraping: "Scraping full article text from top sources…",
    synthesizing: "Synthesizing findings into newsroom briefing…",
    done: "",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
          <Radar className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Comprehensive News Search</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Search Indian news across Google News, web sources, and scrape full articles — then get an AI newsroom briefing.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/20 p-4 space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search: e.g. 'Bulldozer action UP Supreme Court' or paste a news URL"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            loading={loading}
            size="lg"
            className="flex-shrink-0"
          >
            <Search className="w-4 h-4" />
            Search
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Time Range"
            options={TIME_RANGES}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Options
            </span>
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indiaOnly}
                  onChange={(e) => setIndiaOnly(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                />
                India news sources only
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scrapeArticles}
                  onChange={(e) => setScrapeArticles(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                />
                Scrape full article text
              </label>
            </div>
          </div>
        </div>

        {/* Suggested queries */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-600 self-center">Try:</span>
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSearch(q)}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-amber-400 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-amber-500/30 rounded-full px-3 py-1 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading phase indicator */}
      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
          <span className="text-sm text-amber-300/90">{phaseLabel[phase]}</span>
        </div>
      )}

      {/* Meta stats */}
      {meta && !loading && (
        <div className="flex flex-wrap gap-2">
          {meta.sourcesUsed.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-full px-3 py-1"
            >
              <Globe className="w-3 h-3 text-slate-500" />
              {source}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
            <Newspaper className="w-3 h-3" />
            {meta.scrapedCount} articles scraped
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {synthesis && <ResultPanel result={synthesis} title="Newsroom Briefing" />}

      {articles.length > 0 && <SourceList articles={articles} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search, FileText, Link, AlertCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { ResultPanel } from "@/components/ui/ResultPanel";

export function ResearchPanel() {
  const [topic, setTopic] = useState("");
  const [sources, setSources] = useState("");
  const [searchWeb, setSearchWeb] = useState(true);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchMeta, setSearchMeta] = useState<string>("");

  const handleSubmit = async () => {
    if (!topic && !sources) {
      setError("Please enter a topic or paste source material.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");
    setSearchMeta("");

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sources, searchWeb }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      if (data.searchMeta) setSearchMeta(data.searchMeta);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
          <Search className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Story Research & Summarization</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Paste source material or enter a topic — optionally search and scrape live Indian news sources automatically.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Input
          label="Topic / Story Brief"
          placeholder="e.g. RBI rate decision impact on home loan borrowers, June 2026"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <Textarea
          label="Source Material (Optional)"
          placeholder="Paste PIB press releases, government statements, court orders, party manifestos, or article text here..."
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          rows={8}
          hint="Leave blank to search the web using the topic above"
        />

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={searchWeb}
            onChange={(e) => setSearchWeb(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
          />
          <Globe className="w-4 h-4 text-slate-500" />
          Search & scrape Indian news sources when topic is provided
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
            <FileText className="w-3.5 h-3.5" />
            <span>Extracts key facts</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Flags contradictions</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
            <Link className="w-3.5 h-3.5" />
            <span>Web search + scrape</span>
          </div>
        </div>

        {searchMeta && (
          <div className="text-xs text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
            {searchMeta}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <Button onClick={handleSubmit} loading={loading} size="lg">
          {loading ? "Searching & Analyzing…" : "Analyze & Summarize"}
        </Button>
      </div>

      {result && <ResultPanel result={result} title="Research Summary" />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { PenLine, FileText, Hash, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ResultPanel } from "@/components/ui/ResultPanel";

const ARTICLE_STYLES = [
  { value: "breaking", label: "Breaking News" },
  { value: "longform", label: "Longform / Feature" },
  { value: "explainer", label: "Explainer / Analysis" },
  { value: "opinion", label: "Opinion / Editorial" },
  { value: "profile", label: "Profile" },
  { value: "q-and-a", label: "Q&A" },
  { value: "data-story", label: "Data Story" },
  { value: "newsletter", label: "Newsletter" },
];

const WORD_COUNTS = [
  { value: "200", label: "~200 words (Brief)" },
  { value: "400", label: "~400 words (Short)" },
  { value: "700", label: "~700 words (Standard)" },
  { value: "1200", label: "~1200 words (Feature)" },
  { value: "2000", label: "~2000 words (Longform)" },
];

export function DraftPanel() {
  const [brief, setBrief] = useState("");
  const [sources, setSources] = useState("");
  const [style, setStyle] = useState("breaking");
  const [wordCount, setWordCount] = useState("700");
  const [houseStyle, setHouseStyle] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!brief.trim()) {
      setError("Please provide a story brief.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, sources, style, wordCount, houseStyle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center flex-shrink-0">
          <PenLine className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Draft Assistance & Style Matching</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Generate polished first drafts in your publication&apos;s style, with headline variations and social pull quotes.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Textarea
          label="Story Brief"
          placeholder="e.g. The Supreme Court stays the Bulldozer action order in UP — describe the story with key facts, who's affected, legal angle, political reactions, and your intended narrative..."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          hint="Include key facts, quotes, and the narrative angle you want to pursue"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Article Style"
            options={ARTICLE_STYLES}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
          <Select
            label="Target Word Count"
            options={WORD_COUNTS}
            value={wordCount}
            onChange={(e) => setWordCount(e.target.value)}
          />
        </div>

        <Input
          label="House Style Notes (Optional)"
          placeholder="e.g. Use lakh/crore not millions/billions, spell out Indian official titles in full, AP style for English, avoid passive voice..."
          value={houseStyle}
          onChange={(e) => setHouseStyle(e.target.value)}
        />

        <Textarea
          label="Source Material (Optional)"
          placeholder="Paste raw notes, quotes, data, or source documents to incorporate into the draft..."
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          rows={4}
        />

        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: PenLine, label: "Publication-style draft" },
            { icon: Hash, label: "3 headline variations" },
            { icon: FileText, label: "Social media pull quotes" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <Button onClick={handleSubmit} loading={loading} size="lg">
          {loading ? "Drafting Story…" : "Generate First Draft"}
        </Button>
      </div>

      {result && <ResultPanel result={result} title="First Draft" />}
    </div>
  );
}

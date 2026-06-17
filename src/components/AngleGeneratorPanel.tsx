"use client";

import { useState } from "react";
import { Compass, Users, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ResultPanel } from "@/components/ui/ResultPanel";

const PUBLICATION_TONES = [
  { value: "neutral", label: "Neutral / Balanced (The Hindu style)" },
  { value: "investigative", label: "Investigative / Deep-Dive (The Wire style)" },
  { value: "punchy", label: "Punchy / High-Impact (NDTV / Times Now style)" },
  { value: "broadsheet", label: "Broadsheet / Analytical (Indian Express style)" },
  { value: "digital-native", label: "Digital-Native (Scroll / The Print style)" },
  { value: "regional", label: "Regional / Vernacular Adaptation" },
  { value: "business", label: "Business / Financial (Mint / ET style)" },
  { value: "diaspora", label: "Indian Diaspora Audience" },
];

export function AngleGeneratorPanel() {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [publicationTone, setPublicationTone] = useState("neutral");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!brief.trim()) {
      setError("Please provide a story brief or topic.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, audience, publicationTone }),
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
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
          <Compass className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Story Angle Generator</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Input a topic brief and get multiple editorial angles ranked by newsworthiness and engagement potential.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Textarea
          label="Story Brief / Topic"
          placeholder="e.g. The Centre announces a ₹50,000 crore infrastructure push for Tier-2 cities ahead of state elections, with BJP and opposition trading claims on implementation..."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          hint="The more context you provide, the more tailored the angles"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Target Audience"
            placeholder="e.g. General public, tech workers, investors"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
          <Select
            label="Publication Tone"
            options={PUBLICATION_TONES}
            value={publicationTone}
            onChange={(e) => setPublicationTone(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: Compass, label: "5–7 distinct angles" },
            { icon: TrendingUp, label: "Newsworthiness scores" },
            { icon: Users, label: "Audience targeting" },
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
          {loading ? "Generating Angles…" : "Generate Story Angles"}
        </Button>
      </div>

      {result && <ResultPanel result={result} title="Editorial Angles" />}
    </div>
  );
}

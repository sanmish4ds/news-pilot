"use client";

import { useState } from "react";
import { ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ResultPanel } from "@/components/ui/ResultPanel";

export function FactCheckPanel() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Please paste content to fact-check.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/fact-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
        <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Real-Time Fact-Check Assist</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Paste a draft or claims for analysis. Each assertion gets a confidence score, rating, and source attribution.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { color: "text-green-400 bg-green-500/10 border-green-500/20", label: "VERIFIED", desc: "Cross-referenced & confirmed" },
            { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", label: "UNVERIFIED", desc: "Needs editorial review" },
            { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "DISPUTED", desc: "Contradicted by sources" },
          ].map(({ color, label, desc }) => (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2.5 ${color}`}
            >
              <div className="text-xs font-bold">{label}</div>
              <div className="text-xs opacity-75 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        <Textarea
          label="Content to Fact-Check"
          placeholder="Paste your article draft, press release, or specific claims you want fact-checked..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          hint="Works best with specific claims, statistics, dates, and named entities"
        />

        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: CheckCircle, label: "Confidence scores (0–100%)" },
            { icon: ShieldCheck, label: "Source attribution" },
            { icon: AlertCircle, label: "Editorial review flags" },
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
          {loading ? "Running Fact-Check…" : "Run Fact-Check"}
        </Button>
      </div>

      {result && <ResultPanel result={result} title="Fact-Check Report" />}
    </div>
  );
}

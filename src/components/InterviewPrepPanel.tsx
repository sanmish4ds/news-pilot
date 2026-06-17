"use client";

import { useState } from "react";
import { Mic, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ResultPanel } from "@/components/ui/ResultPanel";

const INTERVIEW_TYPES = [
  { value: "news", label: "News Interview" },
  { value: "investigative", label: "Investigative Interview" },
  { value: "profile", label: "Profile / Feature" },
  { value: "press-conference", label: "Press Conference" },
  { value: "earnings-call", label: "Earnings / Financial" },
  { value: "political", label: "Political Interview" },
  { value: "expert", label: "Expert / Academic" },
];

export function InterviewPrepPanel() {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [background, setBackground] = useState("");
  const [interviewType, setInterviewType] = useState("news");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!subject && !topic) {
      setError("Please enter a subject name or interview topic.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, background, interviewType }),
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
        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
          <Mic className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Intelligent Interview Prep</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Generate tailored question sets, flag sensitive topics, and surface relevant context before your interview.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Subject Name"
            placeholder="e.g. Union Minister Nitin Gadkari, CM Yogi Adityanath"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Select
            label="Interview Type"
            options={INTERVIEW_TYPES}
            value={interviewType}
            onChange={(e) => setInterviewType(e.target.value)}
          />
        </div>

        <Input
          label="Interview Topic / Story Angle"
          placeholder="e.g. Response to farmer protest demands, farm loan waiver policy, or MGNREGS budget cut"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <Textarea
          label="Subject Background & Context"
          placeholder="Paste bio, Lok Sabha/Rajya Sabha speeches, past interviews, party affiliation history, relevant court cases, or RTI responses..."
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={6}
          hint="The more context you provide, the sharper the questions"
        />

        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: User, label: "10–15 tailored questions" },
            { icon: AlertCircle, label: "Sensitive topic flags" },
            { icon: Mic, label: "Follow-up angle suggestions" },
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
          {loading ? "Generating Questions…" : "Generate Interview Prep"}
        </Button>
      </div>

      {result && <ResultPanel result={result} title="Interview Prep Sheet" />}
    </div>
  );
}

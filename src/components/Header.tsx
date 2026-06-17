"use client";

import { WorkflowId } from "@/components/Sidebar";
import { Search, Mic, ShieldCheck, Compass, PenLine, Radar } from "lucide-react";

const WORKFLOW_META: Record<
  WorkflowId,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; role: string }
> = {
  newssearch: {
    label: "Comprehensive News Search",
    icon: Radar,
    color: "text-amber-400",
    role: "Google News · Web scrape · AI briefing",
  },
  research: {
    label: "Research & Summarization",
    icon: Search,
    color: "text-blue-400",
    role: "India-focused source analysis",
  },
  interview: {
    label: "Interview Prep",
    icon: Mic,
    color: "text-purple-400",
    role: "For Indian politicians, bureaucrats & leaders",
  },
  factcheck: {
    label: "Fact-Check Assist",
    icon: ShieldCheck,
    color: "text-green-400",
    role: "Cross-references Indian govt & judicial sources",
  },
  angles: {
    label: "Story Angle Generator",
    icon: Compass,
    color: "text-orange-400",
    role: "Angles tuned to Indian publications & audiences",
  },
  draft: {
    label: "Draft Assistance",
    icon: PenLine,
    color: "text-rose-400",
    role: "Indian English style — lakh/crore, PIB conventions",
  },
};

interface HeaderProps {
  activeWorkflow: WorkflowId;
}

export function Header({ activeWorkflow }: HeaderProps) {
  const meta = WORKFLOW_META[activeWorkflow];
  const Icon = meta.icon;

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${meta.color}`} />
        <div>
          <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
          <span className="ml-3 text-xs text-slate-600">{meta.role}</span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-800/50 rounded-md px-2.5 py-1 border border-slate-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span>Session active — no data retained</span>
      </div>
    </header>
  );
}

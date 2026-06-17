"use client";

import { cn } from "@/lib/utils";
import {
  Search,
  Mic,
  ShieldCheck,
  Compass,
  PenLine,
  Newspaper,
  ChevronRight,
  Settings,
  HelpCircle,
  Radar,
} from "lucide-react";

export type WorkflowId =
  | "newssearch"
  | "research"
  | "interview"
  | "factcheck"
  | "angles"
  | "draft";

interface NavItem {
  id: WorkflowId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "newssearch",
    label: "News Search",
    description: "Search & scrape Indian news",
    icon: Radar,
    color: "text-amber-400",
    badge: "New",
  },
  {
    id: "research",
    label: "Research",
    description: "Summarize & analyze sources",
    icon: Search,
    color: "text-blue-400",
  },
  {
    id: "interview",
    label: "Interview Prep",
    description: "Generate tailored questions",
    icon: Mic,
    color: "text-purple-400",
  },
  {
    id: "factcheck",
    label: "Fact-Check",
    description: "Verify claims with scores",
    icon: ShieldCheck,
    color: "text-green-400",
  },
  {
    id: "angles",
    label: "Angle Generator",
    description: "Multiple editorial angles",
    icon: Compass,
    color: "text-orange-400",
  },
  {
    id: "draft",
    label: "Draft Assist",
    description: "First drafts in your style",
    icon: PenLine,
    color: "text-rose-400",
  },
];

interface SidebarProps {
  activeWorkflow: WorkflowId;
  onWorkflowChange: (id: WorkflowId) => void;
}

export function Sidebar({ activeWorkflow, onWorkflowChange }: SidebarProps) {
  return (
    <aside className="flex flex-col w-64 bg-slate-900 border-r border-slate-800 min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Newspaper className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-tight">News Pilot</div>
            <div className="text-xs text-slate-500">India AI Newsroom Copilot</div>
          </div>
        </div>
      </div>

      {/* Workflow nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-2 mb-3">
          Workflows
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkflow === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onWorkflowChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                isActive
                  ? "bg-slate-800 shadow-sm"
                  : "hover:bg-slate-800/60"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
                  isActive ? "bg-slate-700" : "bg-slate-800/0 group-hover:bg-slate-700/50"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", item.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium truncate",
                    isActive ? "text-slate-100" : "text-slate-400 group-hover:text-slate-300"
                  )}
                >
                  {item.label}
                </div>
                <div className="text-xs text-slate-600 truncate">{item.description}</div>
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-800/60 transition-colors group">
          <Settings className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
          <span className="text-sm text-slate-600 group-hover:text-slate-400">Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-800/60 transition-colors group">
          <HelpCircle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
          <span className="text-sm text-slate-600 group-hover:text-slate-400">Help & Docs</span>
        </button>
        <div className="px-3 pt-3">
          <div className="text-xs text-slate-700">
            Session data cleared on exit. GDPR & CCPA compliant.
          </div>
        </div>
      </div>
    </aside>
  );
}

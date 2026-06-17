"use client";

import { useState } from "react";
import { Sidebar, WorkflowId } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { NewsSearchPanel } from "@/components/NewsSearchPanel";
import { ResearchPanel } from "@/components/ResearchPanel";
import { InterviewPrepPanel } from "@/components/InterviewPrepPanel";
import { FactCheckPanel } from "@/components/FactCheckPanel";
import { AngleGeneratorPanel } from "@/components/AngleGeneratorPanel";
import { DraftPanel } from "@/components/DraftPanel";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowId>("newssearch");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderPanel = () => {
    switch (activeWorkflow) {
      case "newssearch":
        return <NewsSearchPanel />;
      case "research":
        return <ResearchPanel />;
      case "interview":
        return <InterviewPrepPanel />;
      case "factcheck":
        return <FactCheckPanel />;
      case "angles":
        return <AngleGeneratorPanel />;
      case "draft":
        return <DraftPanel />;
    }
  };

  const isWideLayout = activeWorkflow === "newssearch";

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed md:static inset-y-0 left-0 z-30 md:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar
          activeWorkflow={activeWorkflow}
          onWorkflowChange={(id) => {
            setActiveWorkflow(id);
            setSidebarOpen(false);
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-sm font-semibold text-slate-200">News Pilot</span>
        </div>

        <Header activeWorkflow={activeWorkflow} />

        <main className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "mx-auto px-6 py-8",
              isWideLayout ? "max-w-5xl" : "max-w-3xl"
            )}
          >
            {renderPanel()}
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ResultPanelProps {
  result: string;
  title?: string;
  className?: string;
}

export function ResultPanel({ result, title = "Result", className }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700/60 bg-slate-800/30 overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Download as Markdown"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-5 prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[600px]">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-bold text-slate-100 mt-0 mb-3">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-bold text-slate-200 mt-4 mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold text-amber-400 mt-3 mb-1.5">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-slate-300 leading-relaxed mb-3">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1 mb-3 ml-4 list-disc marker:text-amber-500">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="space-y-1 mb-3 ml-4 list-decimal marker:text-amber-500">{children}</ol>
            ),
            li: ({ children }) => <li className="text-slate-300">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-100">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-amber-500/50 pl-4 my-3 text-slate-400 italic">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded text-xs">
                {children}
              </code>
            ),
            hr: () => <hr className="border-slate-700 my-4" />,
          }}
        >
          {result}
        </ReactMarkdown>
      </div>
    </div>
  );
}

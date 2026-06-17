"use client";

import { ExternalLink, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ArticleCardData {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
  scraped?: boolean;
  scrapeError?: string;
}

interface SourceCardProps {
  article: ArticleCardData;
  index: number;
}

export function SourceCard({ article, index }: SourceCardProps) {
  return (
    <article className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 hover:border-slate-600/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
              [{index + 1}]
            </span>
            <span className="text-xs text-slate-500 truncate">{article.source}</span>
            {article.publishedAt && (
              <span className="text-xs text-slate-600 hidden sm:inline">
                · {new Date(article.publishedAt).toLocaleDateString("en-IN")}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-200 leading-snug mb-1.5">
            {article.title}
          </h3>
          {article.snippet && (
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              {article.snippet}
            </p>
          )}
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Open source"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {article.scraped ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400/90 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Full article scraped
          </span>
        ) : article.scrapeError ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-400/90 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
            <AlertCircle className="w-3 h-3" />
            Snippet only
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
            <Globe className="w-3 h-3" />
            Headline & snippet
          </span>
        )}
      </div>
    </article>
  );
}

interface SourceListProps {
  articles: ArticleCardData[];
  className?: string;
}

export function SourceList({ articles, className }: SourceListProps) {
  if (articles.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Sources Found ({articles.length})
        </h3>
      </div>
      <div className="grid gap-3">
        {articles.map((article, index) => (
          <SourceCard key={article.id} article={article} index={index} />
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Minus, Loader2, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEodhdNews, type EodhdNewsArticle } from '@/hooks/useEodhdNews';

const PAGE_SIZE = 10;

interface CountryNewsProps {
  iso2: string;
}

// ── Sentiment helpers ──────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: EodhdNewsArticle['sentiment'] }) {
  if (!sentiment) return null;

  const { polarity, pos, neg } = sentiment;

  const cfg = {
    Positive: {
      icon: <TrendingUp className="h-3 w-3" />,
      label: 'Positive',
      classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
      bar: 'bg-emerald-500',
      score: pos,
    },
    Negative: {
      icon: <TrendingDown className="h-3 w-3" />,
      label: 'Negative',
      classes: 'bg-red-500/15 text-red-500 border-red-500/20',
      bar: 'bg-red-500',
      score: neg,
    },
    Neutral: {
      icon: <Minus className="h-3 w-3" />,
      label: 'Neutral',
      classes: 'bg-muted text-muted-foreground border-border',
      bar: 'bg-muted-foreground',
      score: sentiment.neu,
    },
  }[polarity] ?? {
    icon: <Minus className="h-3 w-3" />,
    label: 'Neutral',
    classes: 'bg-muted text-muted-foreground border-border',
    bar: 'bg-muted-foreground',
    score: sentiment.neu,
  };

  const pct = Math.round(cfg.score * 100);

  return (
    <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium', cfg.classes)}>
      {cfg.icon}
      <span>{cfg.label}</span>
      <span className="opacity-70">{pct}%</span>
    </div>
  );
}

// ── Article row ────────────────────────────────────────────────────────────────

function ArticleRow({ article }: { article: EodhdNewsArticle }) {
  const date = article.date ? new Date(article.date) : null;
  const dateStr = date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const timeStr = date
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all duration-150 p-3"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors flex-1 min-w-0">
          {article.title}
        </p>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <SentimentBadge sentiment={article.sentiment} />

        {article.tickers.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {article.tickers.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
              >
                {t.replace(/\.US$/, '')}
              </span>
            ))}
            {article.tickers.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{article.tickers.length - 4}</span>
            )}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
          {dateStr}
          {timeStr && <> &middot; {timeStr}</>}
        </span>
      </div>
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CountryNews({ iso2 }: CountryNewsProps) {
  const [page, setPage] = useState(0);
  const { data: articles = [], isLoading, isError } = useEodhdNews({ iso2 });

  const totalPages = Math.ceil(articles.length / PAGE_SIZE);
  const pageArticles = articles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading news…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <Newspaper className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Unable to load news</p>
        <p className="text-xs text-muted-foreground/70">EODHD quota may be exhausted. Try again after UTC midnight.</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <Newspaper className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No news available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Financial News
          </span>
          <span className="text-xs text-muted-foreground">· EODHD</span>
        </div>
        <span className="text-xs text-muted-foreground">{articles.length} articles</span>
      </div>

      {/* Sentiment legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/70" />
          Positive
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500/70" />
          Negative
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50" />
          Neutral
        </span>
      </div>

      {/* Article list */}
      <div className="space-y-2">
        {pageArticles.map((article, i) => (
          <ArticleRow key={`${article.link}-${i}`} article={article} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

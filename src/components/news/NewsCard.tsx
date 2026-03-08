
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { NewsItem, formatDate } from '@/utils/stocksApi';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon, ClockIcon } from 'lucide-react';
import { StockLogo } from '@/components/stocks/StockLogo';

interface NewsCardProps {
  news: NewsItem[];
  watchlistSymbols?: string[];
  className?: string;
}

export function NewsCard({ news, watchlistSymbols, className }: NewsCardProps) {
  // null = show all; a symbol string = filter to that symbol only
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // If the active filter symbol is removed from the watchlist, clear it
  useEffect(() => {
    if (activeFilter && watchlistSymbols && !watchlistSymbols.includes(activeFilter)) {
      setActiveFilter(null);
    }
  }, [watchlistSymbols, activeFilter]);

  // First narrow to watchlist symbols, then apply chip filter
  const watchlistNews = watchlistSymbols?.length
    ? news.filter((item) => item.relatedSymbols?.some((s) => watchlistSymbols.includes(s)))
    : news;

  const filteredNews = activeFilter
    ? watchlistNews.filter((item) => item.relatedSymbols?.includes(activeFilter))
    : watchlistNews;

  return (
    <section className={cn('space-y-4', className)} aria-label="Market News">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Live News</h2>
          <span className="live-dot" aria-label="Live updates active" />
        </div>
        <span className="text-xs text-muted-foreground font-mono-num">
          {filteredNews.length} article{filteredNews.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Watchlist filter chips — clickable */}
      {watchlistSymbols && watchlistSymbols.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Filter by symbol">
          {watchlistSymbols.map((symbol) => {
            const count = watchlistNews.filter((n) => n.relatedSymbols?.includes(symbol)).length;
            const isActive = activeFilter === symbol;
            return (
              <button
                key={symbol}
                onClick={() => setActiveFilter(isActive ? null : symbol)}
                aria-pressed={isActive}
                disabled={count === 0}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : count > 0
                      ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 cursor-pointer'
                      : 'bg-muted/40 text-muted-foreground border-border/40 cursor-not-allowed opacity-50',
                )}
              >
                {symbol}
                {count > 0 && (
                  <span className={cn('tabular-nums', isActive ? 'opacity-80' : 'opacity-60')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
            >
              Clear filter ×
            </button>
          )}
        </div>
      )}

      {/* Articles */}
      {filteredNews.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No news articles found for your watchlist symbols.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredNews.map((item, index) => (
            <article
              key={item.id}
              className="news-card animate-slide-up"
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
            >
              <a
                href={item.url !== '#' ? item.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'block p-4',
                  item.url !== '#' && 'cursor-pointer'
                )}
                aria-label={`Read article: ${item.title}`}
              >
                <div className="flex gap-4">
                  {/* Company logo for first related symbol */}
                  {item.relatedSymbols && item.relatedSymbols.length > 0 && (
                    <div className="hidden sm:flex flex-shrink-0 items-center justify-center w-12 h-12 rounded-xl overflow-hidden bg-muted/40 border border-border/40 self-center">
                      <StockLogo
                        ticker={item.relatedSymbols[0]}
                        name={item.relatedSymbols[0]}
                        size="md"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-medium text-sm leading-snug line-clamp-2 text-card-foreground">
                        {item.title}
                      </h3>
                      {item.url !== '#' && (
                        <ExternalLinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
                      )}
                    </div>

                    {item.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {item.summary}
                      </p>
                    )}

                    <div className={cn('flex items-center justify-between gap-2', item.summary ? '' : 'mt-1.5')}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.relatedSymbols?.slice(0, 4).map((symbol) => (
                          <Badge
                            key={symbol}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 font-mono-num border-primary/20 text-primary"
                          >
                            {symbol}
                          </Badge>
                        ))}
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {item.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-muted-foreground/50 font-medium tracking-wide uppercase">
                          {item.id.startsWith('db-') ? 'Yahoo Finance' : 'Finnhub'}
                        </span>
                        <time
                          dateTime={item.publishedAt.toISOString()}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"
                        >
                          <ClockIcon className="h-3 w-3" />
                          {formatDate(item.publishedAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}

      {/* JSON-LD structured data for news articles */}
      {filteredNews.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: filteredNews.slice(0, 10).map((item, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'NewsArticle',
                  headline: item.title,
                  description: item.summary,
                  url: item.url,
                  datePublished: item.publishedAt.toISOString(),
                  publisher: {
                    '@type': 'Organization',
                    name: item.source,
                  },
                  ...(item.imageUrl ? { image: item.imageUrl } : {}),
                },
              })),
            }),
          }}
        />
      )}
    </section>
  );
}

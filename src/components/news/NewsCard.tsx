
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { NewsItem, formatDate } from '@/utils/stocksApi';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon, ClockIcon } from 'lucide-react';

interface NewsCardProps {
  news: NewsItem[];
  watchlistSymbols?: string[];
  className?: string;
}

export function NewsCard({ news, watchlistSymbols, className }: NewsCardProps) {
  // Filter news by watchlist symbols if provided
  const filteredNews = watchlistSymbols?.length
    ? news.filter((item) =>
        item.relatedSymbols?.some((s) => watchlistSymbols.includes(s))
      )
    : news;

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

      {/* Watchlist filter chips */}
      {watchlistSymbols && watchlistSymbols.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Filtered symbols">
          {watchlistSymbols.map((symbol) => {
            const count = news.filter((n) =>
              n.relatedSymbols?.includes(symbol)
            ).length;
            return (
              <Badge
                key={symbol}
                variant={count > 0 ? 'default' : 'outline'}
                className={cn(
                  'text-xs font-mono-num transition-all duration-200',
                  count > 0 && 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                )}
              >
                {symbol}
                {count > 0 && (
                  <span className="ml-1 opacity-60">{count}</span>
                )}
              </Badge>
            );
          })}
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
                  {/* Image thumbnail */}
                  {item.imageUrl && (
                    <div className="hidden sm:block flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={item.imageUrl}
                        alt={`Illustration for: ${item.title}`}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        className="h-full w-full object-cover"
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

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.summary}
                    </p>

                    <div className="flex items-center justify-between gap-2">
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

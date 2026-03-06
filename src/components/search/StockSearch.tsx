import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import type { AutocompleteResult } from '@/services/searchService';

export function StockSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  const { data: results = [], isLoading, isFetching } = useAutocomplete(query.trim());

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset active index on results change
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const selectResult = useCallback((result: AutocompleteResult) => {
    setQuery('');
    setIsOpen(false);
    const exchange = result.exchangeCode || 'US';
    const params = new URLSearchParams({ symbol: result.symbol, exchange });
    if (result.name && result.name !== result.symbol) {
      params.set('name', result.name);
    }
    navigate(`/stocks?${params.toString()}`);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          selectResult(results[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, activeIndex, selectResult]);

  const showDropdown = isOpen && query.trim().length > 0 && (results.length > 0 || isLoading);

  return (
    <div ref={containerRef} className={cn("relative", className)} role="combobox" aria-expanded={showDropdown} aria-haspopup="listbox">
      <div className="relative flex items-center h-9 rounded-md px-3 text-muted-foreground focus-within:text-foreground bg-muted/50 transition-colors focus-within:bg-muted/80 border border-transparent focus-within:border-border">
        <Search className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
        <Input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label="Search stocks and symbols"
          aria-autocomplete="list"
          aria-controls="search-results-list"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          placeholder="Search stocks..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 w-[180px] lg:w-[280px] bg-transparent border-none px-0 py-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
        />
        {isFetching && query.length >= 1 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          id="search-results-list"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 mt-1.5 w-full min-w-[380px] max-h-[420px] overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 py-1"
        >
          {/* Results header */}
          {results.length > 0 && (
            <li className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground select-none" role="presentation">
              Stocks · {results.length} result{results.length !== 1 ? 's' : ''}
            </li>
          )}

          {results.map((result, idx) => (
            <AutocompleteItem
              key={`${result.symbol}.${result.exchangeCode || 'US'}`}
              result={result}
              query={query}
              index={idx}
              isActive={activeIndex === idx}
              onMouseEnter={() => setActiveIndex(idx)}
              onSelect={() => selectResult(result)}
            />
          ))}

          {isLoading && results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground" role="option" aria-selected={false}>
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1.5" />
              Searching…
            </li>
          )}
          {!isLoading && results.length === 0 && query.trim().length > 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground" role="option" aria-selected={false}>
              No results for "<span className="font-medium text-foreground">{query}</span>"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Highlight matching substring */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-primary font-semibold">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}



interface AutocompleteItemProps {
  result: AutocompleteResult;
  query: string;
  index: number;
  isActive: boolean;
  onMouseEnter: () => void;
  onSelect: () => void;
}

function AutocompleteItem({ result, query, index, isActive, onMouseEnter, onSelect }: AutocompleteItemProps) {
  const exchange = result.exchange || '';

  return (
    <li
      id={`search-result-${index}`}
      role="option"
      aria-selected={isActive}
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50"
      )}
      onMouseEnter={onMouseEnter}
      onMouseDown={e => {
        e.preventDefault();
        onSelect();
      }}
    >
      {/* Left: ticker + name */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-sm font-bold tracking-tight text-primary min-w-[60px]">
          <HighlightMatch text={result.symbol} query={query} />
        </span>
        <p className="text-sm text-muted-foreground truncate flex-1">
          <HighlightMatch text={result.name} query={query} />
        </p>
      </div>

      {/* Right: Exchange badge */}
      {exchange && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
          {exchange}
        </span>
      )}
    </li>
  );
}

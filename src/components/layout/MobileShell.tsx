import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { useStatement } from '@/contexts/StatementContext';
import { cn } from '@/lib/utils';
import { ViewModeToggle } from '@/components/layout/ViewModeToggle';

interface MobileShellProps {
  children: React.ReactNode;
  title: string;
}

/** Route path → page title map (mirrors Sidebar navItems). */
const TITLE_MAP: Record<string, string> = {
  '/':                'Dashboard',
  '/stocks':          'Stocks',
  '/watchlists':      'Watchlists',
  '/markets':         'Markets',
  '/currencies':      'Currencies',
  '/global':          'Global',
  '/portfolio':       'Portfolio',
  '/performance':     'Performance',
  '/risk-analysis':   'Risk Analysis',
  '/analysis':        'Analysis',
  '/screener':        'Screener',
  '/trading':         'Trading',
  '/calculators':     'Calculators',
  '/journal':         'Journal',
  '/settings':        'Settings',
};

export function MobileShell({ children, title }: MobileShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  const location = useLocation();
  const pageTitle = TITLE_MAP[location.pathname] ?? title;

  const { parsedStatement, fileName, isParsingFile, handleFileUpload, clearStatement } = useStatement();
  const portfolioMeta = parsedStatement
    ? `${parsedStatement.meta.broker || 'Statement'} • ${parsedStatement.openPositions.length} pos`
    : null;

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur-sm z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <span className="font-semibold text-sm tracking-tight">{pageTitle}</span>

        <div className="flex items-center gap-1">
        <ViewModeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 animate-fade-in">
          {children}
        </div>
      </main>

      {/* ── Drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar drawer ── */}
      <aside className={cn(
        "fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out",
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          isCollapsed={false}
          onToggle={() => setDrawerOpen(false)}
          onNavigate={() => setDrawerOpen(false)}
          portfolioFileName={fileName}
          portfolioMeta={portfolioMeta}
          onClearStatement={clearStatement}
          onFileUpload={handleFileUpload}
          isParsingFile={isParsingFile}
        />
      </aside>
    </div>
  );
}


import React from 'react';
import {
  BarChart, PieChart, BarChart3, Wallet, LineChart, Globe,
  DollarSign, Settings, ChevronRight, ChevronLeft, Home, Search, CandlestickChart, ShieldAlert,
  FileText, Upload, X, Calculator, Star, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useLocation } from 'react-router-dom';
import MarketTimeline from '@/components/layout/MarketTimeline';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  portfolioFileName?: string | null;
  portfolioMeta?: string | null;
  onClearStatement?: () => void;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isParsingFile?: boolean;
}

export function Sidebar({ isCollapsed, onToggle, className, portfolioFileName, portfolioMeta, onClearStatement, onFileUpload, isParsingFile }: SidebarProps) {
  const location = useLocation();

  const navItems = [
    { title: 'Dashboard', icon: Home, href: '/' },
    { title: 'Stocks', icon: BarChart, href: '/stocks' },
    { title: 'Watchlists', icon: Star, href: '/watchlists' },
    { title: 'Markets', icon: BarChart3, href: '/markets' },
    { title: 'Currencies', icon: DollarSign, href: '/currencies' },
    { title: 'Global', icon: Globe, href: '/global' },
    { title: 'Portfolio', icon: Wallet, href: '/portfolio' },
    { title: 'Performance', icon: LineChart, href: '/performance' },
    { title: 'Risk Analysis', icon: ShieldAlert, href: '/risk-analysis' },
    { title: 'Analysis', icon: PieChart, href: '/analysis' },
    { title: 'Screener', icon: Search, href: '/screener' },
    { title: 'Trading', icon: CandlestickChart, href: '/trading' },
    { title: 'Fee Calculators', icon: Calculator, href: '/fee-calculators' },
    { title: 'Journal', icon: BookOpen, href: '/journal' },
    { title: 'Settings', icon: Settings, href: '/settings' },
  ];

  const isOnPortfolio = location.pathname === '/portfolio';

  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground relative transition-all duration-300 ease-in-out flex flex-col border-r border-sidebar-border overflow-hidden",
      isCollapsed ? "w-16" : "w-56",
      className
    )}>
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
        <h2 className={cn(
          "font-semibold tracking-tight transition-opacity duration-200",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}>
          MarketPulse
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "absolute right-2 text-sidebar-foreground h-8 w-8",
            isCollapsed ? "right-2" : "right-4"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-2" viewportClassName="!overflow-x-hidden">
        <nav className="grid gap-0.5 px-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={index}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className={cn(
                  "text-sm font-medium transition-opacity duration-200",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100"
                )}>
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Market timeline visualization */}
        {!isCollapsed && <MarketTimeline />}

        {/* Portfolio file info — below market timeline */}
        {!isCollapsed && isOnPortfolio && (
          <div className="px-3 mt-2 mb-1" style={{ maxWidth: '14rem' }}>
            {portfolioFileName ? (
              <div className="rounded-md bg-sidebar-accent/30 px-2.5 py-2 text-xs overflow-hidden">
                <div className="flex items-start gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[10px] font-medium truncate text-sidebar-foreground" title={portfolioFileName}>
                      {portfolioFileName}
                    </p>
                    {portfolioMeta && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={portfolioMeta}>{portfolioMeta}</p>
                    )}
                  </div>
                  {onClearStatement && (
                    <button onClick={onClearStatement} className="text-muted-foreground hover:text-foreground shrink-0 ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ) : onFileUpload ? (
              <label className="flex items-center gap-2 rounded-md bg-sidebar-accent/30 px-2.5 py-2 text-[10px] text-muted-foreground cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>{isParsingFile ? 'Parsing…' : 'Upload CSV'}</span>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={onFileUpload} disabled={isParsingFile} />
              </label>
            ) : null}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

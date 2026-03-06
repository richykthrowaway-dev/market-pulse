
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { TradingViewTickerTape } from '@/components/tradingview';
import { useStatement } from '@/contexts/StatementContext';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  /** Meta description for SEO */
  description?: string;
  /** Canonical path (e.g. "/portfolio") */
  canonical?: string;
}

export function PageLayout({ children, title, description, canonical }: PageLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { parsedStatement, fileName, isParsingFile, handleFileUpload, clearStatement } = useStatement();

  // SEO meta tags
  useEffect(() => {
    if (description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = `${window.location.origin}${canonical}`;
    }
  }, [description, canonical]);

  const portfolioMeta = parsedStatement
    ? `${parsedStatement.meta.broker || 'Statement'} • ${parsedStatement.openPositions.length} pos • ${parsedStatement.trades.length} trades`
    : null;
  
  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <TradingViewTickerTape className="border-b border-border" />
      
      <div className="flex-1 flex">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          portfolioFileName={fileName}
          portfolioMeta={portfolioMeta}
          onClearStatement={clearStatement}
          onFileUpload={handleFileUpload}
          isParsingFile={isParsingFile}
        />
        
        <main className="flex-1 transition-all duration-300">
          <div className="container max-w-full p-4 lg:p-6 animate-fade-in">
            <h1 className="text-2xl font-bold mb-6">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

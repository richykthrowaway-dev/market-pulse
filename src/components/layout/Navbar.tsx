
import React, { useEffect, useState } from 'react';
import { Bell, ChevronLeft, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StockSearch } from '@/components/search/StockSearch';
import { useNavbarSlot } from '@/contexts/NavbarSlotContext';
import { ViewModeToggle } from '@/components/layout/ViewModeToggle';

interface NavbarProps {
  className?: string;
  /** Content rendered in the middle gap between search and right controls */
  centerContent?: React.ReactNode;
}

export function Navbar({ className, centerContent }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';
  const { slot } = useNavbarSlot();
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' is the key React Router assigns to the very first (entry) page;
  // any subsequent navigation gets a generated key, meaning there's history to pop.
  const canGoBack = location.key !== 'default';

  return (
    <header className={cn("bg-background/95 backdrop-blur-sm sticky top-0 z-30 border-b", className)}>
      <div className="container flex items-center h-16 px-4 gap-4">
        {/* Left: back + brand + search */}
        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold tracking-tight lg:text-xl">MarketPulse</h1>
          <StockSearch className="hidden md:block" />
        </div>

        {/* Middle: fills the gap between search and right controls */}
        <div className="flex-1 flex items-center">
          {centerContent ?? slot}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-4 shrink-0">
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

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-9 w-9"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </Button>
          
          <Avatar className="h-9 w-9 transition-transform duration-200 hover:scale-105">
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>

        </div>
      </div>
    </header>
  );
}

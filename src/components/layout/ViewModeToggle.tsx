import { Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile, setViewMode } from '@/hooks/useIsMobile';

/**
 * Manual mobile/desktop view toggle.
 *
 * Stores the user's choice in localStorage so it persists across reloads.
 * Clicking flips between explicit 'mobile' and 'desktop' — there's no
 * "auto" path in the UI because the moment you click, you've expressed a
 * preference. (Clear localStorage to return to UA-based auto-detection.)
 */
export function ViewModeToggle() {
  const isMobile = useIsMobile();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setViewMode(isMobile ? 'desktop' : 'mobile')}
      aria-label={isMobile ? 'Switch to desktop view' : 'Switch to mobile view'}
      title={isMobile ? 'Switch to desktop view' : 'Switch to mobile view'}
    >
      {isMobile
        ? <Monitor    className="h-5 w-5" />
        : <Smartphone className="h-5 w-5" />}
    </Button>
  );
}

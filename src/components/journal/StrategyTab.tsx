import { useState, useEffect } from 'react';
import { useStrategyDoc } from '@/hooks/useStrategyDoc';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Crosshair, LogOut, ShieldCheck, TrendingUp,
  Sun, Ban, Clock, BarChart2, StickyNote, Pencil,
} from 'lucide-react';

// ── Section definitions ───────────────────────────────────────────────────────

interface SectionDef {
  field: keyof Omit<import('@/hooks/useStrategyDoc').StrategyDoc, 'name' | 'updatedAt'>;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  rows?: number;
}

const SECTIONS: SectionDef[] = [
  {
    field: 'edge',
    label: 'My Edge',
    icon: <TrendingUp className="h-4 w-4" />,
    placeholder:
      'Why does this strategy work? What advantage do you have over other market participants?\n\nExamples:\n• I trade breakouts on low-float stocks where institutional algos are slower\n• I exploit earnings drift in the first 30 minutes post-open\n• I have faster execution than retail via direct routing',
    rows: 5,
  },
  {
    field: 'instruments',
    label: 'Instruments I Trade',
    icon: <BarChart2 className="h-4 w-4" />,
    placeholder:
      'What do you trade and why?\n\nExamples:\n• US equities: small/mid cap ($500M–$5B), min 500k avg volume\n• SPY / QQQ options on high-IV days only\n• No OTC, no crypto, no leveraged ETFs',
    rows: 3,
  },
  {
    field: 'tradingHours',
    label: 'Trading Hours',
    icon: <Clock className="h-4 w-4" />,
    placeholder:
      'When do you trade?\n\nExamples:\n• 9:30–11:00 ET and 14:00–15:30 ET only\n• Never in the first 5 minutes of open\n• No trades on FOMC days or pre-market earnings',
    rows: 3,
  },
  {
    field: 'marketConditions',
    label: 'Market Conditions to Trade',
    icon: <Sun className="h-4 w-4" />,
    placeholder:
      'When is your strategy in its element?\n\nExamples:\n• Trending days (SPY +/- 0.5% by 10 AM)\n• VIX below 25\n• Clear sector rotation or news catalyst\n• Stocks with relative strength vs sector',
    rows: 4,
  },
  {
    field: 'avoidConditions',
    label: 'Conditions to Avoid',
    icon: <Ban className="h-4 w-4" />,
    placeholder:
      'When should you sit on your hands?\n\nExamples:\n• Choppy/range-bound tape (SPY ±0.2% by 10 AM)\n• VIX above 30\n• Monday open and Friday close\n• After 2 consecutive losing trades in one day',
    rows: 4,
  },
  {
    field: 'entryCriteria',
    label: 'Entry Criteria',
    icon: <Crosshair className="h-4 w-4" />,
    placeholder:
      'What conditions must ALL be true before you pull the trigger?\n\nExamples:\n• Price breaks above the pre-market high on 2× average volume\n• RSI(14) > 55 on the daily, not extended\n• Level 2 shows no large offers within 2% of entry\n• Entry only on first or second test of the level\n• Risk defined: stop is below the breakout candle low',
    rows: 6,
  },
  {
    field: 'exitRules',
    label: 'Exit Plan',
    icon: <LogOut className="h-4 w-4" />,
    placeholder:
      'How and when do you exit — both winners and losers?\n\nTarget exits:\n• Scale out 50% at 1R, let runner go to 2R\n• Trail stop to breakeven after 1R hit\n• Sell full position into volume climax\n\nStop exits:\n• Initial stop: below breakout candle low\n• No exceptions — stop is stop\n\nTime exits:\n• Close position by 3:45 PM no matter what\n• Exit if trade doesn\'t move within 15 minutes',
    rows: 8,
  },
  {
    field: 'riskManagement',
    label: 'Risk Management Rules',
    icon: <ShieldCheck className="h-4 w-4" />,
    placeholder:
      'Your non-negotiable risk rules:\n\nExamples:\n• Max risk per trade: 0.5% of account\n• Max 3 positions open at once\n• Daily max loss: $500 — stop trading for the day\n• Weekly max loss: $1,500 — review before Monday\n• No averaging down\n• No moving stop further away from entry',
    rows: 5,
  },
  {
    field: 'positionSizing',
    label: 'Position Sizing',
    icon: <Pencil className="h-4 w-4" />,
    placeholder:
      'How do you determine share/contract count?\n\nExamples:\n• Fixed risk: shares = (account × 0.5%) ÷ (entry − stop)\n• Full-sized when A+ setup; half-sized when B setup\n• Never exceed 20% of account in a single stock\n• Reduce size by 50% after any losing week',
    rows: 4,
  },
  {
    field: 'notes',
    label: 'Strategy Notes & Refinements',
    icon: <StickyNote className="h-4 w-4" />,
    placeholder:
      'Running log of observations, tweaks, and ideas:\n\n[2026-05-01] Noticed I underperform on Mondays — reduce size by 25%\n[2026-04-15] Gap fills working better when gap >3% — add to criteria\n[2026-03-20] Pullback entries outperforming breakout entries in choppy tape',
    rows: 5,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function StrategyTab() {
  const { doc, saveDoc } = useStrategyDoc();

  // Local draft state — keeps UI snappy, flushes on blur
  const [name, setName] = useState(doc.name);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.field, doc[s.field] as string]))
  );

  // Sync when stored doc changes (e.g. cross-tab)
  useEffect(() => {
    setName(doc.name);
    setFields(Object.fromEntries(SECTIONS.map(s => [s.field, doc[s.field] as string])));
  }, [doc]);

  function handleNameBlur() {
    if (name !== doc.name) saveDoc({ name });
  }

  function handleFieldBlur(field: string) {
    const val = fields[field];
    if (val !== (doc as Record<string, string>)[field]) {
      saveDoc({ [field]: val } as Parameters<typeof saveDoc>[0]);
    }
  }

  const lastSaved = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Strategy name + last-saved ──────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-sm font-medium mb-1.5 block">Strategy name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="e.g. Momentum Breakout v2"
              className="text-base font-semibold"
            />
          </div>
          {lastSaved && (
            <p className="text-xs text-muted-foreground pb-2">
              Last saved: {lastSaved}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          All sections auto-save when you click away. Use this document to define, refine, and hold yourself accountable to your trading plan.
        </p>
      </Card>

      {/* Sections ─────────────────────────────────────────────────────────── */}
      {SECTIONS.map(section => (
        <Card key={section.field} className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-muted-foreground">{section.icon}</span>
            <h3 className="text-sm font-semibold">{section.label}</h3>
          </div>
          <Textarea
            value={fields[section.field] ?? ''}
            onChange={e => setFields(prev => ({ ...prev, [section.field]: e.target.value }))}
            onBlur={() => handleFieldBlur(section.field)}
            placeholder={section.placeholder}
            rows={section.rows ?? 4}
            className="resize-y text-sm leading-relaxed placeholder:text-muted-foreground/50"
          />
        </Card>
      ))}

      {/* Footer note ──────────────────────────────────────────────────────── */}
      <p className="text-xs text-center text-muted-foreground pb-4">
        Your strategy document is stored locally in your browser. Back it up by copying the text to a file.
      </p>
    </div>
  );
}

import React, { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, BookOpen, CalendarDays, LineChart, List, Activity, BarChart3, ScrollText } from 'lucide-react';
import { useTradeJournal } from '@/hooks/useTradeJournal';
import type { TradeEntry } from '@/hooks/useTradeJournal';
import { PnLCalendar } from '@/components/journal/PnLCalendar';
import { TradeFormDialog } from '@/components/journal/TradeFormDialog';
import { TradeLogTable } from '@/components/journal/TradeLogTable';
import { JournalStatsRow } from '@/components/journal/JournalStatsRow';
import { HeroStatsRow } from '@/components/journal/HeroStatsRow';
import { CumulativePnLChart } from '@/components/journal/CumulativePnLChart';
import { DayDetailDialog } from '@/components/journal/DayDetailDialog';
import { OverviewTab } from '@/components/journal/OverviewTab';
import { AnalyticsTab } from '@/components/journal/AnalyticsTab';
import { RulesTab } from '@/components/journal/RulesTab';
import { useJournalSettings } from '@/hooks/useJournalSettings';
import { toast } from 'sonner';

const TradeJournal = () => {
  const { trades, addTrade, updateTrade, deleteTrade, dailyPnL, stats, cumulativePnL, tradesByDate, currentStreak } = useTradeJournal();
  const { settings } = useJournalSettings();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<TradeEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleSubmit = (data: Omit<TradeEntry, 'id' | 'createdAt'>) => {
    if (editingTrade) {
      updateTrade(editingTrade.id, data);
      toast.success('Trade updated');
    } else {
      addTrade(data);
      toast.success('Trade logged');
    }
  };

  const handleEdit = (trade: TradeEntry) => {
    setEditingTrade(trade);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteTrade(id);
    toast.success('Trade deleted');
  };

  const handleDayEdit = (trade: TradeEntry) => {
    setSelectedDay(null);
    setEditingTrade(trade);
    setFormOpen(true);
  };

  // Empty state
  if (trades.length === 0 && !formOpen) {
    return (
      <PageLayout title="Trade Journal">
        <div className="flex items-center justify-end mb-6">
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Log Trade
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <BookOpen className="h-16 w-16 text-muted-foreground opacity-30" />
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No trades logged yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Start journaling your trades to track performance over time.
            </p>
          </div>
          <Button size="lg" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Log Your First Trade
          </Button>
        </div>
        <TradeFormDialog
          open={formOpen}
          onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTrade(null); }}
          onSubmit={handleSubmit}
          initialValues={editingTrade}
          mode={editingTrade ? 'edit' : 'add'}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Trade Journal">
      {/* Header */}
      <div className="flex items-center justify-end mb-6">
        <Button onClick={() => { setEditingTrade(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Log Trade
        </Button>
      </div>

      {/* Stats */}
      <HeroStatsRow stats={stats} currentStreak={currentStreak} />

      {/* Tabbed content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Calendar
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-1.5">
            <LineChart className="h-4 w-4" /> Equity Curve
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="trades" className="gap-1.5">
            <List className="h-4 w-4" /> Trades
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <ScrollText className="h-4 w-4" /> Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab stats={stats} trades={trades} settings={settings} openEditTrade={(id) => {
            const trade = trades.find(t => t.id === id);
            if (trade) handleEdit(trade);
          }} />
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="p-6">
            <PnLCalendar dailyPnL={dailyPnL} onDayClick={setSelectedDay} />
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Cumulative P/L</h3>
            <CumulativePnLChart data={cumulativePnL} />
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab trades={trades} />
        </TabsContent>

        <TabsContent value="trades">
          <Card className="p-4">
            <TradeLogTable trades={trades} onEdit={handleEdit} onDelete={handleDelete} />
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TradeFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTrade(null); }}
        onSubmit={handleSubmit}
        initialValues={editingTrade}
        mode={editingTrade ? 'edit' : 'add'}
      />

      <DayDetailDialog
        date={selectedDay}
        trades={selectedDay ? (tradesByDate.get(selectedDay) ?? []) : []}
        onClose={() => setSelectedDay(null)}
        onEdit={handleDayEdit}
      />
    </PageLayout>
  );
};

export default TradeJournal;

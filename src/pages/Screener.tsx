import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TradingViewScreener, TradingViewEconomicCalendar } from '@/components/tradingview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockSearch } from '@/components/search/StockSearch';

const Screener = () => {
  return (
    <PageLayout title="Screener & Calendar">
      <Tabs defaultValue="screener" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="screener">Stock Screener</TabsTrigger>
          <TabsTrigger value="calendar">Economic Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="screener">
          <div className="mb-4">
            <StockSearch
              placeholder="Search by ticker or company name..."
              className="max-w-md"
            />
          </div>
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <TradingViewScreener
              defaultColumn="overview"
              defaultScreen="most_capitalized"
              market="america"
              showToolbar={true}
              height={550}
              className="w-full"
            />
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="bg-card rounded-lg p-4 shadow border border-border">
            <TradingViewEconomicCalendar
              height={600}
              importanceFilter="-1,0,1"
              className="w-full"
            />
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default Screener;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";
import { COUNTRY_META } from "@/data/countryMeta";
import { useCountryStocks } from "@/hooks/useCountryStocks";
import type { ExchangeInfo } from "@/data/exchangeData";
import CountrySummary from "./CountrySummary";
import CountryScreener from "./CountryScreener";
import CountryExchanges from "./CountryExchanges";
import CountryNews from "./CountryNews";
import CountryEconomy from "./CountryEconomy";

interface CountryPanelProps {
  iso2: string;
  onClose: () => void;
  onTabChange?: (tab: string) => void;
  onExchangeClick?: (exchange: ExchangeInfo) => void;
}

export default function CountryPanel({ iso2, onClose, onTabChange, onExchangeClick }: CountryPanelProps) {
  const { data: stocks = [], isLoading } = useCountryStocks(iso2);
  const meta = COUNTRY_META[iso2];

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right-5 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="font-semibold text-lg">{meta?.name ?? iso2}</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden" onValueChange={onTabChange}>
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="screener">Screener</TabsTrigger>
          <TabsTrigger value="exchanges">Exchanges</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="flex-1 overflow-y-auto px-4 pb-4">
          <CountrySummary iso2={iso2} stocks={stocks} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="news" className="flex-1 overflow-y-auto px-4 pb-4">
          <CountryNews iso2={iso2} />
        </TabsContent>
        <TabsContent value="screener" className="flex-1 overflow-y-auto px-4 pb-4">
          <CountryScreener iso2={iso2} />
        </TabsContent>
        <TabsContent value="exchanges" className="flex-1 overflow-y-auto px-4 pb-4">
          <CountryExchanges iso2={iso2} onExchangeClick={onExchangeClick} />
        </TabsContent>
        <TabsContent value="economy" className="flex-1 overflow-y-auto px-4 pb-4">
          <CountryEconomy iso2={iso2} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

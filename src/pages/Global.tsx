
import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useIndices } from '@/hooks/useSupabaseData';
import { Globe, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Flag } from '@/components/ui/Flag';

const Global = () => {
  const { data: indices = [], isLoading } = useIndices();
  
  const regions = [
    { name: 'North America', markets: ['United States', 'Canada'] },
    { name: 'Europe', markets: ['United Kingdom', 'Germany', 'France', 'Europe'] },
    { name: 'Asia-Pacific', markets: ['Japan', 'China', 'Hong Kong', 'Australia'] },
  ];
  
  return (
    <PageLayout title="Global Markets">
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-card rounded-lg p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">World Markets Overview</h2>
          </div>
          
          {isLoading ? (
            <p className="text-muted-foreground">Loading indices…</p>
          ) : indices.length === 0 ? (
            <p className="text-muted-foreground">No index data available. Run a market sync to populate.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {regions.map((region) => {
                const regionIndices = indices.filter(i => region.markets.includes(i.region));
                return (
                  <div key={region.name} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3">{region.name}</h3>
                    <ul className="space-y-3">
                      {regionIndices.length === 0 ? (
                        <li className="text-muted-foreground text-sm">No data</li>
                      ) : (
                        regionIndices.map((index) => (
                          <li key={index.symbol} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm flex items-center gap-1.5">
                                <Flag code={index.region} size={27} />
                                {index.name}
                              </span>
                              <span className="text-xs text-muted-foreground">{index.region}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-sm">
                                {index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={cn(
                                "flex items-center text-xs",
                                index.changePercent >= 0 ? "text-success" : "text-danger"
                              )}>
                                {index.changePercent >= 0 ?
                                  <ArrowUpIcon className="h-3 w-3 mr-0.5" /> :
                                  <ArrowDownIcon className="h-3 w-3 mr-0.5" />
                                }
                                {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                              </span>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          
          {!isLoading && indices.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              Last updated: {new Date(indices[0].lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Global;

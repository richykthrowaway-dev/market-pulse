import { useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { getCommodity } from '@/data/tradeInfrastructure/commodities';
import { COMMODITY_CONSUMERS } from '@/data/tradeInfrastructure/commodityConsumers';
import { COUNTRY_META } from '@/data/countryMeta';
import { cn } from '@/lib/utils';

function getFlagSrc(iso2: string) {
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

interface FlowRow {
  iso2:     string;
  produces: number;
  imports:  number;
  net:      number;   // produces − imports (positive = net exporter)
  role:     'exporter' | 'importer' | 'both';
}

export function CommodityFlowView({ selectedId }: { selectedId: string }) {
  const commodity = getCommodity(selectedId);
  const consumers = COMMODITY_CONSUMERS[selectedId] ?? [];

  const rows: FlowRow[] = useMemo(() => {
    if (!commodity) return [];
    const pMap = new Map(commodity.producers.map(p => [p.iso2, p.share]));
    const cMap = new Map(consumers.map(c => [c.iso2, c.share]));
    const all  = new Set([...pMap.keys(), ...cMap.keys()]);

    return [...all]
      .map((iso2): FlowRow => {
        const produces = pMap.get(iso2) ?? 0;
        const imports  = cMap.get(iso2) ?? 0;
        const net      = produces - imports;
        const role: FlowRow['role'] =
          produces > 0 && imports > 0 ? 'both'     :
          produces > 0                ? 'exporter' :
                                        'importer';
        return { iso2, produces, imports, net, role };
      })
      // Sort by absolute net position so the most extreme cases lead
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [commodity, consumers]);

  if (!commodity) return null;

  const bothCount     = rows.filter(r => r.role === 'both').length;
  const exporterCount = rows.filter(r => r.role === 'exporter').length;
  const importerCount = rows.filter(r => r.role === 'importer').length;

  return (
    <>
      {/* Summary chips */}
      <div className="px-4 pb-2 flex items-center flex-wrap gap-1.5 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
          {exporterCount} net exporters
        </span>
        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">
          {importerCount} net importers
        </span>
        <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">
          {bothCount} both producer &amp; buyer
        </span>
      </div>

      {/* Column headers */}
      <div className="px-4 pb-1 grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 text-[9px] uppercase tracking-wide text-muted-foreground/50">
        <span className="w-3" />
        <span>Country</span>
        <span className="w-11 text-right">Prod</span>
        <span className="w-11 text-right">Import</span>
        <span className="w-14 text-right">Balance</span>
      </div>

      <ul className="px-4 pb-2 space-y-1 max-h-64 overflow-y-auto">
        {rows.map(r => {
          const name = COUNTRY_META[r.iso2]?.name ?? r.iso2;
          const netPos = r.net >= 0;
          const RoleIcon =
            r.role === 'both'     ? ArrowUpDown :
            r.role === 'exporter' ? ArrowUp     :
                                    ArrowDown;
          const roleColor =
            r.role === 'both'     ? 'text-purple-400' :
            r.role === 'exporter' ? 'text-emerald-400' :
                                    'text-blue-400';

          return (
            <li
              key={r.iso2}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 items-center text-[11px] group"
            >
              {/* Role icon */}
              <RoleIcon className={cn('w-3 h-3 shrink-0', roleColor)} />

              {/* Flag + name */}
              <div className="flex items-center gap-1.5 min-w-0">
                <img
                  src={getFlagSrc(r.iso2)}
                  alt=""
                  width={16}
                  height={11}
                  className="shrink-0 rounded-[2px] ring-1 ring-border/40 object-cover"
                />
                <span
                  className="truncate text-foreground/85 group-hover:text-foreground transition-colors"
                  title={name}
                >
                  {name}
                </span>
              </div>

              {/* Produces */}
              <span className={cn(
                'w-11 text-right tabular-nums',
                r.produces > 0 ? 'text-emerald-400' : 'text-muted-foreground/30',
              )}>
                {r.produces > 0 ? `${r.produces.toFixed(1)}%` : '—'}
              </span>

              {/* Imports */}
              <span className={cn(
                'w-11 text-right tabular-nums',
                r.imports > 0 ? 'text-blue-400' : 'text-muted-foreground/30',
              )}>
                {r.imports > 0 ? `${r.imports.toFixed(1)}%` : '—'}
              </span>

              {/* Net balance */}
              <span className={cn(
                'w-14 text-right tabular-nums font-semibold',
                netPos ? 'text-emerald-400' : 'text-red-400',
              )}>
                {r.net > 0 ? '+' : ''}{r.net.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground/60">
        Prod% = share of global production · Import% = share of global import volume ·
        Balance is indicative only — denominators differ · USGS/USDA/UN Comtrade 2022-23
      </p>
    </>
  );
}

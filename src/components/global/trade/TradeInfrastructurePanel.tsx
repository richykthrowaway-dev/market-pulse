import { useMemo, useState, useCallback } from 'react';
import {
  Anchor, Plane, Train, MapPin, AlertTriangle,
  Layers, Compass, Search, Sparkles,
  Network, ShieldAlert, Globe2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STORY_MODES, NODE_COLOR, ROUTE_COLOR,
  type LayerKey, type TradeNode, type TradeRoute, type StoryMode,
} from '@/data/tradeInfrastructure';

/**
 * TradeInfrastructurePanel — the "intelligence panel" half of the Global
 * Trade Infrastructure section. Lives in the right-hand panel area; the
 * left half is the existing GlobeView extended with trade overlay props.
 *
 * Sections:
 *   1. Layer toggles (maritime / air / rail / ports / airports / chokepoints / hubs)
 *   2. Story-mode preset selector (overview, container, energy chokepoints…)
 *   3. Search (filters visible nodes by name)
 *   4. Selected-node detail card (when a node on the globe is clicked)
 *   5. Top metrics strip (placeholder cards for connectivity / risk overlays)
 *
 * The component is stateless about the layer selection — it reports up to
 * the parent via `onLayersChange`, so the parent can decide what to feed
 * the globe and persist the state. This makes it easy to share state
 * across tabs or reset on country change.
 */

// ── Layer config ────────────────────────────────────────────────────────────

interface LayerOption {
  key:      LayerKey;
  label:    string;
  icon:     React.ComponentType<{ className?: string }>;
  /** Visual color for the layer toggle dot — matches what's drawn on the globe. */
  color:    string;
  /** Group used in the panel to cluster related layers. */
  group:    'modes' | 'nodes' | 'overlays';
  /** Mark layers that are not yet implemented but reserved for future API integration. */
  future?:  boolean;
  hint?:    string;
}

const LAYERS: LayerOption[] = [
  { key: 'maritimeRoutes', label: 'Maritime Routes', icon: Anchor, color: ROUTE_COLOR.maritime, group: 'modes' },
  { key: 'airRoutes',      label: 'Air Cargo Routes', icon: Plane,  color: ROUTE_COLOR.air,      group: 'modes' },
  { key: 'railCorridors',  label: 'Rail Corridors',   icon: Train,  color: ROUTE_COLOR.rail,     group: 'modes' },
  { key: 'seaports',       label: 'Seaports',         icon: Anchor, color: NODE_COLOR.seaport,    group: 'nodes' },
  { key: 'airports',       label: 'Airports',         icon: Plane,  color: NODE_COLOR.airport,    group: 'nodes' },
  { key: 'chokepoints',    label: 'Chokepoints',      icon: AlertTriangle, color: NODE_COLOR.chokepoint, group: 'nodes' },
  { key: 'inlandHubs',     label: 'Inland Hubs',      icon: MapPin, color: NODE_COLOR.inlandHub,  group: 'nodes' },
  { key: 'connectivity',   label: 'Connectivity',     icon: Network, color: '#94a3b8', group: 'overlays', future: true, hint: 'UNCTAD LSCI / port-importance overlay (coming soon)' },
  { key: 'risk',           label: 'Risk / Disruption', icon: ShieldAlert, color: '#ef4444', group: 'overlays', future: true, hint: 'Live disruption + chokepoint risk score (coming soon)' },
  { key: 'liveVessels',    label: 'Live Vessels',     icon: Anchor, color: '#06b6d4', group: 'overlays', future: true, hint: 'AIS feed (free tier) — to be wired in' },
  { key: 'liveFlights',    label: 'Live Flights',     icon: Plane,  color: '#a855f7', group: 'overlays', future: true, hint: 'OpenSky / similar (free) — to be wired in' },
];

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  activeLayers:    Set<LayerKey>;
  onLayersChange:  (next: Set<LayerKey>) => void;
  selectedNode:    TradeNode | null;
  onSelectNode:    (n: TradeNode | null) => void;
  /** All nodes currently visible on the globe — drives the search. */
  visibleNodes:    TradeNode[];
  /** All routes currently visible on the globe — drives the route metrics. */
  visibleRoutes:   TradeRoute[];
  /** When true, scope is global; when false, scope is the current country (filtered upstream). */
  worldwide:       boolean;
  onToggleWorldwide: () => void;
  countryName?:    string;
}

export function TradeInfrastructurePanel({
  activeLayers, onLayersChange, selectedNode, onSelectNode,
  visibleNodes, visibleRoutes, worldwide, onToggleWorldwide, countryName,
}: Props) {
  const [search, setSearch] = useState('');

  const toggleLayer = useCallback((key: LayerKey) => {
    const next = new Set(activeLayers);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onLayersChange(next);
  }, [activeLayers, onLayersChange]);

  const applyStoryMode = useCallback((mode: StoryMode) => {
    onLayersChange(new Set(mode.layers));
  }, [onLayersChange]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return visibleNodes;
    const q = search.trim().toLowerCase();
    return visibleNodes
      .filter((n) =>
        n.name.toLowerCase().includes(q) ||
        n.region.toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [search, visibleNodes]);

  // Aggregate counts per layer for the metrics strip
  const counts = useMemo(() => {
    const c = { seaports: 0, airports: 0, chokepoints: 0, inlandHubs: 0, routes: visibleRoutes.length };
    for (const n of visibleNodes) {
      if (n.kind === 'seaport')    c.seaports++;
      else if (n.kind === 'airport')    c.airports++;
      else if (n.kind === 'chokepoint') c.chokepoints++;
      else if (n.kind === 'inlandHub')  c.inlandHubs++;
    }
    return c;
  }, [visibleNodes, visibleRoutes]);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* ── Header strip with scope toggle ─────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-primary" />
            Global Trade Infrastructure
          </h2>
          <button
            onClick={onToggleWorldwide}
            className={cn(
              'px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide transition-colors',
              worldwide
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}
            title={worldwide ? 'Showing global infrastructure' : `Showing infrastructure relevant to ${countryName ?? 'this country'}`}
          >
            {worldwide ? 'Worldwide' : `${countryName ?? 'Country'}-scoped`}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          The physical backbone of global commerce — ports, airports, chokepoints, rail and inland hubs — and the corridors connecting them. Click any node on the globe for detail.
        </p>
      </div>

      {/* ── Metrics strip ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 shrink-0">
        <MetricCard label="Seaports"     value={counts.seaports}    color={NODE_COLOR.seaport} />
        <MetricCard label="Airports"     value={counts.airports}    color={NODE_COLOR.airport} />
        <MetricCard label="Chokepoints"  value={counts.chokepoints} color={NODE_COLOR.chokepoint} />
        <MetricCard label="Inland Hubs"  value={counts.inlandHubs}  color={NODE_COLOR.inlandHub} />
        <MetricCard label="Routes"       value={counts.routes}      color={ROUTE_COLOR.maritime} />
        <MetricCard label="Live Sources" value="0" color="#475569" subText="future API hooks" />
      </div>

      {/* ── Layer toggles ─────────────────────────────────────────────── */}
      <Section title="Layers" icon={Layers}>
        <LayerGroup
          title="Transport modes"
          layers={LAYERS.filter((l) => l.group === 'modes')}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
        />
        <LayerGroup
          title="Infrastructure nodes"
          layers={LAYERS.filter((l) => l.group === 'nodes')}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
        />
        <LayerGroup
          title="Intelligence overlays"
          layers={LAYERS.filter((l) => l.group === 'overlays')}
          activeLayers={activeLayers}
          toggleLayer={toggleLayer}
        />
      </Section>

      {/* ── Story modes ──────────────────────────────────────────────── */}
      <Section title="Story modes" icon={Sparkles}>
        <div className="grid grid-cols-1 gap-1.5">
          {STORY_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => applyStoryMode(mode)}
              className="text-left px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium group-hover:text-primary transition-colors">{mode.title}</span>
                <Compass className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary/70" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{mode.description}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <Section title="Search" icon={Search}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Port, airport, country, tag…"
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {search.trim() && (
          <div className="mt-2 max-h-56 overflow-y-auto border border-border rounded-md divide-y divide-border/40 bg-card/50">
            {filteredNodes.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No matches in active layers.</p>
            ) : filteredNodes.map((n) => (
              <button
                key={n.id}
                onClick={() => onSelectNode(n)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-muted/40 transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_COLOR[n.kind] }} />
                <span className="text-xs font-medium truncate">{n.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0 uppercase tracking-wide">{n.kind}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* ── Selected node detail ──────────────────────────────────────── */}
      {selectedNode && (
        <NodeDetail node={selectedNode} onClose={() => onSelectNode(null)} />
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-t border-border">
      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        <Icon className="w-3 h-3" />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function LayerGroup({
  title, layers, activeLayers, toggleLayer,
}: {
  title: string;
  layers: LayerOption[];
  activeLayers: Set<LayerKey>;
  toggleLayer: (k: LayerKey) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">{title}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {layers.map((l) => {
          const active = activeLayers.has(l.key);
          const Icon = l.icon;
          return (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              disabled={l.future}
              title={l.hint}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors',
                l.future
                  ? 'border-dashed border-border/50 text-muted-foreground/50 cursor-not-allowed bg-muted/10'
                  : active
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color, opacity: l.future ? 0.4 : 1 }} />
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{l.label}</span>
              {l.future && <span className="ml-auto text-[8px] uppercase tracking-wider">soon</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, subText }: {
  label:    string;
  value:    number | string;
  color:    string;
  subText?: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 border border-border/60">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className="text-base font-semibold font-mono tabular-nums leading-tight mt-0.5">{value}</p>
      {subText && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{subText}</p>}
    </div>
  );
}

function NodeDetail({ node, onClose }: { node: TradeNode; onClose: () => void }) {
  const color = NODE_COLOR[node.kind];

  return (
    <div className="px-4 py-3 border-t border-border bg-card/50">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
          <h3 className="text-sm font-semibold">{node.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
        {node.kind} · {node.region}{node.countryISO2 ? ` · ${node.countryISO2}` : ''}
      </p>

      {node.description && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{node.description}</p>
      )}

      {node.strategicRole && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 mb-0.5">Strategic role</p>
          <p className="text-xs">{node.strategicRole}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <DetailStat label="Importance" value={`${node.importance}/100`} />
        {node.kind === 'seaport' && <DetailStat label="Category" value={node.category} />}
        {node.kind === 'airport' && (<>
          {node.iata && <DetailStat label="IATA" value={node.iata} />}
          <DetailStat label="Type" value={node.category} />
        </>)}
        {node.kind === 'chokepoint' && <DetailStat label="Modes" value={node.modes.join(', ')} />}
        {node.kind === 'inlandHub'  && <DetailStat label="Type" value={node.category} />}
        {node.metrics?.cargo_throughput_teu != null && (
          <DetailStat label="TEU / yr" value={`${node.metrics.cargo_throughput_teu.toFixed(1)}M`} />
        )}
        {node.metrics?.cargo_tonnage != null && (
          <DetailStat label="Tonnes / yr" value={`${node.metrics.cargo_tonnage.toFixed(1)}M`} />
        )}
      </div>

      {(node.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {node.tags!.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded p-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium capitalize mt-0.5 truncate">{value}</p>
    </div>
  );
}

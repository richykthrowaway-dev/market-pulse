import { useMemo, useState, useCallback } from 'react';
import {
  Anchor, Plane, Train, MapPin, AlertTriangle,
  Layers, Compass, Search, Sparkles,
  Network, ShieldAlert, Globe2, Radio, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STORY_MODES, NODE_COLOR, ROUTE_COLOR,
  type LayerKey, type TradeNode, type TradeRoute, type StoryMode,
} from '@/data/tradeInfrastructure';
import type { AISStatus } from '@/hooks/useAISStream';
import type { FlightStatus } from '@/hooks/useOpenSkyFlights';
import { useAirportDetail } from '@/hooks/useAirportDetail';

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
  { key: 'liveVessels',    label: 'Live Vessels',     icon: Radio,  color: '#67e8f9', group: 'overlays', hint: 'Real-time AIS feed (aisstream.io) — every cargo / tanker reporting position right now.' },
  { key: 'liveFlights',    label: 'Live Flights',     icon: Plane,  color: '#a855f7', group: 'overlays', hint: 'Live aircraft positions via OpenSky Network — all airborne traffic globally.' },
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
  /** AIS WebSocket status — surfaced in the Live Vessels banner when that layer is on. */
  aisStatus?:       AISStatus;
  /** Number of vessels currently tracked. */
  aisVesselCount?:  number;
  /** Total raw WebSocket messages received — shown for debugging when count is 0. */
  aisRawMsgCount?:  number;
  /** OpenSky poll status — surfaced in the Live Flights banner when that layer is on. */
  flightStatus?:    FlightStatus;
  /** Number of airborne aircraft currently tracked. */
  flightCount?:     number;
}

export function TradeInfrastructurePanel({
  activeLayers, onLayersChange, selectedNode, onSelectNode,
  visibleNodes, visibleRoutes, worldwide, onToggleWorldwide, countryName,
  aisStatus = 'idle', aisVesselCount = 0, aisRawMsgCount = 0,
  flightStatus = 'idle', flightCount = 0,
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

      {/* ── AIS Live Vessels banner (only when that layer is on) ───────── */}
      {activeLayers.has('liveVessels') && (
        <AISStatusBanner status={aisStatus} count={aisVesselCount} rawMsgCount={aisRawMsgCount} />
      )}

      {/* ── OpenSky Live Flights banner (only when that layer is on) ──── */}
      {activeLayers.has('liveFlights') && (
        <FlightStatusBanner status={flightStatus} count={flightCount} />
      )}

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
  const iata  = node.kind === 'airport' ? node.iata : undefined;

  // Fetch live AirportDB enrichment only for airport nodes that have an
  // IATA code.  React Query caches per ICAO for 24 h, so subsequent
  // selections of the same airport cost 0 extra API calls.
  const { data: apDetail, isLoading: apLoading, isError: apError } =
    useAirportDetail(iata);

  const longestRunway = apDetail?.runways?.length
    ? Math.max(...apDetail.runways.map((r) => r.length_ft ?? 0))
    : null;

  const surfaceLabel = apDetail?.runways?.[0]?.surface ?? null;

  const typeLabel: Record<string, string> = {
    large_airport:  'Large airport',
    medium_airport: 'Medium airport',
    small_airport:  'Small airport',
    heliport:       'Heliport',
    seaplane_base:  'Seaplane base',
  };

  return (
    <div className="px-4 py-3 border-t border-border bg-card/50">
      {/* Header */}
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

      {/* Static stats grid */}
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

      {/* ── AirportDB live enrichment (airport nodes only) ─────────────── */}
      {node.kind === 'airport' && iata && (
        <div className="mt-3 pt-2.5 border-t border-border/60">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70 mb-2 flex items-center gap-1">
            <Plane className="w-2.5 h-2.5" />
            Live airport data · airportdb.io
          </p>

          {apLoading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              Fetching airport data…
            </div>
          )}

          {apError && !apLoading && (
            <p className="text-[11px] text-destructive/80">
              Could not load airport data — check API key or network.
            </p>
          )}

          {apDetail && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {apDetail.municipality && (
                  <DetailStat label="City" value={apDetail.municipality} />
                )}
                {apDetail.elevation_ft != null && (
                  <DetailStat label="Elevation" value={`${apDetail.elevation_ft.toLocaleString()} ft`} />
                )}
                {apDetail.type && (
                  <DetailStat label="Class" value={typeLabel[apDetail.type] ?? apDetail.type} />
                )}
                {apDetail.runways?.length > 0 && (
                  <DetailStat label="Runways" value={String(apDetail.runways.length)} />
                )}
                {longestRunway != null && longestRunway > 0 && (
                  <DetailStat label="Longest runway" value={`${longestRunway.toLocaleString()} ft`} />
                )}
                {surfaceLabel && (
                  <DetailStat label="Surface" value={surfaceLabel} />
                )}
              </div>

              {/* Runway list — show if ≥ 2 runways */}
              {(apDetail.runways?.length ?? 0) >= 2 && (
                <div className="mt-2 space-y-1">
                  {apDetail.runways.slice(0, 4).map((rwy, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                      <span className="font-mono font-medium text-foreground/80">
                        {rwy.le_ident}/{rwy.he_ident}
                      </span>
                      <span>{rwy.length_ft?.toLocaleString() ?? '—'} ft</span>
                      <span className="uppercase">{rwy.surface?.slice(0, 3) ?? '—'}</span>
                      {rwy.lighted && <span className="text-yellow-400">💡</span>}
                    </div>
                  ))}
                  {apDetail.runways.length > 4 && (
                    <p className="text-[10px] text-muted-foreground/60 text-right">
                      +{apDetail.runways.length - 4} more
                    </p>
                  )}
                </div>
              )}

              {apDetail.wikipedia_link && (
                <a
                  href={apDetail.wikipedia_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-[10px] text-primary/70 hover:text-primary underline underline-offset-2 truncate"
                >
                  Wikipedia →
                </a>
              )}
            </>
          )}
        </div>
      )}

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

function FlightStatusBanner({ status, count }: { status: FlightStatus; count: number }) {
  let dotColor = '#94a3b8';
  let label    = 'Idle';
  let detail: React.ReactNode = null;

  switch (status) {
    case 'loading':
      dotColor = '#f59e0b';
      label    = 'Fetching live flights…';
      detail   = <p className="text-[10px] text-muted-foreground mt-1">Polling OpenSky Network for airborne aircraft…</p>;
      break;
    case 'live':
      dotColor = '#a855f7';
      label    = `Live · tracking ${count.toLocaleString()} aircraft`;
      detail   = (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] text-muted-foreground">
            Positions refresh every 60 s · OpenSky free tier (400 credits/day; global fetch = 4 credits/call).
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Set <span className="font-mono text-foreground/70">VITE_OPENSKY_CLIENT_ID</span> +{' '}
            <span className="font-mono text-foreground/70">VITE_OPENSKY_CLIENT_SECRET</span> for 4,000 credits/day.
          </p>
        </div>
      );
      break;
    case 'error':
      dotColor = '#ef4444';
      label    = 'Fetch error';
      detail   = (
        <p className="text-[10px] text-muted-foreground mt-1">
          Could not reach OpenSky Network — retrying with backoff. Check network or daily credit limit (400 credits anonymous).
        </p>
      );
      break;
    case 'idle':
    default:
      break;
  }

  return (
    <div className="px-4 py-2.5 border-t border-border bg-purple-500/5">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: dotColor,
            boxShadow: status === 'loading' || status === 'live' ? `0 0 6px ${dotColor}` : undefined,
            animation: status === 'loading' ? 'pulse 1.4s ease-in-out infinite' : undefined,
          }}
        />
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">OpenSky</span>
      </div>
      {detail}
    </div>
  );
}

function AISStatusBanner({
  status, count, rawMsgCount,
}: {
  status:      AISStatus;
  count:       number;
  rawMsgCount: number;
}) {
  let dotColor    = '#94a3b8';
  let label       = 'Disabled';
  let detail: React.ReactNode = null;

  switch (status) {
    case 'connecting':
      dotColor = '#f59e0b';
      label    = 'Connecting to AIS feed…';
      detail   = <p className="text-[10px] text-muted-foreground mt-1">Opening WebSocket to aisstream.io</p>;
      break;
    case 'connected':
      dotColor = '#22c55e';
      label    = `Live · tracking ${count.toLocaleString()} vessel${count === 1 ? '' : 's'}`;
      detail   = (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] text-muted-foreground">
            Position reports flow in continuously; the globe refreshes every 2 s.
          </p>
          {count === 0 && rawMsgCount === 0 && (
            <p className="text-[10px] text-amber-400">
              No messages received yet — server may be rate-limiting. Check browser DevTools → Console for <code>[AISStream]</code> entries.
            </p>
          )}
          {count === 0 && rawMsgCount > 0 && (
            <p className="text-[10px] text-amber-400">
              {rawMsgCount} message{rawMsgCount === 1 ? '' : 's'} received but 0 vessels parsed — see <code>[AISStream]</code> in DevTools Console for the raw message shape.
            </p>
          )}
          {count > 0 && rawMsgCount > 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              {rawMsgCount.toLocaleString()} messages received total.
            </p>
          )}
        </div>
      );
      break;
    case 'error':
      dotColor = '#ef4444';
      label    = 'Connection error';
      detail   = <p className="text-[10px] text-muted-foreground mt-1">Check your API key, network, or rate limits.</p>;
      break;
    case 'no-key':
      dotColor = '#ef4444';
      label    = 'API key missing';
      detail   = (
        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
          Get a free key at <span className="font-mono text-foreground/80">aisstream.io</span> (GitHub login),
          then add <span className="font-mono text-foreground/80">VITE_AISSTREAM_KEY=…</span> to your
          <span className="font-mono text-foreground/80"> .env.local</span> and restart the dev server.
        </p>
      );
      break;
    case 'idle':
    default:
      dotColor = '#94a3b8';
      label    = 'Idle';
      detail   = null;
  }

  return (
    <div className="px-4 py-2.5 border-t border-border bg-cyan-500/5">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: dotColor,
            boxShadow: status === 'connecting' || status === 'connected' ? `0 0 6px ${dotColor}` : undefined,
            animation: status === 'connecting' ? 'pulse 1.4s ease-in-out infinite' : undefined,
          }}
        />
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">AIS</span>
      </div>
      {detail}
    </div>
  );
}

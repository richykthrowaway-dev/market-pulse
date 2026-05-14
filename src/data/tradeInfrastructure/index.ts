/**
 * Barrel re-exports for the Global Trade Infrastructure dataset.
 *
 * Import from `@/data/tradeInfrastructure` to get any node / route /
 * story-mode collection plus all type definitions.
 */

export * from './types';
export { SEAPORTS }         from './seaports';
export { AIRPORTS }         from './airports';
export { CHOKEPOINTS }      from './chokepoints';
export { MARITIME_ROUTES }  from './maritimeRoutes';
export { AIR_ROUTES }       from './airRoutes';
export { RAIL_CORRIDORS }   from './railCorridors';
export { INLAND_HUBS }      from './inlandHubs';
export { STORY_MODES }      from './storyModes';

import { SEAPORTS }        from './seaports';
import { AIRPORTS }        from './airports';
import { CHOKEPOINTS }     from './chokepoints';
import { INLAND_HUBS }     from './inlandHubs';
import { MARITIME_ROUTES } from './maritimeRoutes';
import { AIR_ROUTES }      from './airRoutes';
import { RAIL_CORRIDORS }  from './railCorridors';
import type { TradeNode, TradeRoute, LayerKey } from './types';

/** Combined node array — used when "all" is the preferred filter. */
export const ALL_TRADE_NODES: TradeNode[] = [
  ...SEAPORTS,
  ...AIRPORTS,
  ...CHOKEPOINTS,
  ...INLAND_HUBS,
];

export const ALL_TRADE_ROUTES: TradeRoute[] = [
  ...MARITIME_ROUTES,
  ...AIR_ROUTES,
  ...RAIL_CORRIDORS,
];

/**
 * Resolve a (node-array, layer-set) view from the layer toggles. The
 * Trade panel calls this with the active layers and gets back exactly
 * the nodes the globe should render.
 */
export function getVisibleNodes(activeLayers: Set<LayerKey>): TradeNode[] {
  const out: TradeNode[] = [];
  if (activeLayers.has('seaports'))    out.push(...SEAPORTS);
  if (activeLayers.has('airports'))    out.push(...AIRPORTS);
  if (activeLayers.has('chokepoints')) out.push(...CHOKEPOINTS);
  if (activeLayers.has('inlandHubs'))  out.push(...INLAND_HUBS);
  return out;
}

export function getVisibleRoutes(activeLayers: Set<LayerKey>): TradeRoute[] {
  const out: TradeRoute[] = [];
  if (activeLayers.has('maritimeRoutes')) out.push(...MARITIME_ROUTES);
  if (activeLayers.has('airRoutes'))      out.push(...AIR_ROUTES);
  if (activeLayers.has('railCorridors'))  out.push(...RAIL_CORRIDORS);
  return out;
}

/** Marker color by node kind — single source so panel + globe agree. */
export const NODE_COLOR: Record<TradeNode['kind'], string> = {
  seaport:    '#38bdf8', // sky-400
  airport:    '#a78bfa', // violet-400
  chokepoint: '#f59e0b', // amber-500
  inlandHub:  '#10b981', // emerald-500
};

/** Route color by mode. */
export const ROUTE_COLOR: Record<'maritime' | 'air' | 'rail' | 'inland' | 'pipeline', string> = {
  maritime: '#38bdf8',
  air:      '#a78bfa',
  rail:     '#10b981',
  inland:   '#94a3b8',
  pipeline: '#f97316',
};

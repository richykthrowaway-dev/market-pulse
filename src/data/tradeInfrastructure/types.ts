/**
 * Type definitions for the Global Trade Infrastructure dataset.
 *
 * Designed so seed JSON can later be replaced by API responses (UNCTAD,
 * WITS, Logistics Performance Index, AIS feeds, OpenSky for flights)
 * without rewriting consumers. All node types share a `TradeNode` base
 * so the globe layer can render heterogeneous markers from a single
 * `pointsData` array.
 */

export type TransportMode = 'maritime' | 'air' | 'rail' | 'inland';

export type LayerKey =
  | 'maritimeRoutes'
  | 'airRoutes'
  | 'railCorridors'
  | 'seaports'
  | 'airports'
  | 'chokepoints'
  | 'inlandHubs'
  | 'liveVessels'        // future
  | 'liveFlights'        // future
  | 'conflictEvents'     // ACLED + GDELT geocoded events
  | 'earthquakes'        // USGS M2.5+ seismic events
  | 'connectivity'       // future overlay
  | 'risk';              // future overlay

export interface TradeNodeBase {
  id:              string;
  name:            string;
  countryISO2?:    string;          // 2-letter ISO when applicable
  region:          string;          // 'Asia', 'Europe', etc. — broad region
  lat:             number;
  lng:             number;
  /** 0–100 importance score (curated; later replaceable with model-derived value). */
  importance:      number;
  description?:    string;
  strategicRole?:  string;
  /** Free-form tags for filtering/search ("LNG", "transshipment", "founder-route"). */
  tags?:           string[];
  /** Forward references to corridor IDs the node anchors. */
  relatedRoutes?:  string[];
  /** Placeholder metrics block — schema is open so future overlays can hang fields here. */
  metrics?:        Partial<{
    liner_connectivity:   number; // UNCTAD LSCI proxy
    cargo_throughput_teu: number; // millions of TEU/year
    cargo_tonnage:        number; // millions of metric tons / year (air or bulk)
    logistics_perf_index: number; // World Bank LPI proxy
    risk_score:           number; // 0–100, higher = riskier
  }>;
}

export interface Seaport extends TradeNodeBase {
  kind:    'seaport';
  /** Functional cargo mix the port specialises in. */
  category:
    | 'container'
    | 'bulk'
    | 'energy'
    | 'mixed'
    | 'transshipment'
    | 'strategic';
}

export interface Airport extends TradeNodeBase {
  kind:    'airport';
  iata?:   string;
  category:
    | 'air-cargo-hub'
    | 'pax-cargo-hub'
    | 'regional-logistics'
    | 'integrator-hub';
}

export interface Chokepoint extends TradeNodeBase {
  kind: 'chokepoint';
  /** Modes that this chokepoint constrains. */
  modes: TransportMode[];
}

export interface InlandHub extends TradeNodeBase {
  kind: 'inlandHub';
  category:
    | 'dry-port'
    | 'intermodal-gateway'
    | 'rail-hub'
    | 'logistics-zone';
}

export type TradeNode = Seaport | Airport | Chokepoint | InlandHub;

/** Edge connecting two coordinates — maritime, air, or rail corridor. */
export interface TradeRoute {
  id:           string;
  name:         string;
  mode:         TransportMode;
  /** Lat/lng of corridor start. */
  startLat:     number;
  startLng:     number;
  endLat:       number;
  endLng:       number;
  /** 0–100 importance score; drives arc stroke width / opacity. */
  importance:   number;
  description?: string;
  /** IDs of chokepoints / nodes this route passes through. */
  passesThrough?: string[];
  tags?:        string[];
  /**
   * Intermediate waypoints that guide the route around land masses.
   * When present, the renderer traces start → wp[0] → … → wp[n] → end
   * instead of drawing a straight great-circle chord.
   * Maritime routes always supply these; air routes use them only for
   * transpolar legs where the GC path needs to arc visibly over the pole.
   */
  waypoints?: Array<{ lat: number; lng: number }>;
}

/** A guided story-mode preset that reframes the globe + panel. */
export interface StoryMode {
  id:          string;
  title:       string;
  description: string;
  /** Layers to enable (others are forced off). */
  layers:      LayerKey[];
  /** Optional camera focus — { lat, lng, altitude }. */
  focus?:      { lat: number; lng: number; altitude?: number };
}

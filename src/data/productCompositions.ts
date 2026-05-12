/**
 * Product → Commodity composition map.
 *
 * Each product is broken down into subsystems, and each subsystem lists the
 * raw materials it depends on. Where the material maps onto a commodity we
 * already track in `commodities.ts`, `commodityId` is set so the UI can link
 * back to producer data. Untracked materials (steel, rare earths, graphite,
 * etc.) carry `commodityId: null` and render with a dimmer "*" indicator.
 *
 * Criticality scale (instead of fake percentages):
 *   - critical:  product literally cannot be built without it
 *   - important: significant input, substitution is hard/expensive
 *   - trace:     small but functionally necessary input
 *
 * Sources are public industry teardowns, USGS Mineral Commodity Summaries,
 * IEA Critical Minerals reports, and DoD supply-chain reviews. Quantities
 * are order-of-magnitude approximations for educational illustration only.
 */

export type Criticality = 'critical' | 'important' | 'trace';

export interface ProductComponent {
  /** ID from `commodities.ts`, or null for untracked raw materials. */
  commodityId: string | null;
  /** Display name (use commodity label if commodityId set). */
  name: string;
  /** Where in the subsystem it goes / what role it plays. */
  role: string;
  criticality: Criticality;
  /** Optional approximate amount per unit. */
  approxAmount?: string;
}

export interface ProductSubsystem {
  label: string;
  components: ProductComponent[];
}

export interface ProductComposition {
  id: string;
  label: string;
  category:
    | 'transport'
    | 'electronics'
    | 'energy'
    | 'military'
    | 'infrastructure'
    | 'industrial'
    | 'consumer';
  /** Short tagline shown under the product name. */
  description: string;
  /** Optional scale/unit context (per car, per chip, per turbine, etc.). */
  scaleNote?: string;
  subsystems: ProductSubsystem[];
}

export const PRODUCT_COMPOSITIONS: ProductComposition[] = [
  // ── Transport ──────────────────────────────────────────────────────────────
  {
    id: 'ev',
    label: 'Electric Vehicle',
    category: 'transport',
    description: 'Battery-electric passenger car (≈ Tesla Model 3-class).',
    scaleNote: 'Per vehicle · battery pack ~60 kWh',
    subsystems: [
      {
        label: 'Battery pack (cathode + anode)',
        components: [
          { commodityId: 'lithium',   name: 'Lithium',   role: 'Cathode + electrolyte salt',           criticality: 'critical',  approxAmount: '~8 kg LCE' },
          { commodityId: 'nickel',    name: 'Nickel',    role: 'NMC/NCA cathode',                       criticality: 'critical',  approxAmount: '~40 kg' },
          { commodityId: 'cobalt',    name: 'Cobalt',    role: 'Cathode stabilizer',                    criticality: 'critical',  approxAmount: '~8 kg' },
          { commodityId: 'manganese', name: 'Manganese', role: 'Cathode (NMC)',                         criticality: 'important', approxAmount: '~10 kg' },
          { commodityId: 'copper',    name: 'Copper',    role: 'Anode current collector + wiring',      criticality: 'critical',  approxAmount: '~55 kg' },
          { commodityId: null,        name: 'Graphite*', role: 'Anode active material',                 criticality: 'critical',  approxAmount: '~50 kg' },
        ],
      },
      {
        label: 'Drive motor & power electronics',
        components: [
          { commodityId: null,      name: 'Rare earths (Nd, Dy)*', role: 'Permanent magnets in motor', criticality: 'critical',  approxAmount: '~1–2 kg' },
          { commodityId: 'copper',  name: 'Copper',                role: 'Stator windings + inverter',  criticality: 'critical' },
          { commodityId: 'silver',  name: 'Silver',                role: 'Power electronics contacts',  criticality: 'trace' },
        ],
      },
      {
        label: 'Chassis & body',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum',    role: 'Body panels + battery enclosure',     criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',      role: 'Frame, suspension, crash structure',  criticality: 'critical' },
          { commodityId: 'natural-rubber', name: 'Natural rubber', role: 'Tires + seals',              criticality: 'important' },
        ],
      },
    ],
  },

  // ── Electronics ────────────────────────────────────────────────────────────
  {
    id: 'smartphone',
    label: 'Smartphone',
    category: 'electronics',
    description: 'Flagship handset (≈ iPhone / Galaxy class).',
    scaleNote: 'Per device · ~180 g total',
    subsystems: [
      {
        label: 'Battery',
        components: [
          { commodityId: 'lithium', name: 'Lithium', role: 'Li-ion cell',           criticality: 'critical' },
          { commodityId: 'cobalt',  name: 'Cobalt',  role: 'Cathode',               criticality: 'critical' },
          { commodityId: null,      name: 'Graphite*', role: 'Anode',                criticality: 'critical' },
        ],
      },
      {
        label: 'Logic board & display',
        components: [
          { commodityId: 'gold',     name: 'Gold',     role: 'PCB plating, contacts',           criticality: 'important', approxAmount: '~30 mg' },
          { commodityId: 'silver',   name: 'Silver',   role: 'Conductive paste',                criticality: 'important', approxAmount: '~300 mg' },
          { commodityId: 'palladium',name: 'Palladium',role: 'Capacitor termination',           criticality: 'important' },
          { commodityId: 'platinum', name: 'Platinum', role: 'Hard-disk magnetics, sensors',    criticality: 'trace' },
          { commodityId: 'copper',   name: 'Copper',   role: 'Traces & antenna',                criticality: 'critical' },
          { commodityId: 'tin',      name: 'Tin',      role: 'Solder',                          criticality: 'critical' },
          { commodityId: null,       name: 'Rare earths (Nd, Pr, Eu)*', role: 'Speakers, vibration, OLED phosphors', criticality: 'important' },
          { commodityId: null,       name: 'Indium / Gallium*', role: 'Touchscreen ITO, RF amplifier',                 criticality: 'critical' },
        ],
      },
      {
        label: 'Casing',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Frame',                criticality: 'critical' },
          { commodityId: null,       name: 'Glass*',   role: 'Front + back panels',  criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'chip',
    label: 'Computer Chip (Logic IC)',
    category: 'electronics',
    description: 'Leading-edge logic die (≈ smartphone SoC / GPU class).',
    scaleNote: 'Per die · 100–800 mm²',
    subsystems: [
      {
        label: 'Wafer & doping',
        components: [
          { commodityId: null, name: 'Silicon (electronic-grade)*', role: 'Wafer substrate',           criticality: 'critical' },
          { commodityId: null, name: 'Gallium / Germanium*',        role: 'Compound semis, RF dies',    criticality: 'important' },
          { commodityId: null, name: 'Phosphorus / Boron / Arsenic*', role: 'Dopants',                  criticality: 'critical' },
        ],
      },
      {
        label: 'Interconnect & packaging',
        components: [
          { commodityId: 'copper', name: 'Copper', role: 'Damascene interconnect',                  criticality: 'critical' },
          { commodityId: 'gold',   name: 'Gold',   role: 'Wire bonds & pad finish',                 criticality: 'important' },
          { commodityId: 'silver', name: 'Silver', role: 'Die-attach paste',                        criticality: 'important' },
          { commodityId: 'tin',    name: 'Tin',    role: 'Solder bumps (BGA)',                      criticality: 'critical' },
          { commodityId: null,     name: 'Tantalum*', role: 'High-k capacitors',                     criticality: 'important' },
          { commodityId: null,     name: 'Tungsten*', role: 'Via plugs',                              criticality: 'critical' },
        ],
      },
      {
        label: 'Fab process inputs',
        components: [
          { commodityId: null, name: 'Neon / Xenon (gases)*', role: 'EUV/DUV laser carrier gas',    criticality: 'critical' },
          { commodityId: null, name: 'Hydrofluoric acid*',    role: 'Etch chemistry',               criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Energy ─────────────────────────────────────────────────────────────────
  {
    id: 'solar',
    label: 'Solar Panel',
    category: 'energy',
    description: 'Crystalline-Si rooftop module.',
    scaleNote: 'Per ~400 W module',
    subsystems: [
      {
        label: 'Cells',
        components: [
          { commodityId: null,     name: 'Silicon (solar-grade)*', role: 'Wafer / cell substrate',  criticality: 'critical' },
          { commodityId: 'silver', name: 'Silver',                  role: 'Front-side conductive grid', criticality: 'critical', approxAmount: '~10 g' },
          { commodityId: 'copper', name: 'Copper',                  role: 'Interconnect ribbons',      criticality: 'critical' },
        ],
      },
      {
        label: 'Frame & encapsulation',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Frame',          criticality: 'critical' },
          { commodityId: null,       name: 'Glass*',   role: 'Front cover',    criticality: 'critical' },
          { commodityId: 'tin',      name: 'Tin',      role: 'Cell solder',    criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'wind',
    label: 'Wind Turbine',
    category: 'energy',
    description: 'Offshore 8–15 MW direct-drive turbine.',
    scaleNote: 'Per turbine · ~10 MW class',
    subsystems: [
      {
        label: 'Generator (permanent magnet)',
        components: [
          { commodityId: null,    name: 'Rare earths (Nd, Dy, Tb)*', role: 'NdFeB magnets in PMSG', criticality: 'critical', approxAmount: '~600 kg' },
          { commodityId: 'copper',name: 'Copper',                    role: 'Stator + cabling',       criticality: 'critical', approxAmount: '~3 t' },
        ],
      },
      {
        label: 'Tower & nacelle',
        components: [
          { commodityId: null,     name: 'Steel*',     role: 'Tower, shaft, hub',           criticality: 'critical', approxAmount: '~250 t' },
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Nacelle housing, cooling',     criticality: 'important' },
          { commodityId: 'zinc',   name: 'Zinc',       role: 'Galvanizing tower steel',     criticality: 'important' },
        ],
      },
      {
        label: 'Blades & foundation',
        components: [
          { commodityId: null, name: 'Fiberglass + epoxy*', role: 'Blade composite',              criticality: 'critical' },
          { commodityId: null, name: 'Concrete*',           role: 'Gravity-base foundation',      criticality: 'critical' },
          { commodityId: null, name: 'Balsa wood*',         role: 'Blade core',                   criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'nuclear',
    label: 'Nuclear Reactor',
    category: 'energy',
    description: 'Light-water reactor (PWR, ~1 GW).',
    scaleNote: 'Per reactor build',
    subsystems: [
      {
        label: 'Fuel cycle',
        components: [
          { commodityId: 'uranium', name: 'Uranium',  role: 'Enriched UO₂ fuel pellets',     criticality: 'critical', approxAmount: '~25 t/yr reload' },
          { commodityId: null,      name: 'Zirconium*', role: 'Fuel cladding tubes',          criticality: 'critical' },
        ],
      },
      {
        label: 'Reactor vessel & shielding',
        components: [
          { commodityId: null,     name: 'Steel (low-alloy)*',     role: 'Pressure vessel',     criticality: 'critical', approxAmount: '~400 t' },
          { commodityId: null,     name: 'Stainless / Hafnium*',   role: 'Control rods, cladding', criticality: 'critical' },
          { commodityId: null,     name: 'Concrete*',              role: 'Containment building', criticality: 'critical', approxAmount: '~200,000 m³' },
          { commodityId: 'copper', name: 'Copper',                 role: 'Generator + grid tie', criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'datacenter',
    label: 'Hyperscale Data Center',
    category: 'energy',
    description: 'AI/cloud campus (~100 MW IT load).',
    scaleNote: 'Per ~100 MW facility',
    subsystems: [
      {
        label: 'Compute (servers + GPUs)',
        components: [
          { commodityId: 'copper', name: 'Copper',  role: 'Busbars, cabling, cold-plate loops', criticality: 'critical', approxAmount: '~thousands of t' },
          { commodityId: 'gold',   name: 'Gold',    role: 'Connectors / chip packages',         criticality: 'important' },
          { commodityId: null,     name: 'Silicon + rare earths*', role: 'GPUs/CPUs + storage',  criticality: 'critical' },
        ],
      },
      {
        label: 'Power, cooling, structure',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Server racks, heat sinks, cable trays', criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',   role: 'Structural + transformer cores',         criticality: 'critical' },
          { commodityId: 'lithium',  name: 'Lithium',  role: 'BESS for UPS / load shifting',           criticality: 'important' },
          { commodityId: null,       name: 'Concrete*',role: 'Slab, foundations',                       criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Military ───────────────────────────────────────────────────────────────
  {
    id: 'f35',
    label: 'F-35 Fighter Jet',
    category: 'military',
    description: 'Stealth multi-role fighter (Lockheed F-35).',
    scaleNote: 'Per airframe',
    subsystems: [
      {
        label: 'Airframe & structure',
        components: [
          { commodityId: null,     name: 'Titanium*',     role: 'Bulkheads, engine, high-load parts', criticality: 'critical', approxAmount: '~1,800 kg' },
          { commodityId: 'aluminum', name: 'Aluminum',    role: 'Skin panels, structure',              criticality: 'critical' },
          { commodityId: null,     name: 'CFRP (carbon fiber)*', role: 'Stealth skin panels',          criticality: 'critical' },
          { commodityId: null,     name: 'Steel (specialty)*',   role: 'Landing gear, hardpoints',    criticality: 'critical' },
        ],
      },
      {
        label: 'Avionics & sensors',
        components: [
          { commodityId: null,    name: 'Rare earths (Sm, Nd, Y)*', role: 'Radar arrays, EOTS, magnets', criticality: 'critical' },
          { commodityId: null,    name: 'Gallium nitride*',         role: 'AESA radar T/R modules',      criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',                     role: 'Mission-computer plating',    criticality: 'important' },
          { commodityId: 'silver',name: 'Silver',                   role: 'Wiring, contacts',            criticality: 'important' },
          { commodityId: 'copper',name: 'Copper',                   role: 'Wiring harness',              criticality: 'critical' },
        ],
      },
      {
        label: 'Engine (F135)',
        components: [
          { commodityId: 'nickel', name: 'Nickel',           role: 'Superalloy turbine blades',        criticality: 'critical' },
          { commodityId: 'cobalt', name: 'Cobalt',           role: 'Superalloy binder',                criticality: 'critical' },
          { commodityId: null,     name: 'Rhenium / Hafnium*', role: 'Single-crystal blade coatings',  criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'cruise-missile',
    label: 'Cruise Missile',
    category: 'military',
    description: 'Subsonic land-attack missile (≈ Tomahawk class).',
    scaleNote: 'Per round',
    subsystems: [
      {
        label: 'Airframe & propulsion',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Body shell',                          criticality: 'critical' },
          { commodityId: null,       name: 'Titanium*', role: 'Engine hot section',                  criticality: 'important' },
          { commodityId: 'nickel',   name: 'Nickel',   role: 'Turbofan superalloys',                criticality: 'critical' },
          { commodityId: null,       name: 'Ammonium perchlorate*', role: 'Booster propellant',     criticality: 'critical' },
        ],
      },
      {
        label: 'Guidance & warhead',
        components: [
          { commodityId: null,    name: 'Rare earths (Nd, Sm)*', role: 'IMU magnets, actuators', criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',                  role: 'Seeker electronics',     criticality: 'important' },
          { commodityId: 'copper',name: 'Copper',                role: 'Wiring + shielding',     criticality: 'critical' },
          { commodityId: null,    name: 'Tungsten*',             role: 'Penetrator / fragments', criticality: 'critical' },
          { commodityId: null,    name: 'HE explosive (RDX/HMX)*', role: 'Warhead fill',         criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'warship',
    label: 'Modern Warship',
    category: 'military',
    description: 'Guided-missile destroyer (≈ Arleigh Burke class).',
    scaleNote: 'Per hull · ~9,000 t displacement',
    subsystems: [
      {
        label: 'Hull & structure',
        components: [
          { commodityId: null, name: 'Steel (HSLA)*', role: 'Hull, decks, bulkheads',            criticality: 'critical', approxAmount: '~5,000 t' },
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Superstructure',                    criticality: 'important' },
          { commodityId: 'zinc',     name: 'Zinc',     role: 'Sacrificial anodes',                criticality: 'important' },
        ],
      },
      {
        label: 'Propulsion & power',
        components: [
          { commodityId: 'nickel', name: 'Nickel', role: 'Gas turbine superalloys',           criticality: 'critical' },
          { commodityId: 'cobalt', name: 'Cobalt', role: 'Superalloy binder',                  criticality: 'critical' },
          { commodityId: 'copper', name: 'Copper', role: 'Generators, propulsion windings',    criticality: 'critical', approxAmount: '~100 t' },
        ],
      },
      {
        label: 'Combat systems',
        components: [
          { commodityId: null,    name: 'Rare earths*',     role: 'AEGIS radar, magnets, lasers', criticality: 'critical' },
          { commodityId: null,    name: 'Gallium nitride*', role: 'SPY-6 radar T/R modules',      criticality: 'critical' },
          { commodityId: 'silver',name: 'Silver',           role: 'High-current contacts',         criticality: 'important' },
          { commodityId: 'gold',  name: 'Gold',             role: 'Comms / mission electronics',   criticality: 'important' },
        ],
      },
    ],
  },

  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id: 'skyscraper',
    label: 'Skyscraper',
    category: 'infrastructure',
    description: 'Steel-frame high-rise (~300 m, ~100k m² floor area).',
    scaleNote: 'Per building',
    subsystems: [
      {
        label: 'Structure',
        components: [
          { commodityId: null,       name: 'Steel*',    role: 'Frame, rebar, columns', criticality: 'critical', approxAmount: '~30,000 t' },
          { commodityId: null,       name: 'Concrete*', role: 'Floors, core, foundation', criticality: 'critical', approxAmount: '~200,000 m³' },
          { commodityId: 'iron-ore', name: 'Iron ore',  role: 'Upstream feedstock for steel', criticality: 'critical' },
          { commodityId: null,       name: 'Cement / limestone*', role: 'Concrete binder',     criticality: 'critical' },
        ],
      },
      {
        label: 'Envelope & MEP',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Curtain wall mullions',         criticality: 'critical' },
          { commodityId: null,       name: 'Glass*',   role: 'Façade glazing',                criticality: 'critical' },
          { commodityId: 'copper',   name: 'Copper',   role: 'Electrical + HVAC piping',      criticality: 'critical', approxAmount: '~500 t' },
          { commodityId: 'zinc',     name: 'Zinc',     role: 'Galvanizing, roofing',          criticality: 'important' },
        ],
      },
    ],
  },

  // ── Industrial / Agriculture ──────────────────────────────────────────────
  {
    id: 'fertilizer',
    label: 'NPK Fertilizer',
    category: 'industrial',
    description: 'Nitrogen-phosphorus-potassium crop nutrient blend.',
    scaleNote: 'Per t product',
    subsystems: [
      {
        label: 'Macro-nutrients',
        components: [
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'H₂ feedstock for ammonia (N)',     criticality: 'critical' },
          { commodityId: 'phosphate',   name: 'Phosphate rock', role: 'Phosphorus source (P)',          criticality: 'critical' },
          { commodityId: 'potash',      name: 'Potash',      role: 'Potassium source (K)',             criticality: 'critical' },
        ],
      },
      {
        label: 'Process inputs',
        components: [
          { commodityId: null, name: 'Sulfur*',         role: 'H₂SO₄ for phosphate processing', criticality: 'critical' },
          { commodityId: null, name: 'Limestone*',      role: 'Conditioner / pH buffer',        criticality: 'important' },
        ],
      },
    ],
  },

  // ── Transport (extended) ──────────────────────────────────────────────────
  {
    id: 'airliner',
    label: 'Commercial Airliner',
    category: 'transport',
    description: 'Wide-body passenger jet (≈ Boeing 787 / A350 class).',
    scaleNote: 'Per airframe · ~250 t empty',
    subsystems: [
      {
        label: 'Airframe',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Wing skin, fuselage frames',     criticality: 'critical', approxAmount: '~80 t' },
          { commodityId: null,       name: 'Titanium*', role: 'Engine pylons, landing gear',    criticality: 'critical', approxAmount: '~15 t' },
          { commodityId: null,       name: 'CFRP composites*', role: 'Fuselage skin (787/A350)', criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',   role: 'Landing gear, fasteners',         criticality: 'critical' },
        ],
      },
      {
        label: 'Engines (turbofan)',
        components: [
          { commodityId: 'nickel', name: 'Nickel',           role: 'High-pressure turbine superalloys', criticality: 'critical' },
          { commodityId: 'cobalt', name: 'Cobalt',           role: 'Superalloy binder',                  criticality: 'critical' },
          { commodityId: null,     name: 'Rhenium*',         role: 'Single-crystal blade alloys',        criticality: 'critical' },
        ],
      },
      {
        label: 'Avionics & cabin',
        components: [
          { commodityId: 'copper', name: 'Copper', role: 'Wiring harness (~150 km)', criticality: 'critical' },
          { commodityId: 'gold',   name: 'Gold',   role: 'Connector plating',         criticality: 'important' },
          { commodityId: null,     name: 'Rare earths*', role: 'Gyros, actuators, displays', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'container-ship',
    label: 'Container Ship',
    category: 'transport',
    description: 'Ultra-large container vessel (~20,000 TEU).',
    scaleNote: 'Per hull · ~200,000 t deadweight',
    subsystems: [
      {
        label: 'Hull & structure',
        components: [
          { commodityId: null,       name: 'Steel (shipbuilding plate)*', role: 'Hull, decks, hatch covers', criticality: 'critical', approxAmount: '~60,000 t' },
          { commodityId: 'iron-ore', name: 'Iron ore',                    role: 'Upstream steel feedstock',  criticality: 'critical' },
          { commodityId: 'zinc',     name: 'Zinc',                        role: 'Anti-corrosion coating',    criticality: 'important' },
        ],
      },
      {
        label: 'Propulsion',
        components: [
          { commodityId: 'crude-oil', name: 'Fuel oil (HFO/VLSFO)', role: 'Two-stroke marine diesel feed', criticality: 'critical' },
          { commodityId: 'copper',    name: 'Copper',               role: 'Generators, motors, wiring',    criticality: 'critical' },
          { commodityId: 'nickel',    name: 'Nickel',               role: 'Turbocharger superalloys',      criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'freight-locomotive',
    label: 'Freight Locomotive',
    category: 'transport',
    description: 'Diesel-electric heavy-haul locomotive.',
    scaleNote: 'Per unit · ~200 t',
    subsystems: [
      {
        label: 'Powertrain',
        components: [
          { commodityId: 'crude-oil', name: 'Diesel fuel', role: 'Prime mover energy',           criticality: 'critical' },
          { commodityId: 'copper',    name: 'Copper',      role: 'Traction motors, alternator', criticality: 'critical', approxAmount: '~3 t' },
          { commodityId: 'nickel',    name: 'Nickel',      role: 'Engine alloys',                criticality: 'important' },
        ],
      },
      {
        label: 'Frame & wheels',
        components: [
          { commodityId: null,       name: 'Steel*',     role: 'Frame, trucks, wheels',  criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',   role: 'Body shell, radiators',  criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'ebike',
    label: 'Electric Bicycle',
    category: 'transport',
    description: 'Pedal-assist e-bike (~250 W).',
    scaleNote: 'Per unit · ~25 kg',
    subsystems: [
      {
        label: 'Battery & motor',
        components: [
          { commodityId: 'lithium',   name: 'Lithium', role: 'Li-ion battery cells',         criticality: 'critical' },
          { commodityId: 'cobalt',    name: 'Cobalt',  role: 'Cathode',                       criticality: 'important' },
          { commodityId: 'nickel',    name: 'Nickel',  role: 'Cathode',                       criticality: 'important' },
          { commodityId: 'copper',    name: 'Copper',  role: 'Motor windings, wiring',        criticality: 'critical' },
          { commodityId: null,        name: 'Rare earths*', role: 'Hub motor magnets',         criticality: 'critical' },
        ],
      },
      {
        label: 'Frame & components',
        components: [
          { commodityId: 'aluminum',       name: 'Aluminum',     role: 'Frame, wheels',     criticality: 'critical' },
          { commodityId: 'natural-rubber', name: 'Natural rubber', role: 'Tires',           criticality: 'important' },
          { commodityId: null,             name: 'Steel*',       role: 'Drivetrain, spokes', criticality: 'important' },
        ],
      },
    ],
  },

  // ── Electronics (extended) ────────────────────────────────────────────────
  {
    id: 'laptop',
    label: 'Laptop Computer',
    category: 'electronics',
    description: 'Modern ultrabook (~1.5 kg).',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Battery',
        components: [
          { commodityId: 'lithium', name: 'Lithium', role: 'Li-ion cells',  criticality: 'critical' },
          { commodityId: 'cobalt',  name: 'Cobalt',  role: 'Cathode',       criticality: 'critical' },
          { commodityId: null,      name: 'Graphite*', role: 'Anode',        criticality: 'critical' },
        ],
      },
      {
        label: 'Logic board',
        components: [
          { commodityId: 'gold',     name: 'Gold',     role: 'PCB plating',           criticality: 'important' },
          { commodityId: 'silver',   name: 'Silver',   role: 'Conductive paste',      criticality: 'important' },
          { commodityId: 'copper',   name: 'Copper',   role: 'Traces, heat pipes',    criticality: 'critical' },
          { commodityId: 'tin',      name: 'Tin',      role: 'Solder',                criticality: 'critical' },
          { commodityId: 'palladium',name: 'Palladium',role: 'Capacitor termination', criticality: 'important' },
          { commodityId: null,       name: 'Rare earths*', role: 'Speakers, magnets', criticality: 'important' },
        ],
      },
      {
        label: 'Chassis & display',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Unibody chassis',          criticality: 'critical' },
          { commodityId: null,       name: 'Glass*',   role: 'Display, trackpad',         criticality: 'critical' },
          { commodityId: null,       name: 'Indium*',  role: 'ITO touchscreen layer',     criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'oled-tv',
    label: 'OLED TV',
    category: 'electronics',
    description: 'Large-format OLED television (~65″).',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Display',
        components: [
          { commodityId: null,    name: 'Rare earths (Eu, Tb, Dy)*', role: 'OLED phosphors / emitters', criticality: 'critical' },
          { commodityId: null,    name: 'Indium*',                    role: 'ITO transparent electrode', criticality: 'critical' },
          { commodityId: null,    name: 'Glass*',                     role: 'Panel substrate, cover',     criticality: 'critical' },
        ],
      },
      {
        label: 'Driver electronics',
        components: [
          { commodityId: 'copper',  name: 'Copper',  role: 'PCB traces, power rails', criticality: 'critical' },
          { commodityId: 'gold',    name: 'Gold',    role: 'Driver IC bonds',          criticality: 'important' },
          { commodityId: 'silver',  name: 'Silver',  role: 'Connectors',               criticality: 'important' },
          { commodityId: 'tin',     name: 'Tin',     role: 'Solder',                   criticality: 'critical' },
          { commodityId: 'aluminum',name: 'Aluminum',role: 'Heatsinks, bezel',         criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'gaming-console',
    label: 'Gaming Console',
    category: 'electronics',
    description: 'High-end console (≈ PS5 / Xbox Series X).',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'SoC & memory',
        components: [
          { commodityId: null,    name: 'Silicon (electronic-grade)*', role: 'APU die, GDDR6 memory', criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',                       role: 'Board traces, vapor chamber', criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',                         role: 'BGA pads',                criticality: 'important' },
          { commodityId: 'tin',   name: 'Tin',                          role: 'Solder',                  criticality: 'critical' },
        ],
      },
      {
        label: 'Power & cooling',
        components: [
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Heat sink, chassis frame', criticality: 'critical' },
          { commodityId: null,      name: 'Liquid-metal TIM*', role: 'CPU/GPU thermal interface', criticality: 'important' },
          { commodityId: null,      name: 'Rare earths*', role: 'Fan motor magnets',     criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'headphones',
    label: 'Wireless Headphones',
    category: 'electronics',
    description: 'Active-noise-cancelling over-ear headphones.',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Drivers & magnets',
        components: [
          { commodityId: null,     name: 'Rare earths (Nd)*', role: 'Speaker driver magnets', criticality: 'critical' },
          { commodityId: 'copper', name: 'Copper',           role: 'Voice coils',             criticality: 'critical' },
        ],
      },
      {
        label: 'Electronics & battery',
        components: [
          { commodityId: 'lithium', name: 'Lithium', role: 'Li-polymer battery',  criticality: 'critical' },
          { commodityId: 'cobalt',  name: 'Cobalt',  role: 'Battery cathode',     criticality: 'important' },
          { commodityId: 'gold',    name: 'Gold',    role: 'PCB plating',         criticality: 'important' },
          { commodityId: 'tin',     name: 'Tin',     role: 'Solder',              criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Energy (extended) ─────────────────────────────────────────────────────
  {
    id: 'hydro-dam',
    label: 'Hydroelectric Dam',
    category: 'energy',
    description: 'Large gravity dam + powerhouse (~1 GW).',
    scaleNote: 'Per project',
    subsystems: [
      {
        label: 'Civil works',
        components: [
          { commodityId: null,       name: 'Concrete*', role: 'Dam wall, spillway',                criticality: 'critical', approxAmount: '~5–10 M m³' },
          { commodityId: null,       name: 'Steel rebar*', role: 'Reinforcement',                   criticality: 'critical' },
          { commodityId: 'iron-ore', name: 'Iron ore',  role: 'Upstream steel feedstock',          criticality: 'critical' },
        ],
      },
      {
        label: 'Turbines & generators',
        components: [
          { commodityId: null,    name: 'Stainless steel*', role: 'Francis/Kaplan runners',         criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',           role: 'Generator windings, transformers', criticality: 'critical', approxAmount: '~hundreds of t' },
          { commodityId: null,    name: 'Rare earths*',     role: 'Excitation magnets',             criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'ev-charger',
    label: 'EV Fast Charger',
    category: 'energy',
    description: 'DC fast-charging station (150–350 kW).',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Power electronics',
        components: [
          { commodityId: 'copper', name: 'Copper', role: 'Busbars, transformers, cables', criticality: 'critical', approxAmount: '~50–100 kg' },
          { commodityId: null,     name: 'Silicon carbide*', role: 'SiC power MOSFETs',    criticality: 'critical' },
          { commodityId: null,     name: 'Gallium nitride*', role: 'High-frequency switching', criticality: 'important' },
          { commodityId: 'silver', name: 'Silver', role: 'Contactor contacts',             criticality: 'important' },
        ],
      },
      {
        label: 'Enclosure & cooling',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Heat sinks, enclosure',      criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',   role: 'Cabinet, mounting',           criticality: 'critical' },
          { commodityId: null,       name: 'Coolant glycol*', role: 'Liquid-cooled cables', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'oil-refinery',
    label: 'Oil Refinery',
    category: 'energy',
    description: 'Complex refinery converting crude to fuels.',
    scaleNote: 'Per ~200 kbpd facility',
    subsystems: [
      {
        label: 'Feedstock & output',
        components: [
          { commodityId: 'crude-oil',   name: 'Crude oil',   role: 'Primary feedstock',                criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'Hydrogen for hydrocracking, fuel', criticality: 'critical' },
        ],
      },
      {
        label: 'Process equipment',
        components: [
          { commodityId: null,    name: 'Steel (CrMo / stainless)*', role: 'Pressure vessels, towers, piping', criticality: 'critical', approxAmount: '~hundreds of kt' },
          { commodityId: 'nickel',name: 'Nickel',                    role: 'Corrosion-resistant alloys',         criticality: 'critical' },
          { commodityId: 'platinum',name: 'Platinum',                role: 'Reforming catalyst',                 criticality: 'critical' },
          { commodityId: 'palladium', name: 'Palladium',             role: 'Hydrogenation catalyst',             criticality: 'important' },
        ],
      },
    ],
  },

  // ── Military (extended) ───────────────────────────────────────────────────
  {
    id: 'tank',
    label: 'Main Battle Tank',
    category: 'military',
    description: 'Modern MBT (≈ M1 Abrams class).',
    scaleNote: 'Per hull · ~70 t',
    subsystems: [
      {
        label: 'Armor & hull',
        components: [
          { commodityId: null,    name: 'Depleted uranium / tungsten*', role: 'KE penetrator + Chobham armor', criticality: 'critical' },
          { commodityId: null,    name: 'Steel (RHA)*',                  role: 'Hull, turret structure',         criticality: 'critical', approxAmount: '~40 t' },
          { commodityId: null,    name: 'Ceramic composite*',            role: 'Armor matrix',                    criticality: 'critical' },
        ],
      },
      {
        label: 'Powerpack & drivetrain',
        components: [
          { commodityId: 'crude-oil', name: 'Diesel / jet fuel', role: 'Multi-fuel turbine',         criticality: 'critical' },
          { commodityId: 'nickel',    name: 'Nickel',            role: 'Turbine superalloys',         criticality: 'critical' },
          { commodityId: 'aluminum',  name: 'Aluminum',          role: 'Powerpack housing',           criticality: 'important' },
        ],
      },
      {
        label: 'Fire control & comms',
        components: [
          { commodityId: null,    name: 'Rare earths*',  role: 'Stabilizers, sights, lasers', criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',         role: 'Wiring, motors',             criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',           role: 'Electronics plating',         criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'submarine',
    label: 'Nuclear Submarine',
    category: 'military',
    description: 'SSN attack submarine (≈ Virginia / Astute class).',
    scaleNote: 'Per hull · ~7,000 t submerged',
    subsystems: [
      {
        label: 'Pressure hull',
        components: [
          { commodityId: null, name: 'HY-100 steel*', role: 'Pressure hull, frames',  criticality: 'critical', approxAmount: '~4,000 t' },
          { commodityId: null, name: 'Titanium*',     role: 'Sonar dome, fittings',    criticality: 'important' },
        ],
      },
      {
        label: 'Reactor',
        components: [
          { commodityId: 'uranium', name: 'HEU fuel',         role: 'Naval reactor core',     criticality: 'critical' },
          { commodityId: null,      name: 'Zirconium*',       role: 'Fuel cladding',          criticality: 'critical' },
          { commodityId: 'nickel',  name: 'Nickel',           role: 'Reactor alloys',         criticality: 'critical' },
        ],
      },
      {
        label: 'Combat systems',
        components: [
          { commodityId: 'copper',name: 'Copper',           role: 'Acoustic tile bonding, wiring', criticality: 'critical' },
          { commodityId: null,    name: 'Rare earths*',     role: 'Sonar, magnets',                criticality: 'critical' },
          { commodityId: 'silver',name: 'Silver',           role: 'Silver-zinc reserve batteries', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'military-drone',
    label: 'Combat Drone',
    category: 'military',
    description: 'Medium-altitude armed UAV (≈ MQ-9 Reaper class).',
    scaleNote: 'Per airframe',
    subsystems: [
      {
        label: 'Airframe',
        components: [
          { commodityId: null,      name: 'CFRP composites*', role: 'Wings, fuselage skin',  criticality: 'critical' },
          { commodityId: 'aluminum',name: 'Aluminum',         role: 'Internal structure',     criticality: 'critical' },
          { commodityId: null,      name: 'Titanium*',        role: 'Engine mounts',          criticality: 'important' },
        ],
      },
      {
        label: 'Sensors & comms',
        components: [
          { commodityId: null,    name: 'Rare earths*',  role: 'EO/IR sensor magnets, gyros', criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',           role: 'Mission electronics plating', criticality: 'important' },
          { commodityId: 'copper',name: 'Copper',         role: 'Wiring, antennas',            criticality: 'critical' },
          { commodityId: null,    name: 'Gallium*',       role: 'GaN-based SATCOM amplifiers', criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'rifle',
    label: 'Assault Rifle',
    category: 'military',
    description: 'Infantry rifle (≈ AR-15 / AK-12 class).',
    scaleNote: 'Per unit · ~3.5 kg',
    subsystems: [
      {
        label: 'Receiver & barrel',
        components: [
          { commodityId: null,       name: 'Steel (4140/4150)*', role: 'Barrel, bolt, op-rod', criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',           role: 'Upper/lower receiver',  criticality: 'critical' },
          { commodityId: null,       name: 'Polymer (nylon)*',   role: 'Stock, grip, magazine', criticality: 'important' },
        ],
      },
      {
        label: 'Ammunition',
        components: [
          { commodityId: 'copper',name: 'Copper',     role: 'Cartridge case, jacket', criticality: 'critical' },
          { commodityId: null,    name: 'Lead*',      role: 'Bullet core',             criticality: 'critical' },
          { commodityId: null,    name: 'Nitrocellulose / propellant*', role: 'Smokeless powder', criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Infrastructure (extended) ─────────────────────────────────────────────
  {
    id: 'bridge',
    label: 'Suspension Bridge',
    category: 'infrastructure',
    description: 'Long-span suspension bridge (~1.5 km main span).',
    scaleNote: 'Per bridge',
    subsystems: [
      {
        label: 'Cables & towers',
        components: [
          { commodityId: null,       name: 'High-strength steel wire*', role: 'Main cables, hangers', criticality: 'critical', approxAmount: '~50,000 t' },
          { commodityId: null,       name: 'Steel*',                    role: 'Towers, deck truss',    criticality: 'critical' },
          { commodityId: 'iron-ore', name: 'Iron ore',                  role: 'Upstream feedstock',    criticality: 'critical' },
          { commodityId: 'zinc',     name: 'Zinc',                      role: 'Cable galvanizing',     criticality: 'critical' },
        ],
      },
      {
        label: 'Foundations & deck',
        components: [
          { commodityId: null,     name: 'Concrete*',  role: 'Anchorages, piers',     criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Deck cladding, railings', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'highway',
    label: 'Highway (Interstate)',
    category: 'infrastructure',
    description: 'Multi-lane divided highway with asphalt + bridges.',
    scaleNote: 'Per km of 4-lane road',
    subsystems: [
      {
        label: 'Roadway',
        components: [
          { commodityId: 'crude-oil', name: 'Bitumen (asphalt binder)', role: 'Asphalt pavement',     criticality: 'critical', approxAmount: '~1,500 t' },
          { commodityId: null,        name: 'Aggregate (stone, sand, gravel)*', role: 'Sub-base + asphalt mix', criticality: 'critical', approxAmount: '~30,000 t' },
          { commodityId: null,        name: 'Concrete*',                  role: 'Rigid pavement sections, barriers', criticality: 'important' },
        ],
      },
      {
        label: 'Structures & lighting',
        components: [
          { commodityId: null,    name: 'Steel rebar / guardrail*', role: 'Bridges, barriers',   criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',                    role: 'Lighting + signage wiring', criticality: 'important' },
          { commodityId: 'zinc',  name: 'Zinc',                      role: 'Galvanized guardrails', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'transmission-line',
    label: 'Power Transmission Line',
    category: 'infrastructure',
    description: 'High-voltage AC overhead transmission (≥230 kV).',
    scaleNote: 'Per km',
    subsystems: [
      {
        label: 'Conductors',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'ACSR conductor strands',   criticality: 'critical', approxAmount: '~2–4 t/km' },
          { commodityId: null,       name: 'Steel core*', role: 'ACSR mechanical core',   criticality: 'critical' },
          { commodityId: 'copper',   name: 'Copper',    role: 'Ground wires, substations', criticality: 'critical' },
        ],
      },
      {
        label: 'Towers & insulators',
        components: [
          { commodityId: null,    name: 'Steel (galvanized)*', role: 'Lattice towers',      criticality: 'critical' },
          { commodityId: 'zinc',  name: 'Zinc',                role: 'Tower galvanizing',   criticality: 'important' },
          { commodityId: null,    name: 'Porcelain / glass*',  role: 'Insulator strings',   criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: '5g-tower',
    label: '5G Cell Tower',
    category: 'infrastructure',
    description: 'Macro 5G base station + tower.',
    scaleNote: 'Per site',
    subsystems: [
      {
        label: 'Radio equipment',
        components: [
          { commodityId: null,    name: 'Gallium nitride*', role: 'mmWave / RF power amplifiers', criticality: 'critical' },
          { commodityId: null,    name: 'Rare earths*',     role: 'Filters, magnets, isolators',   criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',           role: 'RF cabling, power feed',         criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',             role: 'Connector plating',              criticality: 'important' },
          { commodityId: 'silver',name: 'Silver',           role: 'High-current contacts',          criticality: 'important' },
        ],
      },
      {
        label: 'Structure',
        components: [
          { commodityId: null,       name: 'Steel*',     role: 'Monopole / lattice tower', criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',   role: 'Antenna housings',          criticality: 'critical' },
          { commodityId: null,       name: 'Concrete*',  role: 'Foundation pad',            criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'water-treatment',
    label: 'Water Treatment Plant',
    category: 'infrastructure',
    description: 'Municipal drinking-water treatment facility.',
    scaleNote: 'Per ~500 MLD plant',
    subsystems: [
      {
        label: 'Civil & piping',
        components: [
          { commodityId: null,    name: 'Concrete*',     role: 'Clarifiers, basins, sumps',  criticality: 'critical' },
          { commodityId: null,    name: 'Ductile iron / steel pipe*', role: 'Distribution mains', criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',         role: 'Pump wiring, controls',     criticality: 'critical' },
        ],
      },
      {
        label: 'Treatment chemistry',
        components: [
          { commodityId: null,    name: 'Chlorine / hypochlorite*', role: 'Disinfection',          criticality: 'critical' },
          { commodityId: null,    name: 'Aluminum sulfate (alum)*', role: 'Coagulation',           criticality: 'critical' },
          { commodityId: null,    name: 'Activated carbon*',         role: 'Taste / VOC removal',   criticality: 'important' },
          { commodityId: null,    name: 'Lime*',                     role: 'pH adjustment',         criticality: 'important' },
        ],
      },
    ],
  },

  // ── Consumer / Food ───────────────────────────────────────────────────────
  {
    id: 'chocolate-bar',
    label: 'Chocolate Bar',
    category: 'consumer',
    description: 'Standard milk chocolate confection (~100 g).',
    scaleNote: 'Per bar',
    subsystems: [
      {
        label: 'Cocoa mass',
        components: [
          { commodityId: 'cocoa', name: 'Cocoa beans', role: 'Cocoa mass + cocoa butter', criticality: 'critical', approxAmount: '~30 g' },
          { commodityId: 'sugar', name: 'Sugar',       role: 'Sweetener',                  criticality: 'critical', approxAmount: '~50 g' },
        ],
      },
      {
        label: 'Dairy & inclusions',
        components: [
          { commodityId: null,        name: 'Milk powder*',   role: 'Milk solids',  criticality: 'critical' },
          { commodityId: 'palm-oil',  name: 'Palm oil',       role: 'Texture / shelf life', criticality: 'important' },
          { commodityId: null,        name: 'Soy lecithin*',  role: 'Emulsifier',   criticality: 'trace' },
        ],
      },
    ],
  },
  {
    id: 'coffee-cup',
    label: 'Cup of Coffee',
    category: 'consumer',
    description: 'Brewed coffee with milk and sugar.',
    scaleNote: 'Per ~350 mL cup',
    subsystems: [
      {
        label: 'Brew',
        components: [
          { commodityId: 'coffee', name: 'Coffee beans', role: 'Ground roast',  criticality: 'critical', approxAmount: '~10 g' },
          { commodityId: null,     name: 'Water*',        role: 'Brewing solvent', criticality: 'critical' },
        ],
      },
      {
        label: 'Additions & vessel',
        components: [
          { commodityId: null,  name: 'Milk*', role: 'Steamed / cream', criticality: 'important' },
          { commodityId: 'sugar', name: 'Sugar', role: 'Sweetener',     criticality: 'trace' },
          { commodityId: null,    name: 'Paper / pulp cup*', role: 'Container',  criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'tshirt',
    label: 'Cotton T-shirt',
    category: 'consumer',
    description: 'Basic cotton crew-neck t-shirt.',
    scaleNote: 'Per unit · ~200 g',
    subsystems: [
      {
        label: 'Fabric',
        components: [
          { commodityId: 'cotton', name: 'Cotton',  role: 'Yarn / knit fabric', criticality: 'critical', approxAmount: '~180 g' },
          { commodityId: null,     name: 'Polyester (PET)*', role: 'Stretch blend (optional)', criticality: 'important' },
          { commodityId: null,     name: 'Dyes (azo / reactive)*', role: 'Color',  criticality: 'important' },
        ],
      },
      {
        label: 'Trims & process',
        components: [
          { commodityId: null,    name: 'Polyester thread*',   role: 'Stitching',      criticality: 'important' },
          { commodityId: null,    name: 'Water + caustic soda*', role: 'Wet processing', criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'beer',
    label: 'Bottle of Beer',
    category: 'consumer',
    description: 'Lager-style beer in a glass bottle (~500 mL).',
    scaleNote: 'Per bottle',
    subsystems: [
      {
        label: 'Brew ingredients',
        components: [
          { commodityId: 'barley', name: 'Barley (malted)', role: 'Sugar source / body', criticality: 'critical', approxAmount: '~50 g' },
          { commodityId: null,     name: 'Hops*',            role: 'Bitterness / aroma',  criticality: 'critical' },
          { commodityId: null,     name: 'Yeast*',           role: 'Fermentation',         criticality: 'critical' },
          { commodityId: null,     name: 'Water*',           role: 'Bulk medium',          criticality: 'critical' },
        ],
      },
      {
        label: 'Packaging',
        components: [
          { commodityId: null,       name: 'Glass*',    role: 'Bottle',          criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',  role: 'Bottle cap / can option', criticality: 'important' },
          { commodityId: null,       name: 'Paper label*', role: 'Branding',     criticality: 'trace' },
        ],
      },
    ],
  },
  {
    id: 'bread',
    label: 'Loaf of Bread',
    category: 'consumer',
    description: 'Standard sandwich loaf.',
    scaleNote: 'Per ~700 g loaf',
    subsystems: [
      {
        label: 'Dough',
        components: [
          { commodityId: 'wheat', name: 'Wheat flour', role: 'Bulk dough',     criticality: 'critical', approxAmount: '~400 g' },
          { commodityId: null,    name: 'Water*',       role: 'Hydration',     criticality: 'critical' },
          { commodityId: null,    name: 'Yeast*',       role: 'Leavening',     criticality: 'critical' },
          { commodityId: null,    name: 'Salt*',        role: 'Flavor / yeast control', criticality: 'important' },
          { commodityId: 'sugar', name: 'Sugar',        role: 'Yeast food / browning',  criticality: 'trace' },
          { commodityId: 'palm-oil', name: 'Palm oil',  role: 'Softener (some recipes)', criticality: 'trace' },
        ],
      },
    ],
  },
  {
    id: 'rice-meal',
    label: 'Plate of Rice (staple meal)',
    category: 'consumer',
    description: 'Cooked white rice as a daily staple.',
    scaleNote: 'Per ~200 g serving',
    subsystems: [
      {
        label: 'Grain & cookware',
        components: [
          { commodityId: 'rice',     name: 'Rice',     role: 'Staple carbohydrate', criticality: 'critical', approxAmount: '~70 g dry' },
          { commodityId: null,       name: 'Water*',    role: 'Cooking medium',     criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',  role: 'Cookware (typical)',  criticality: 'trace' },
        ],
      },
    ],
  },

  // ── Transport (third batch) ──────────────────────────────────────────────
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    category: 'transport',
    description: 'Mid-displacement ICE motorcycle (~600 cc).',
    scaleNote: 'Per unit · ~200 kg',
    subsystems: [
      {
        label: 'Engine & drivetrain',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum',          role: 'Engine block, wheels', criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',            role: 'Frame, drivetrain',    criticality: 'critical' },
          { commodityId: 'crude-oil',name: 'Gasoline',          role: 'Fuel',                  criticality: 'critical' },
          { commodityId: 'platinum', name: 'Platinum',          role: 'Catalytic converter',   criticality: 'important' },
          { commodityId: 'palladium',name: 'Palladium',         role: 'Catalytic converter',   criticality: 'important' },
        ],
      },
      {
        label: 'Tires & electrics',
        components: [
          { commodityId: 'natural-rubber', name: 'Natural rubber', role: 'Tires',     criticality: 'critical' },
          { commodityId: 'copper',         name: 'Copper',          role: 'Wiring',    criticality: 'critical' },
          { commodityId: 'lithium',        name: 'Lithium',         role: 'Starter battery (Li-ion options)', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'fcev',
    label: 'Hydrogen Fuel-Cell Car',
    category: 'transport',
    description: 'FCEV passenger car (≈ Toyota Mirai class).',
    scaleNote: 'Per vehicle',
    subsystems: [
      {
        label: 'Fuel cell stack',
        components: [
          { commodityId: 'platinum',name: 'Platinum',       role: 'PEM catalyst (anode + cathode)', criticality: 'critical', approxAmount: '~30 g' },
          { commodityId: null,      name: 'Nafion / PFSA*', role: 'Proton exchange membrane',        criticality: 'critical' },
          { commodityId: null,      name: 'Carbon paper*',   role: 'Gas diffusion layer',             criticality: 'critical' },
          { commodityId: 'copper',  name: 'Copper',         role: 'Stack bus plates, wiring',         criticality: 'critical' },
        ],
      },
      {
        label: 'Storage & drive',
        components: [
          { commodityId: null,      name: 'CFRP tank*',     role: '700 bar H₂ pressure vessel', criticality: 'critical' },
          { commodityId: 'lithium', name: 'Lithium',        role: 'Buffer Li-ion battery',     criticality: 'critical' },
          { commodityId: null,      name: 'Rare earths*',   role: 'Drive-motor magnets',        criticality: 'critical' },
          { commodityId: 'aluminum',name: 'Aluminum',       role: 'Body + structural',          criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'school-bus',
    label: 'School Bus',
    category: 'transport',
    description: 'Type-C diesel school bus.',
    scaleNote: 'Per unit · ~11 m long',
    subsystems: [
      {
        label: 'Chassis & body',
        components: [
          { commodityId: null,       name: 'Steel*',     role: 'Frame, body panels, roll cage', criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',   role: 'Trim, fuel tank',                criticality: 'important' },
          { commodityId: 'zinc',     name: 'Zinc',       role: 'Galvanizing',                    criticality: 'important' },
        ],
      },
      {
        label: 'Powertrain',
        components: [
          { commodityId: 'crude-oil', name: 'Diesel fuel', role: 'ICE fuel',           criticality: 'critical' },
          { commodityId: 'platinum',  name: 'Platinum',    role: 'Diesel oxidation catalyst', criticality: 'important' },
          { commodityId: 'copper',    name: 'Copper',      role: 'Wiring + starter',  criticality: 'critical' },
          { commodityId: 'natural-rubber', name: 'Natural rubber', role: 'Tires',     criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Electronics (third batch) ────────────────────────────────────────────
  {
    id: 'vr-headset',
    label: 'VR Headset',
    category: 'electronics',
    description: 'Standalone VR headset (≈ Quest / Vision Pro class).',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Displays & optics',
        components: [
          { commodityId: null,    name: 'Micro-OLED / LCD panels*', role: 'Per-eye displays',  criticality: 'critical' },
          { commodityId: null,    name: 'Rare earths (Eu, Tb)*',    role: 'OLED phosphors',     criticality: 'critical' },
          { commodityId: null,    name: 'Pancake lens polymers*',    role: 'Optics',             criticality: 'critical' },
        ],
      },
      {
        label: 'SoC, sensors, battery',
        components: [
          { commodityId: null,    name: 'Silicon*',  role: 'SoC + memory dies',     criticality: 'critical' },
          { commodityId: 'lithium', name: 'Lithium', role: 'Li-polymer battery',     criticality: 'critical' },
          { commodityId: 'cobalt',  name: 'Cobalt',  role: 'Battery cathode',         criticality: 'critical' },
          { commodityId: 'copper',  name: 'Copper',  role: 'Wiring, antennas',        criticality: 'critical' },
          { commodityId: 'gold',    name: 'Gold',    role: 'BGA / connector plating', criticality: 'important' },
          { commodityId: 'tin',     name: 'Tin',     role: 'Solder',                  criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'consumer-drone',
    label: 'Consumer Camera Drone',
    category: 'electronics',
    description: 'Quadcopter with 4K gimbal camera (≈ DJI Mavic class).',
    scaleNote: 'Per unit · ~900 g',
    subsystems: [
      {
        label: 'Motors & propulsion',
        components: [
          { commodityId: null,    name: 'Rare earths (Nd)*', role: 'BLDC motor magnets', criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',           role: 'Motor windings, ESCs', criticality: 'critical' },
        ],
      },
      {
        label: 'Electronics & battery',
        components: [
          { commodityId: 'lithium', name: 'Lithium',  role: 'LiPo battery',              criticality: 'critical' },
          { commodityId: 'cobalt',  name: 'Cobalt',   role: 'Cathode',                    criticality: 'critical' },
          { commodityId: 'gold',    name: 'Gold',     role: 'PCB plating, RF connectors', criticality: 'important' },
          { commodityId: 'silver',  name: 'Silver',   role: 'Conductive paste',           criticality: 'important' },
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Frame, gimbal',              criticality: 'critical' },
          { commodityId: null,      name: 'Polycarbonate*', role: 'Body shell',           criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'security-camera',
    label: 'IP Security Camera',
    category: 'electronics',
    description: 'Networked outdoor security / surveillance camera.',
    scaleNote: 'Per unit',
    subsystems: [
      {
        label: 'Sensor & optics',
        components: [
          { commodityId: null,    name: 'Silicon (CMOS sensor)*', role: 'Image sensor',          criticality: 'critical' },
          { commodityId: null,    name: 'Glass*',                 role: 'Lens elements',          criticality: 'critical' },
          { commodityId: null,    name: 'Indium / Gallium (IR LEDs)*', role: 'Night-vision IR illumination', criticality: 'important' },
        ],
      },
      {
        label: 'Electronics & housing',
        components: [
          { commodityId: 'copper',  name: 'Copper',   role: 'PoE wiring, PCB',  criticality: 'critical' },
          { commodityId: 'tin',     name: 'Tin',      role: 'Solder',           criticality: 'critical' },
          { commodityId: 'gold',    name: 'Gold',     role: 'Connector plating', criticality: 'important' },
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Weatherproof housing', criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Energy (third batch) ─────────────────────────────────────────────────
  {
    id: 'grid-battery',
    label: 'Grid-Scale Battery (BESS)',
    category: 'energy',
    description: 'Utility lithium-iron-phosphate energy-storage container.',
    scaleNote: 'Per ~4 MWh container',
    subsystems: [
      {
        label: 'Cells (LFP chemistry)',
        components: [
          { commodityId: 'lithium', name: 'Lithium',   role: 'LFP cathode + electrolyte',  criticality: 'critical', approxAmount: '~hundreds of kg LCE' },
          { commodityId: 'iron-ore',name: 'Iron ore',  role: 'LFP cathode (Fe)',           criticality: 'critical' },
          { commodityId: 'phosphate', name: 'Phosphate', role: 'LFP cathode (PO₄)',        criticality: 'critical' },
          { commodityId: 'copper',   name: 'Copper',    role: 'Anode current collector + busbars', criticality: 'critical' },
          { commodityId: null,       name: 'Graphite*', role: 'Anode',                       criticality: 'critical' },
        ],
      },
      {
        label: 'Container & power conv.',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Module cases, cooling plates', criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',   role: 'Container shell, racks',        criticality: 'critical' },
          { commodityId: null,       name: 'Silicon carbide*', role: 'Inverter MOSFETs',      criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'electrolyzer',
    label: 'Hydrogen Electrolyzer',
    category: 'energy',
    description: 'PEM electrolyzer for green-hydrogen production.',
    scaleNote: 'Per ~10 MW stack',
    subsystems: [
      {
        label: 'Catalyst & membrane',
        components: [
          { commodityId: 'platinum', name: 'Platinum',     role: 'Cathode catalyst', criticality: 'critical', approxAmount: '~kg-scale' },
          { commodityId: null,       name: 'Iridium*',     role: 'Anode catalyst (OER)', criticality: 'critical' },
          { commodityId: null,       name: 'Nafion (PFSA)*', role: 'Proton exchange membrane', criticality: 'critical' },
          { commodityId: null,       name: 'Titanium*',    role: 'Bipolar plates, frames',   criticality: 'critical' },
        ],
      },
      {
        label: 'Balance of plant',
        components: [
          { commodityId: 'nickel',   name: 'Nickel',    role: 'Alkaline option electrodes, piping', criticality: 'important' },
          { commodityId: 'copper',   name: 'Copper',    role: 'Power distribution',                  criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum',  role: 'Heat exchangers, enclosure',          criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'geothermal',
    label: 'Geothermal Power Plant',
    category: 'energy',
    description: 'Binary-cycle / flash geothermal plant (~50 MW).',
    scaleNote: 'Per plant',
    subsystems: [
      {
        label: 'Wells & piping',
        components: [
          { commodityId: null,    name: 'Stainless / CrMo steel*', role: 'Well casing, brine piping (corrosion-resistant)', criticality: 'critical' },
          { commodityId: 'nickel',name: 'Nickel',                  role: 'High-temp / sour-service alloys',                 criticality: 'critical' },
          { commodityId: null,    name: 'Drilling mud + cement*',  role: 'Well construction',                                criticality: 'critical' },
        ],
      },
      {
        label: 'Turbine & generator',
        components: [
          { commodityId: 'copper', name: 'Copper', role: 'Generator windings + transformer',     criticality: 'critical' },
          { commodityId: null,     name: 'Rare earths*', role: 'Excitation / direct-drive magnets', criticality: 'important' },
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Air-cooled condensers',              criticality: 'important' },
        ],
      },
    ],
  },

  // ── Military (third batch) ───────────────────────────────────────────────
  {
    id: 'artillery-shell',
    label: '155 mm Artillery Shell',
    category: 'military',
    description: 'Standard NATO 155 mm HE round.',
    scaleNote: 'Per round · ~45 kg',
    subsystems: [
      {
        label: 'Body & projectile',
        components: [
          { commodityId: null,    name: 'Forged steel*', role: 'Shell body',         criticality: 'critical', approxAmount: '~22 kg' },
          { commodityId: 'copper',name: 'Copper',         role: 'Driving / rotating band', criticality: 'critical' },
          { commodityId: null,    name: 'TNT / RDX / Composition B*', role: 'HE filler', criticality: 'critical', approxAmount: '~10 kg' },
        ],
      },
      {
        label: 'Propellant & fuze',
        components: [
          { commodityId: null,    name: 'Nitrocellulose propellant*', role: 'Modular charges',     criticality: 'critical' },
          { commodityId: null,    name: 'Tungsten*',                  role: 'Pre-formed fragments / penetrator', criticality: 'important' },
          { commodityId: 'aluminum',name: 'Aluminum',                  role: 'Fuze housing',         criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'atgm',
    label: 'Anti-Tank Missile',
    category: 'military',
    description: 'Man-portable ATGM (≈ Javelin class).',
    scaleNote: 'Per round',
    subsystems: [
      {
        label: 'Warhead & motor',
        components: [
          { commodityId: 'copper',name: 'Copper',           role: 'Shaped-charge liner', criticality: 'critical' },
          { commodityId: null,    name: 'HE (RDX/HMX)*',    role: 'Tandem warhead fill',   criticality: 'critical' },
          { commodityId: null,    name: 'Ammonium perchlorate*', role: 'Solid rocket motor', criticality: 'critical' },
          { commodityId: null,    name: 'Tungsten*',         role: 'Precursor charge penetrator', criticality: 'important' },
        ],
      },
      {
        label: 'Seeker & guidance',
        components: [
          { commodityId: null,    name: 'Mercury cadmium telluride*', role: 'IIR seeker FPA', criticality: 'critical' },
          { commodityId: null,    name: 'Rare earths*',                role: 'Seeker gimbal magnets, optics', criticality: 'critical' },
          { commodityId: 'gold',  name: 'Gold',                        role: 'Mission electronics', criticality: 'important' },
          { commodityId: 'copper',name: 'Copper',                      role: 'Wiring',           criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'body-armor',
    label: 'Body Armor (Plate Carrier)',
    category: 'military',
    description: 'Soldier rifle-rated plate carrier system.',
    scaleNote: 'Per set',
    subsystems: [
      {
        label: 'Plates',
        components: [
          { commodityId: null, name: 'Boron carbide / silicon carbide*', role: 'Ceramic strike face', criticality: 'critical' },
          { commodityId: null, name: 'UHMWPE (Dyneema/Spectra)*',         role: 'Backing layers',      criticality: 'critical' },
          { commodityId: null, name: 'Aramid (Kevlar)*',                  role: 'Soft armor + spall liner', criticality: 'critical' },
        ],
      },
      {
        label: 'Carrier & hardware',
        components: [
          { commodityId: null,    name: 'Cordura nylon*', role: 'Carrier fabric',      criticality: 'important' },
          { commodityId: null,    name: 'Steel hardware*', role: 'Buckles, fasteners', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'night-vision',
    label: 'Night-Vision Goggles',
    category: 'military',
    description: 'Gen-3 image-intensifier NVGs.',
    scaleNote: 'Per binocular set',
    subsystems: [
      {
        label: 'Image intensifier tube',
        components: [
          { commodityId: null, name: 'Gallium arsenide photocathode*', role: 'Photon → electron conversion', criticality: 'critical' },
          { commodityId: null, name: 'Phosphor screen (rare-earth)*', role: 'Electron → image conversion',  criticality: 'critical' },
          { commodityId: null, name: 'Microchannel plate (lead glass)*', role: 'Electron multiplier',         criticality: 'critical' },
        ],
      },
      {
        label: 'Optics & housing',
        components: [
          { commodityId: null,      name: 'Optical glass*', role: 'Objective + eyepiece lenses', criticality: 'critical' },
          { commodityId: 'aluminum',name: 'Aluminum',       role: 'Body housing',                  criticality: 'critical' },
          { commodityId: 'copper',  name: 'Copper',         role: 'Power supply wiring',           criticality: 'important' },
          { commodityId: 'lithium', name: 'Lithium',        role: 'CR-123 batteries',              criticality: 'important' },
        ],
      },
    ],
  },

  // ── Infrastructure (third batch) ─────────────────────────────────────────
  {
    id: 'subway-train',
    label: 'Subway / Metro Train',
    category: 'infrastructure',
    description: 'Electric multiple-unit metro train (~6 cars).',
    scaleNote: 'Per train · ~250 t',
    subsystems: [
      {
        label: 'Body & chassis',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Carbody extrusions (modern fleets)', criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',   role: 'Bogies, wheels, axles',              criticality: 'critical' },
        ],
      },
      {
        label: 'Traction & power',
        components: [
          { commodityId: 'copper', name: 'Copper',     role: 'Traction motors, wiring, third-rail collector', criticality: 'critical' },
          { commodityId: null,     name: 'Rare earths*', role: 'PMSM traction-motor magnets',       criticality: 'critical' },
          { commodityId: null,     name: 'Silicon carbide*', role: 'Inverter MOSFETs',              criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'port-crane',
    label: 'Container Port Crane (STS)',
    category: 'infrastructure',
    description: 'Ship-to-shore gantry crane for container terminals.',
    scaleNote: 'Per crane',
    subsystems: [
      {
        label: 'Structure',
        components: [
          { commodityId: null,       name: 'Steel (structural)*', role: 'Boom, legs, A-frame',  criticality: 'critical', approxAmount: '~1,500 t' },
          { commodityId: 'iron-ore', name: 'Iron ore',            role: 'Upstream steel feedstock', criticality: 'critical' },
        ],
      },
      {
        label: 'Drives & electrics',
        components: [
          { commodityId: 'copper', name: 'Copper',  role: 'Hoist motors, cabling, festoons', criticality: 'critical' },
          { commodityId: null,     name: 'Rare earths*', role: 'Drive-motor magnets',         criticality: 'important' },
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Cabin, walkways',                criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'fiber-optic-cable',
    label: 'Fiber-Optic Cable (Subsea)',
    category: 'infrastructure',
    description: 'Trans-oceanic submarine fiber-optic cable.',
    scaleNote: 'Per km',
    subsystems: [
      {
        label: 'Optical core',
        components: [
          { commodityId: null,    name: 'Silica glass (high-purity)*', role: 'Single-mode fiber strands', criticality: 'critical' },
          { commodityId: null,    name: 'Germanium*',                  role: 'Core dopant for refractive index', criticality: 'critical' },
        ],
      },
      {
        label: 'Armor & sheath',
        components: [
          { commodityId: 'copper', name: 'Copper',  role: 'Power conductor for repeaters',   criticality: 'critical' },
          { commodityId: null,     name: 'Steel armor wires*', role: 'Tensile + abrasion protection', criticality: 'critical' },
          { commodityId: null,     name: 'Polyethylene*', role: 'Outer jacket',                 criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'airport',
    label: 'Airport Terminal',
    category: 'infrastructure',
    description: 'Major international airport terminal + runways.',
    scaleNote: 'Per terminal complex',
    subsystems: [
      {
        label: 'Civil structure',
        components: [
          { commodityId: null,    name: 'Concrete*', role: 'Runways, taxiways, terminal floors', criticality: 'critical', approxAmount: '~millions of m³' },
          { commodityId: null,    name: 'Steel*',    role: 'Roof trusses, jet bridges',          criticality: 'critical' },
          { commodityId: null,    name: 'Glass*',    role: 'Curtain walls, skylights',           criticality: 'critical' },
        ],
      },
      {
        label: 'Systems',
        components: [
          { commodityId: 'copper', name: 'Copper',    role: 'Power + comms backbone', criticality: 'critical' },
          { commodityId: 'aluminum',name: 'Aluminum', role: 'Façade, signage, ducting', criticality: 'critical' },
          { commodityId: 'crude-oil', name: 'Jet fuel (Jet A)', role: 'Fueling infrastructure load', criticality: 'critical' },
        ],
      },
    ],
  },

  // ── Consumer / Food (third batch) ────────────────────────────────────────
  {
    id: 'sneakers',
    label: 'Athletic Sneakers',
    category: 'consumer',
    description: 'Performance running shoe.',
    scaleNote: 'Per pair · ~600 g',
    subsystems: [
      {
        label: 'Upper',
        components: [
          { commodityId: 'cotton', name: 'Cotton',         role: 'Knit / mesh blend (some models)', criticality: 'important' },
          { commodityId: null,     name: 'Polyester / nylon*', role: 'Knit upper main fiber',         criticality: 'critical' },
          { commodityId: null,     name: 'Synthetic leather (PU)*', role: 'Overlays, branding',        criticality: 'important' },
        ],
      },
      {
        label: 'Sole',
        components: [
          { commodityId: 'natural-rubber', name: 'Natural rubber', role: 'Outsole tread',         criticality: 'critical' },
          { commodityId: null,             name: 'EVA / PEBA foam*', role: 'Midsole cushioning', criticality: 'critical' },
          { commodityId: null,             name: 'TPU*',              role: 'Stability shanks',    criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'jeans',
    label: 'Denim Jeans',
    category: 'consumer',
    description: 'Standard 5-pocket denim jeans.',
    scaleNote: 'Per pair · ~600 g',
    subsystems: [
      {
        label: 'Fabric & dye',
        components: [
          { commodityId: 'cotton', name: 'Cotton',  role: 'Denim warp + weft yarn',  criticality: 'critical', approxAmount: '~550 g' },
          { commodityId: null,     name: 'Indigo dye (synthetic)*', role: 'Blue color', criticality: 'critical' },
          { commodityId: null,     name: 'Elastane (spandex)*',     role: 'Stretch (modern fits)', criticality: 'important' },
        ],
      },
      {
        label: 'Hardware',
        components: [
          { commodityId: 'copper', name: 'Copper', role: 'Rivets',           criticality: 'important' },
          { commodityId: 'zinc',   name: 'Zinc',   role: 'Zipper / button alloys', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'toothpaste',
    label: 'Tube of Toothpaste',
    category: 'consumer',
    description: 'Standard fluoride toothpaste.',
    scaleNote: 'Per ~100 g tube',
    subsystems: [
      {
        label: 'Formulation',
        components: [
          { commodityId: null,        name: 'Hydrated silica / calcium carbonate*', role: 'Abrasive', criticality: 'critical' },
          { commodityId: null,        name: 'Sorbitol / glycerin*',                 role: 'Humectant', criticality: 'critical' },
          { commodityId: 'phosphate', name: 'Phosphate',                            role: 'Sodium monofluorophosphate / pyrophosphate', criticality: 'critical' },
          { commodityId: null,        name: 'Fluoride salts*',                      role: 'Active ingredient', criticality: 'critical' },
          { commodityId: null,        name: 'Surfactants (SLS)*',                   role: 'Foaming agent', criticality: 'important' },
        ],
      },
      {
        label: 'Packaging',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum',   role: 'Tube laminate barrier layer', criticality: 'important' },
          { commodityId: null,       name: 'HDPE / LDPE plastic*', role: 'Tube body, cap',     criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'wine',
    label: 'Bottle of Wine',
    category: 'consumer',
    description: 'Still red wine in a glass bottle (~750 mL).',
    scaleNote: 'Per bottle',
    subsystems: [
      {
        label: 'Wine',
        components: [
          { commodityId: null,    name: 'Grapes*',     role: 'Juice + sugars + tannins', criticality: 'critical', approxAmount: '~1.2 kg' },
          { commodityId: null,    name: 'Yeast*',      role: 'Alcoholic fermentation',    criticality: 'critical' },
          { commodityId: 'sugar', name: 'Sugar',       role: 'Chaptalization (when permitted)', criticality: 'trace' },
        ],
      },
      {
        label: 'Bottle & closure',
        components: [
          { commodityId: null,       name: 'Glass*',  role: 'Bottle',                criticality: 'critical' },
          { commodityId: null,       name: 'Cork (or synthetic)*', role: 'Closure',  criticality: 'critical' },
          { commodityId: 'aluminum', name: 'Aluminum', role: 'Capsule / screw cap',   criticality: 'important' },
          { commodityId: null,       name: 'Paper label*', role: 'Branding',         criticality: 'trace' },
        ],
      },
    ],
  },
  {
    id: 'soap',
    label: 'Bar of Soap',
    category: 'consumer',
    description: 'Standard milled bar soap (~100 g).',
    scaleNote: 'Per bar',
    subsystems: [
      {
        label: 'Saponification',
        components: [
          { commodityId: 'palm-oil', name: 'Palm oil',        role: 'Triglyceride feedstock', criticality: 'critical', approxAmount: '~50 g' },
          { commodityId: null,       name: 'Tallow / coconut oil*', role: 'Alternative fats', criticality: 'important' },
          { commodityId: null,       name: 'Sodium hydroxide (lye)*', role: 'Saponifying base', criticality: 'critical' },
          { commodityId: null,       name: 'Fragrance / glycerin*',    role: 'Scent + moisturizer', criticality: 'trace' },
        ],
      },
    ],
  },

  // ── Industrial (extended) ────────────────────────────────────────────────
  {
    id: 'cement-plant',
    label: 'Cement (Portland Clinker)',
    category: 'industrial',
    description: 'Ordinary Portland Cement production output.',
    scaleNote: 'Per t of cement',
    subsystems: [
      {
        label: 'Raw mix',
        components: [
          { commodityId: null, name: 'Limestone*',  role: 'CaO source (~80% of raw mix)', criticality: 'critical', approxAmount: '~1.3 t' },
          { commodityId: null, name: 'Clay / shale*', role: 'SiO₂ + Al₂O₃ source',         criticality: 'critical' },
          { commodityId: null, name: 'Iron oxide / sand*', role: 'Trim materials',         criticality: 'important' },
          { commodityId: null, name: 'Gypsum*',     role: 'Set-time regulator (added post-kiln)', criticality: 'critical' },
        ],
      },
      {
        label: 'Kiln energy',
        components: [
          { commodityId: 'coal',        name: 'Coal',         role: 'Kiln fuel (dominant globally)', criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas',  role: 'Kiln fuel (newer plants)',       criticality: 'important' },
          { commodityId: null,          name: 'Petcoke*',     role: 'Co-fired fuel',                   criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'float-glass',
    label: 'Float Glass (Architectural)',
    category: 'industrial',
    description: 'Soda-lime float-glass sheet output.',
    scaleNote: 'Per t of glass',
    subsystems: [
      {
        label: 'Batch (raw materials)',
        components: [
          { commodityId: null, name: 'Silica sand*',     role: 'SiO₂ — main network former (~70%)', criticality: 'critical', approxAmount: '~720 kg' },
          { commodityId: null, name: 'Soda ash (Na₂CO₃)*', role: 'Flux — lowers melt temperature',  criticality: 'critical' },
          { commodityId: null, name: 'Limestone / dolomite*', role: 'Stabilizer (CaO, MgO)',         criticality: 'critical' },
          { commodityId: null, name: 'Cullet (recycled glass)*', role: '20–40% of batch, reduces energy', criticality: 'important' },
        ],
      },
      {
        label: 'Float bath & energy',
        components: [
          { commodityId: 'tin',         name: 'Tin',         role: 'Molten tin bath the glass floats on', criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'Furnace fuel (~1,500 °C)',            criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'paper-pulp',
    label: 'Paper Mill (Kraft Pulp + Paper)',
    category: 'industrial',
    description: 'Bleached kraft pulp + paper output.',
    scaleNote: 'Per t of paper',
    subsystems: [
      {
        label: 'Fiber & chemistry',
        components: [
          { commodityId: null, name: 'Wood pulp (softwood/hardwood)*', role: 'Cellulose fiber',     criticality: 'critical', approxAmount: '~2.5 m³ wood' },
          { commodityId: null, name: 'Sodium hydroxide + sulfide*',    role: 'Kraft cooking liquor', criticality: 'critical' },
          { commodityId: null, name: 'Chlorine dioxide*',              role: 'Bleaching',             criticality: 'critical' },
          { commodityId: null, name: 'Limestone / CaCO₃*',             role: 'Filler / coating',      criticality: 'important' },
        ],
      },
      {
        label: 'Energy & water',
        components: [
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'Steam / recovery boiler',  criticality: 'critical' },
          { commodityId: null,          name: 'Water*',      role: 'Slurry medium (very intensive)', criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'steel-mill',
    label: 'Steel Mill (BF-BOF)',
    category: 'industrial',
    description: 'Integrated blast-furnace / basic-oxygen steelmaking.',
    scaleNote: 'Per t of crude steel',
    subsystems: [
      {
        label: 'Ironmaking',
        components: [
          { commodityId: 'iron-ore',    name: 'Iron ore',     role: 'Fe source (pellets / sinter)',  criticality: 'critical', approxAmount: '~1.6 t' },
          { commodityId: 'coal',        name: 'Coking coal',  role: 'Coke for blast-furnace reduction', criticality: 'critical', approxAmount: '~600 kg' },
          { commodityId: null,          name: 'Limestone*',   role: 'Slag-forming flux',              criticality: 'critical' },
        ],
      },
      {
        label: 'Alloying & refining',
        components: [
          { commodityId: 'manganese', name: 'Manganese', role: 'Deoxidizer + alloying (in nearly all steels)', criticality: 'critical' },
          { commodityId: 'nickel',    name: 'Nickel',    role: 'Stainless / specialty grades',                  criticality: 'important' },
          { commodityId: 'zinc',      name: 'Zinc',      role: 'Galvanizing downstream',                        criticality: 'important' },
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'DRI / reheat furnaces',                      criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'aluminum-smelter',
    label: 'Aluminum Smelter (Hall-Héroult)',
    category: 'industrial',
    description: 'Primary aluminum production from alumina.',
    scaleNote: 'Per t of primary Al',
    subsystems: [
      {
        label: 'Feedstock',
        components: [
          { commodityId: null, name: 'Bauxite ore*',      role: 'Source of alumina (Al₂O₃)', criticality: 'critical', approxAmount: '~4 t bauxite' },
          { commodityId: null, name: 'Alumina (Al₂O₃)*',  role: 'Direct smelter feed',        criticality: 'critical', approxAmount: '~1.9 t' },
          { commodityId: null, name: 'Cryolite (Na₃AlF₆)*', role: 'Electrolyte solvent',      criticality: 'critical' },
          { commodityId: null, name: 'Petroleum coke*',   role: 'Consumable carbon anodes',  criticality: 'critical', approxAmount: '~400 kg' },
        ],
      },
      {
        label: 'Energy',
        components: [
          { commodityId: 'coal',        name: 'Coal',        role: 'Electricity (where grid is coal-heavy)', criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas', role: 'Electricity / hot air for anodes',        criticality: 'important' },
          { commodityId: 'copper',      name: 'Copper',      role: 'Bus-bars + cell wiring',                  criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'plastics-plant',
    label: 'Polyethylene Plant',
    category: 'industrial',
    description: 'HDPE / LDPE polymer production output.',
    scaleNote: 'Per t of PE resin',
    subsystems: [
      {
        label: 'Feedstock',
        components: [
          { commodityId: 'crude-oil',   name: 'Naphtha (from crude)', role: 'Steam-cracker feed (Europe/Asia)', criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas (ethane)', role: 'Steam-cracker feed (US/ME)',        criticality: 'critical' },
        ],
      },
      {
        label: 'Catalysts & process',
        components: [
          { commodityId: null,      name: 'Ziegler-Natta / metallocene catalysts*', role: 'Polymerization', criticality: 'critical' },
          { commodityId: null,      name: 'Chromium catalyst (Phillips)*',         role: 'HDPE process',    criticality: 'important' },
          { commodityId: null,      name: 'Hydrogen*',                              role: 'MW control',      criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'tire-plant',
    label: 'Tire (Passenger Car)',
    category: 'industrial',
    description: 'Manufactured passenger-car radial tire.',
    scaleNote: 'Per tire · ~10 kg',
    subsystems: [
      {
        label: 'Rubber compound',
        components: [
          { commodityId: 'natural-rubber', name: 'Natural rubber',  role: 'Tread + carcass elasticity', criticality: 'critical', approxAmount: '~2.5 kg' },
          { commodityId: 'crude-oil',      name: 'Synthetic rubber (from oil)', role: 'SBR / BR co-blend', criticality: 'critical' },
          { commodityId: null,             name: 'Carbon black*',    role: 'Reinforcing filler',         criticality: 'critical' },
          { commodityId: null,             name: 'Silica*',          role: 'Low-RR filler',              criticality: 'important' },
          { commodityId: null,             name: 'Sulfur*',          role: 'Vulcanization',              criticality: 'critical' },
        ],
      },
      {
        label: 'Reinforcement',
        components: [
          { commodityId: null, name: 'Steel cord (brass-plated wire)*', role: 'Belt + bead',           criticality: 'critical' },
          { commodityId: null, name: 'Polyester / nylon / aramid cord*', role: 'Body ply reinforcement', criticality: 'critical' },
          { commodityId: 'zinc', name: 'Zinc',                          role: 'Zinc oxide vulcanization activator', criticality: 'important' },
        ],
      },
    ],
  },
  {
    id: 'methanol-plant',
    label: 'Methanol Plant',
    category: 'industrial',
    description: 'Methanol from syngas (CH₃OH) — feedstock chemical.',
    scaleNote: 'Per t of methanol',
    subsystems: [
      {
        label: 'Syngas → methanol',
        components: [
          { commodityId: 'natural-gas', name: 'Natural gas',  role: 'Steam-methane reforming feed', criticality: 'critical' },
          { commodityId: 'coal',        name: 'Coal',         role: 'Gasification feed (China)',     criticality: 'important' },
          { commodityId: null,          name: 'Cu/ZnO/Al₂O₃ catalyst*', role: 'Methanol synthesis loop', criticality: 'critical' },
        ],
      },
      {
        label: 'Equipment',
        components: [
          { commodityId: null,    name: 'Stainless / CrMo steel*', role: 'Reformers, reactors, columns', criticality: 'critical' },
          { commodityId: 'nickel',name: 'Nickel',                  role: 'SMR reformer catalyst',         criticality: 'critical' },
          { commodityId: 'copper',name: 'Copper',                  role: 'Synthesis-loop catalyst (Cu/ZnO)', criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'industrial-robot',
    label: 'Industrial Robot Arm',
    category: 'industrial',
    description: '6-axis articulated factory robot (~200 kg payload).',
    scaleNote: 'Per arm',
    subsystems: [
      {
        label: 'Joints & motors',
        components: [
          { commodityId: 'copper', name: 'Copper',      role: 'Servo motor windings, wiring',  criticality: 'critical' },
          { commodityId: null,     name: 'Rare earths (Nd, Dy)*', role: 'Servo motor magnets',   criticality: 'critical' },
          { commodityId: null,     name: 'Hardened gear steel*', role: 'Harmonic / cycloidal reducers', criticality: 'critical' },
        ],
      },
      {
        label: 'Structure & control',
        components: [
          { commodityId: 'aluminum', name: 'Aluminum',  role: 'Cast arm links, cabinet',  criticality: 'critical' },
          { commodityId: null,       name: 'Steel*',    role: 'Base, gearbox housings',    criticality: 'critical' },
          { commodityId: null,       name: 'Silicon*',  role: 'Servo drives, controller',  criticality: 'critical' },
          { commodityId: 'gold',     name: 'Gold',      role: 'PCB / connector plating',   criticality: 'important' },
          { commodityId: 'tin',      name: 'Tin',       role: 'Solder',                    criticality: 'critical' },
        ],
      },
    ],
  },
  {
    id: 'pharma-api',
    label: 'Pharmaceutical API Plant',
    category: 'industrial',
    description: 'Small-molecule active pharmaceutical ingredient.',
    scaleNote: 'Per kg of API',
    subsystems: [
      {
        label: 'Synthesis inputs',
        components: [
          { commodityId: 'crude-oil', name: 'Petrochemical intermediates', role: 'Building blocks (toluene, xylene, benzene)', criticality: 'critical' },
          { commodityId: 'natural-gas', name: 'Natural gas',                role: 'Ammonia / hydrogen feedstock chains',         criticality: 'critical' },
          { commodityId: 'palladium', name: 'Palladium',                    role: 'Coupling / hydrogenation catalyst',           criticality: 'critical' },
          { commodityId: 'platinum',  name: 'Platinum',                     role: 'Hydrogenation catalyst',                       criticality: 'important' },
          { commodityId: null,        name: 'Solvents (acetonitrile, DCM, IPA)*', role: 'Reaction media',                        criticality: 'critical' },
        ],
      },
      {
        label: 'Plant equipment',
        components: [
          { commodityId: null,    name: 'Stainless steel*', role: 'Reactors, piping, vessels (cGMP)', criticality: 'critical' },
          { commodityId: null,    name: 'Glass-lined steel*', role: 'Corrosion-resistant reactors',     criticality: 'critical' },
          { commodityId: null,    name: 'Hastelloy / nickel alloys*', role: 'Aggressive reactions',     criticality: 'important' },
        ],
      },
    ],
  },
];

/** Stable display order for category chips. */
export const PRODUCT_CATEGORY_ORDER: ProductComposition['category'][] = [
  'transport',
  'electronics',
  'energy',
  'military',
  'infrastructure',
  'industrial',
  'consumer',
];

export const PRODUCT_CATEGORY_LABEL: Record<ProductComposition['category'], string> = {
  transport:      'Transport',
  electronics:    'Electronics',
  energy:         'Energy',
  military:       'Military',
  infrastructure: 'Infrastructure',
  industrial:     'Industrial',
  consumer:       'Consumer',
};

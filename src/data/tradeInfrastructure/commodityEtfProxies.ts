/**
 * commodityEtfProxies.ts — maps the static commodity id (used in commodities.ts)
 * to the corresponding EODHD-style ETF ticker.
 *
 * Only the 9 commodities with listed ETF proxies are included.  Any commodity
 * id not present in this map has no market-bar data available.
 */
export interface EtfProxy {
  symbol:   string;
  exchange: string;
  /** Human-readable name of the ETF */
  name: string;
}

export const COMMODITY_ETF_PROXY: Record<string, EtfProxy> = {
  'gold':        { symbol: 'GLD',  exchange: 'US', name: 'SPDR Gold Shares'              },
  'silver':      { symbol: 'SLV',  exchange: 'US', name: 'iShares Silver Trust'           },
  'crude-oil':   { symbol: 'USO',  exchange: 'US', name: 'United States Oil Fund'         },
  'natural-gas': { symbol: 'UNG',  exchange: 'US', name: 'United States Natural Gas Fund' },
  'corn':        { symbol: 'CORN', exchange: 'US', name: 'Teucrium Corn Fund'             },
  'wheat':       { symbol: 'WEAT', exchange: 'US', name: 'Teucrium Wheat Fund'            },
  'soybeans':    { symbol: 'SOYB', exchange: 'US', name: 'Teucrium Soybean Fund'          },
  'copper':      { symbol: 'CPER', exchange: 'US', name: 'US Copper Index Fund'           },
  'palladium':   { symbol: 'PALL', exchange: 'US', name: 'Aberdeen Phys. Palladium ETF'   },
};

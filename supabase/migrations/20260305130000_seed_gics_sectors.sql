-- Seed gics_sector for the top ~300 US stocks from the static GICS map.
-- This is a one-time data population that mirrors src/lib/sectorMap.ts.
-- Subsequent sector lookups for unknown tickers are handled by the
-- api-finnhub edge function which caches results back here.

UPDATE symbols SET gics_sector = 'Information Technology'
WHERE canonical_ticker IN (
  'AAPL','MSFT','NVDA','AVGO','ORCL','CSCO','ACN','IBM','TXN','QCOM',
  'NOW','INTU','AMAT','LRCX','MU','KLAC','ADI','MCHP','CDNS','SNPS',
  'FTNT','PANW','CRWD','ANSS','GLW','TEL','MPWR','ENPH','KEYS','TDY',
  'ASML','SAP','STM','MKSI','LSCC','ONTO','AMBA','IPGP','CREE','IIVI',
  'VIAV','COHU'
);

UPDATE symbols SET gics_sector = 'Communication Services'
WHERE canonical_ticker IN (
  'GOOGL','GOOG','META','NFLX','DIS','CMCSA','T','VZ','TMUS','CHTR',
  'WBD','PARA','FOXA','FOX','OMC','IPG','TTWO','EA','NTES','SPOT',
  'PINS','SNAP','MTCH','ZG','LYFT','UBER'
);

UPDATE symbols SET gics_sector = 'Consumer Discretionary'
WHERE canonical_ticker IN (
  'AMZN','TSLA','HD','LOW','MCD','SBUX','NKE','TJX','BKNG','ABNB',
  'MAR','HLT','GM','F','RIVN','LCID','ORLY','AZO','BBY','EBAY',
  'YUM','DPZ','CMG','RCL','CCL','NCLH','LVS','MGM','WYNN','PHM',
  'LEN','DHI','MELI','FIGS','LULU','DECK','TPR','RL','VFC','PVH'
);

UPDATE symbols SET gics_sector = 'Consumer Staples'
WHERE canonical_ticker IN (
  'WMT','COST','PG','KO','PEP','PM','MO','MDLZ','CL','KMB',
  'GIS','K','HRL','CAG','SJM','MKC','HSY','TSN','MNST','STZ',
  'BF_B','TAP','KR','SFM','CVS','WBA','PRGO'
);

UPDATE symbols SET gics_sector = 'Health Care'
WHERE canonical_ticker IN (
  'LLY','JNJ','UNH','ABBV','MRK','TMO','ABT','DHR','PFE','BMY',
  'AMGN','GILD','ISRG','MDT','SYK','BSX','EW','BDX','IQV','CRL',
  'IDXX','MTD','A','HOLX','DXCM','PODD','INCY','ALNY','MRNA','BNTX',
  'REGN','VRTX','AZN','NVO','RHHBY','SNY','HUM','CI','ELV','CNC',
  'MCK','CAH','ABC'
);

UPDATE symbols SET gics_sector = 'Financials'
WHERE canonical_ticker IN (
  'BRK_B','JPM','V','MA','BAC','WFC','GS','MS','BLK','C',
  'AXP','SCHW','USB','TFC','PNC','COF','DFS','SYF','PYPL','FIS',
  'FI','GPN','AIG','MET','PRU','AFL','ALL','PGR','CB','TRV',
  'HIG','BK','STT','NTRS','ICE','CME','NDAQ','CBOE','MSCI','SPGI',
  'MCO','AMG','BEN','IVZ'
);

UPDATE symbols SET gics_sector = 'Industrials'
WHERE canonical_ticker IN (
  'RTX','HON','UPS','CAT','DE','GE','LMT','NOC','GD','BA',
  'TDG','HWM','FDX','CSX','NSC','UNP','DAL','UAL','AAL','LUV',
  'JBLU','SAVE','MMM','EMR','ETN','PH','ROK','AME','IEX','XYL',
  'RRX','GNRC','PWR','FAST','GWW','MSC','ITW','DOV','IR','CARR',
  'OTIS','WAB','GEV','TIH','MOD','QIMC','VSE','ROLL','AXON','SAIC',
  'BAH','LDOS','DRS','HII','TXT','LHX','SPR','KTOS','CACI','MANT',
  'KEYW'
);

UPDATE symbols SET gics_sector = 'Energy'
WHERE canonical_ticker IN (
  'XOM','CVX','COP','EOG','SLB','MPC','PSX','VLO','PXD','DVN',
  'HAL','BKR','HES','OXY','OKE','WMB','KMI','EPD','ET','MPLX',
  'PAA','AM','APA','MRO','FANG','LNG','RRC','AR','CTRA','SM'
);

UPDATE symbols SET gics_sector = 'Utilities'
WHERE canonical_ticker IN (
  'NEE','DUK','SO','D','EXC','SRE','AEP','PEG','XEL','WEC',
  'ES','CMS','DTE','PPL','ETR','FE','CNP','AES','NRG','VST',
  'EIX','PCG','AWK','WTR'
);

UPDATE symbols SET gics_sector = 'Real Estate'
WHERE canonical_ticker IN (
  'PLD','AMT','EQIX','CCI','SPG','O','WELL','DLR','PSA','EXR',
  'AVB','EQR','VTR','PEAK','ARE','CBRE','SBAC','AMH','MAA','UDR',
  'CPT','AIV','KIM','REG','BXP','SLG','VNO','HIW'
);

UPDATE symbols SET gics_sector = 'Materials'
WHERE canonical_ticker IN (
  'LIN','APD','ECL','SHW','FCX','NEM','NUE','STLD','CF','MOS',
  'ALB','PPG','RPM','FMC','IFF','CE','EMN','CTVA','DD','DOW',
  'LYB','HUN','WRK','PKG','IP','SON','CLF','MT','RIO','BHP',
  'VALE','AA','X','SCCO','SCD','HGRAF'
);

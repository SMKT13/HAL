export interface MarketQuote {
  price: number;
  prev_close: number;
  open: number;
  day_high: number;
  day_low: number;
  volume: number;
  w52h: number;
  w52l: number;
}

export interface Indicators {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macd_sig: number | null;
  macd_hist: number | null;
  hist_prev?: number | null;
  atr14: number | null;
  bb_lo: number | null;
  bb_mid: number | null;
  bb_up: number | null;
  mfi14: number | null;
  mfi_rsi_spread?: number | null;
  ann_vol_realized?: number | null;
}

export interface Levels {
  pivot: number;
  pivot_session?: string;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  gate: number | null;
  reduce?: number;
  floor?: number;
  stop?: number | null;
  target1?: number;
  target2?: number;
  fib: {
    '0.236': number;
    '0.382': number;
    '0.5': number;
    '0.618': number;
  };
}

export interface MarketPayload {
  quote: MarketQuote;
  daily: Array<{ d: string; o: number; h: number; l: number; c: number; v: number }>;
  ind: Indicators;
  levels: Levels;
  series: {
    sma20: (number | null)[];
    sma50: (number | null)[];
    sma200: (number | null)[];
    rsi: (number | null)[];
    macd: (number | null)[];
    sig: (number | null)[];
    hist: (number | null)[];
  };
  week: Array<{ d: string; o: number; h: number; l: number; c: number; v: number }>;
  mkt?: {
    price: number;
    prev: number;
    chg_pct: number;
    rsi14: number;
    s20: number;
    s200: number;
    w52l: number;
    w52h: number;
    above_200dma?: boolean;
    above_20dma?: boolean;
    dist_52wl_pct?: number;
    beta60: number;
    corr60: number;
    quote_as_of?: string;
    last_session?: string;
  };
  fetched_at?: string;
  fetched_at_iso?: string;
  quote_as_of?: string;
  last_session?: string;
  stale?: boolean;
  snapshot_mode?: boolean;
  data_status?: 'live' | 'cached' | 'stale' | 'snapshot';
  market_state?: string;
}

export interface ResearchAgent {
  id: string;
  name: string;
  stance: string;
  evidence: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  published: string;
  source: string;
  official: boolean;
  category: 'Orders' | 'Results' | 'Operations' | 'Official' | 'General';
  bookmarked?: boolean;
}

export interface BusinessNote {
  id: string;
  date: string;
  title: string;
  text: string;
  category: 'Order book' | 'Deliveries' | 'Guidance' | 'Results' | 'Operations' | 'Other';
  url?: string;
}

export interface FundingState {
  margin: number | null;
  free: number | null;
  savedAt: string | null;
}

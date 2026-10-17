import React from 'react';
import { MarketPayload } from '../types';
import { PositionState, markBook } from '../utils/portfolio';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ShieldAlert, Calendar, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';

interface OverviewViewProps {
  data: MarketPayload | null;
  position: PositionState;
  onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, position, onNavigate }) => {
  const quote = data?.quote || {
    price: 4655.6,
    prev_close: 4647.4,
    open: 4650.0,
    day_high: 4696.0,
    day_low: 4590.0,
    volume: 502657,
    w52h: 5149.9,
    w52l: 3479.1
  };

  const change = quote.price - quote.prev_close;
  const changePct = quote.prev_close > 0 ? (change / quote.prev_close) * 100 : 0;
  const isPositive = change >= 0;

  const session = data?.last_session || (data as any)?.levels?.pivot_session || '2026-10-09';
  const book = markBook(position, quote.price, session);

  const futuresUnits = position.fq;
  const putUnits = position.p1q + position.p2q;
  const coveragePct = futuresUnits > 0 ? Math.min(100, Math.round((putUnits / futuresUnits) * 100)) : 0;

  const activeExpiries = [
    position.fq > 0 ? position.fexpiry : null,
    position.p1q > 0 ? position.p1expiry : null,
    position.p2q > 0 ? position.p2expiry : null
  ].filter(Boolean) as string[];
  const nextExpiry = activeExpiries.sort()[0] || position.fexpiry || '2026-10-27';

  // Generate SVG points for mini sparkline
  const recentBars = (data?.daily || []).slice(-16);
  const minPrice = Math.min(...recentBars.map((b) => b.c), quote.price * 0.98);
  const maxPrice = Math.max(...recentBars.map((b) => b.c), quote.price * 1.02);
  const range = maxPrice - minPrice || 1;

  const sparklinePoints = recentBars
    .map((b, i) => {
      const x = (i / (recentBars.length - 1 || 1)) * 280;
      const y = 60 - ((b.c - minPrice) / range) * 50;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Top Status Banner */}
      <div className="flex items-center justify-between text-xs text-[#a8b6c9] bg-[#141d2b] px-4 py-2.5 rounded-xl border border-[#2b3a50]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>NSE: HAL · Cash &amp; Derivatives Desk</span>
        </div>
        <div>
          <span>Provider Session: {data?.market_state || 'Closed'} · Refreshes periodically</span>
        </div>
      </div>

      {/* Hero Quote Card */}
      <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#83caff] via-[#3b82f6] to-[#80dfb0]"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">
              Hindustan Aeronautics Limited
            </div>
            <div className="flex items-baseline gap-4 flex-wrap">
              <span className={`text-5xl font-black tracking-tight ${isPositive ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
                ₹{quote.price.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              </span>
              <div className={`flex items-center gap-1 font-semibold text-sm ${isPositive ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
                {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>
                  {isPositive ? '+' : ''}₹{Math.abs(change).toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="text-xs text-[#a8b6c9] flex items-center gap-3 flex-wrap">
              <span>Open: <strong className="text-white">₹{quote.open?.toLocaleString('en-IN')}</strong></span>
              <span>•</span>
              <span>High: <strong className="text-white">₹{quote.day_high?.toLocaleString('en-IN')}</strong></span>
              <span>•</span>
              <span>Low: <strong className="text-white">₹{quote.day_low?.toLocaleString('en-IN')}</strong></span>
              <span>•</span>
              <span>Volume: <strong className="text-white">{quote.volume ? (quote.volume / 100000).toFixed(1) + 'L' : '—'}</strong></span>
            </div>
          </div>

          {/* Sparkline & Quick Metrics */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {recentBars.length > 2 && (
              <div className="bg-[#1b283a] p-3 rounded-xl border border-[#2b3a50] flex flex-col justify-between w-full sm:w-72">
                <div className="flex justify-between items-center text-[10px] text-[#a8b6c9] mb-1 font-mono">
                  <span>16-DAY TRAJECTORY</span>
                  <span className={isPositive ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                    ₹{minPrice.toFixed(0)} → ₹{maxPrice.toFixed(0)}
                  </span>
                </div>
                <svg className="w-full h-16 overflow-visible" viewBox="0 0 280 60">
                  <polyline
                    fill="none"
                    stroke={isPositive ? '#80dfb0' : '#ff9f9c'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklinePoints}
                  />
                </svg>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 w-full sm:w-64">
              <div className="bg-[#1b283a] p-2.5 rounded-xl border border-[#2b3a50]/70">
                <span className="text-[10px] uppercase tracking-wider text-[#a8b6c9] block">52W High</span>
                <span className="text-sm font-bold text-white">₹{quote.w52h?.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-[#1b283a] p-2.5 rounded-xl border border-[#2b3a50]/70">
                <span className="text-[10px] uppercase tracking-wider text-[#a8b6c9] block">52W Low</span>
                <span className="text-sm font-bold text-white">₹{quote.w52l?.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-[#1b283a] p-2.5 rounded-xl border border-[#2b3a50]/70">
                <span className="text-[10px] uppercase tracking-wider text-[#a8b6c9] block">RSI (14)</span>
                <span className="text-sm font-bold text-[#83caff]">{data?.ind?.rsi14?.toFixed(1) || '44.4'}</span>
              </div>
              <div className="bg-[#1b283a] p-2.5 rounded-xl border border-[#2b3a50]/70">
                <span className="text-[10px] uppercase tracking-wider text-[#a8b6c9] block">ATR (14)</span>
                <span className="text-sm font-bold text-white">₹{data?.ind?.atr14?.toFixed(1) || '114.2'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#1b283a] flex items-center justify-between text-xs text-[#a8b6c9]">
          <span>
            {data?.snapshot_mode
              ? 'Archived benchmark snapshot: 09-Oct-2026. Spot models use this base.'
              : `Quote as of: ${data?.quote_as_of ? new Date(data.quote_as_of).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recent'}`}
          </span>
          <button
            onClick={() => onNavigate('markets')}
            className="text-[#83caff] hover:underline flex items-center gap-1 font-medium"
          >
            Explore Market &amp; Technicals ↗
          </button>
        </div>
      </div>

      {/* Position Basket Card */}
      <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#83caff]">YOUR POSITION BASKET</span>
            <h2 className="text-lg font-bold text-white">Open Book Exposure &amp; P&amp;L</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('positions')}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] hover:bg-[#1f344c] transition-colors"
            >
              Protect Exposure ↗
            </button>
            <button
              onClick={() => onNavigate('positions')}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] transition-colors font-semibold"
            >
              Open Book Editor ↗
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1b283a] p-4 rounded-xl border border-[#2b3a50]">
            <span className="text-xs text-[#a8b6c9] block mb-1">Open Position P&amp;L (Indicative)</span>
            <div className={`text-2xl font-black ${book.total !== null && book.total >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
              {book.total !== null ? (book.total >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(book.total)).toLocaleString('en-IN') : '—'}
            </div>
            <span className="text-[11px] text-[#a8b6c9] block mt-1">
              Includes {position.realized ? `realized ${position.realized >= 0 ? '+' : ''}₹${position.realized}` : 'open mark'}
            </span>
          </div>

          <div className="bg-[#1b283a] p-4 rounded-xl border border-[#2b3a50]">
            <span className="text-xs text-[#a8b6c9] block mb-1">Futures Units</span>
            <div className="text-2xl font-bold text-white">{futuresUnits} units</div>
            <span className="text-[11px] text-[#a8b6c9] block mt-1">
              {(futuresUnits / position.lot).toFixed(1)} lots ({position.lot} / lot)
            </span>
          </div>

          <div className="bg-[#1b283a] p-4 rounded-xl border border-[#2b3a50]">
            <span className="text-xs text-[#a8b6c9] block mb-1">Put Coverage</span>
            <div className="text-2xl font-bold text-[#83caff]">
              {futuresUnits > 0 ? `${coveragePct}%` : putUnits > 0 ? 'Puts only' : '0%'}
            </div>
            <span className="text-[11px] text-[#a8b6c9] block mt-1">
              {futuresUnits > 0
                ? `${putUnits} put units / ${futuresUnits} fut`
                : putUnits > 0
                ? `${putUnits} put units (no futures)`
                : 'No open futures to hedge'}
            </span>
          </div>

          <div className="bg-[#1b283a] p-4 rounded-xl border border-[#2b3a50]">
            <span className="text-xs text-[#a8b6c9] block mb-1">Next Contract Expiry</span>
            <div className="text-2xl font-bold text-white">{nextExpiry}</div>
            <span className="text-[11px] text-[#a8b6c9] block mt-1">Monthly NSE stock F&amp;O</span>
          </div>
        </div>
      </div>

      {/* AI Intelligence Spotlight Banner */}
      <div className="bg-gradient-to-r from-[#141d2b] via-[#172538] to-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-[#83caff] shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#83caff]">
                INSTITUTIONAL AI COPILOT
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-[#83caff] border border-blue-400/30">
                Gemini 3.8
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              Live Multi-Agent Consensus &amp; Sourced Search Research
            </h3>
            <p className="text-xs text-[#a8b6c9] mt-0.5">
              5-analyst committee deliberation on HAL structure, real-time Google Search updates, and position stress-testing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('ai')}
            className="px-4 py-2 rounded-xl bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            Launch AI Copilot <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* On Your Radar & Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Alerts */}
        <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b283a] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#ffe098]" />
              <h3 className="font-bold text-sm text-white">On Your Radar · Strategy Notes</h3>
            </div>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-[#83caff] px-2 py-0.5 rounded bg-[#1f344c]">
              RISK CHECKS
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50] flex gap-3">
              <AlertCircle className="w-4 h-4 text-[#83caff] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Rollover window approaching</strong>
                <p className="text-[#a8b6c9]">
                  Earliest contract expires on {nextExpiry}. Compare front vs next month calendar spread in the Position Desk.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50] flex gap-3">
              <TrendingUp className="w-4 h-4 text-[#80dfb0] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Order Book &amp; Deliveries Backlog</strong>
                <p className="text-[#a8b6c9]">
                  HAL order book exceeds ₹2.54 L Cr (~8x revenue). Watch Tejas Mk1A delivery milestones and engine supply updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Market Context NIFTY 50 */}
        <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1b283a] pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#83caff]" />
              <h3 className="font-bold text-sm text-white">Market Context · NIFTY 50</h3>
            </div>
            <span className="text-xs text-[#a8b6c9]">60-Day Association</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
              <span className="text-[#a8b6c9] block mb-1">NIFTY 50 Spot</span>
              <span className="text-base font-bold text-white">22,520.5</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">+1.30%</span>
            </div>
            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
              <span className="text-[#a8b6c9] block mb-1">HAL Beta (60d)</span>
              <span className="text-base font-bold text-[#83caff]">0.97</span>
              <span className="text-[10px] text-[#a8b6c9] block mt-0.5">Close to 1.0 market sensitivity</span>
            </div>
            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
              <span className="text-[#a8b6c9] block mb-1">Correlation (60d)</span>
              <span className="text-base font-bold text-white">0.40</span>
              <span className="text-[10px] text-[#a8b6c9] block mt-0.5">Moderate correlation</span>
            </div>
            <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
              <span className="text-[#a8b6c9] block mb-1">NIFTY 200-DMA</span>
              <span className="text-base font-bold text-white">24,271</span>
              <span className="text-[10px] text-amber-400 block mt-0.5">Index below long-term trend</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

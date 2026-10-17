import React, { useState, useEffect, useRef } from 'react';
import { MarketPayload } from '../types';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Maximize2, ExternalLink, Search, Eye, EyeOff, BarChart2, Activity } from 'lucide-react';

interface MarketsViewProps {
  data: MarketPayload | null;
}

export const MarketsView: React.FC<MarketsViewProps> = ({ data }) => {
  const [timeframe, setTimeframe] = useState<'D' | '15m' | '1h'>('D');
  const [marketTab, setMarketTab] = useState<'chart' | 'futures' | 'options' | 'tradingview'>('chart');
  const [strikeFilter, setStrikeFilter] = useState<string>('');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('2026-10-27');

  // Indicator visibility toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const rsiChartInstance = useRef<IChartApi | null>(null);

  const quote = data?.quote || {
    price: 4655.6,
    open: 4650.0,
    day_high: 4696.0,
    day_low: 4590.0,
    volume: 502657,
    w52h: 5149.9,
    w52l: 3479.1
  };

  const levels = data?.levels;
  const ind = data?.ind;

  // Mount Main Price Chart with Candlesticks, SMAs and Volume
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#141d2b' },
        textColor: '#a8b6c9',
      },
      grid: {
        vertLines: { color: '#1b283a' },
        horzLines: { color: '#1b283a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 380,
      timeScale: {
        borderColor: '#2b3a50',
      },
      rightPriceScale: {
        borderColor: '#2b3a50',
      }
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const dailyBars = data?.daily || [];
    if (dailyBars.length > 0) {
      const formattedCandles = dailyBars.map((bar) => ({
        time: bar.d,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      }));
      candleSeries.setData(formattedCandles as any);

      // Volume histogram overlay
      if (showVolume) {
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume_scale',
        });
        chart.priceScale('volume_scale').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
        volumeSeries.setData(
          dailyBars.map((bar) => ({
            time: bar.d,
            value: bar.v,
            color: bar.c >= bar.o ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
          })) as any
        );
      }

      // SMA 20
      if (showSMA20 && data?.series?.sma20) {
        const sma20Series = chart.addLineSeries({
          color: '#f39c12',
          lineWidth: 2,
          title: 'SMA 20',
        });
        const sma20Data = dailyBars
          .map((bar, i) => ({
            time: bar.d,
            value: data.series.sma20[i],
          }))
          .filter((pt) => pt.value !== null && Number.isFinite(pt.value));
        sma20Series.setData(sma20Data as any);
      }

      // SMA 50
      if (showSMA50 && data?.series?.sma50) {
        const sma50Series = chart.addLineSeries({
          color: '#3498db',
          lineWidth: 2,
          title: 'SMA 50',
        });
        const sma50Data = dailyBars
          .map((bar, i) => ({
            time: bar.d,
            value: data.series.sma50[i],
          }))
          .filter((pt) => pt.value !== null && Number.isFinite(pt.value));
        sma50Series.setData(sma50Data as any);
      }

      // SMA 200
      if (showSMA200 && data?.series?.sma200) {
        const sma200Series = chart.addLineSeries({
          color: '#9b59b6',
          lineWidth: 2,
          title: 'SMA 200',
        });
        const sma200Data = dailyBars
          .map((bar, i) => ({
            time: bar.d,
            value: data.series.sma200[i],
          }))
          .filter((pt) => pt.value !== null && Number.isFinite(pt.value));
        sma200Series.setData(sma200Data as any);
      }
    }

    chartInstance.current = chart;

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  }, [data?.daily, showSMA20, showSMA50, showSMA200, showVolume]);

  // Mount RSI Chart
  useEffect(() => {
    if (!rsiContainerRef.current || marketTab !== 'chart') return;

    if (rsiChartInstance.current) {
      rsiChartInstance.current.remove();
      rsiChartInstance.current = null;
    }

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#141d2b' },
        textColor: '#a8b6c9',
      },
      grid: {
        vertLines: { color: '#1b283a' },
        horzLines: { color: '#1b283a' },
      },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
      timeScale: {
        borderColor: '#2b3a50',
      },
      rightPriceScale: {
        borderColor: '#2b3a50',
      }
    });

    const rsiLine = rsiChart.addLineSeries({
      color: '#8e44ad',
      lineWidth: 2,
      title: 'RSI 14',
    });

    const dailyBars = data?.daily || [];
    if (dailyBars.length > 0 && data?.series?.rsi) {
      const rsiData = dailyBars
        .map((bar, i) => ({
          time: bar.d,
          value: data.series.rsi[i],
        }))
        .filter((pt) => pt.value !== null && Number.isFinite(pt.value));
      rsiLine.setData(rsiData as any);
    }

    rsiChartInstance.current = rsiChart;

    const handleRsiResize = () => {
      if (rsiContainerRef.current && rsiChartInstance.current) {
        rsiChartInstance.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleRsiResize);
    return () => {
      window.removeEventListener('resize', handleRsiResize);
      if (rsiChartInstance.current) {
        rsiChartInstance.current.remove();
        rsiChartInstance.current = null;
      }
    };
  }, [data?.daily, marketTab]);

  // Mock Option Chain data
  const baseStrikes = [4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900, 5000, 5100];
  const filteredStrikes = baseStrikes.filter((k) =>
    strikeFilter ? String(k).includes(strikeFilter) : true
  );

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">
            NSE · CASH &amp; DERIVATIVES
          </span>
          <h1 className="text-2xl font-bold text-white">Market view</h1>
          <p className="text-xs text-[#a8b6c9]">Price, participation and the cost of protection.</p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-[#141d2b] p-1 rounded-xl border border-[#2b3a50]">
          <button
            onClick={() => setMarketTab('chart')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              marketTab === 'chart'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Technical Chart
          </button>
          <button
            onClick={() => setMarketTab('futures')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              marketTab === 'futures'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Futures Book
          </button>
          <button
            onClick={() => setMarketTab('options')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              marketTab === 'options'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Option Chain
          </button>
          <button
            onClick={() => setMarketTab('tradingview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              marketTab === 'tradingview'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            TradingView Embed
          </button>
        </div>
      </div>

      {/* SUBTAB 1: TECHNICAL CHART & INDICATORS */}
      {marketTab === 'chart' && (
        <div className="space-y-6">
          {/* Main Chart Card */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-white">HAL Daily Candlesticks</span>

                {/* Moving Average Toggles */}
                <button
                  onClick={() => setShowSMA20(!showSMA20)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    showSMA20
                      ? 'bg-[#f39c12]/20 border-[#f39c12] text-[#f39c12]'
                      : 'bg-[#1b283a] border-[#2b3a50] text-[#a8b6c9]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f39c12]"></span>
                  SMA 20
                </button>

                <button
                  onClick={() => setShowSMA50(!showSMA50)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    showSMA50
                      ? 'bg-[#3498db]/20 border-[#3498db] text-[#3498db]'
                      : 'bg-[#1b283a] border-[#2b3a50] text-[#a8b6c9]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3498db]"></span>
                  SMA 50
                </button>

                <button
                  onClick={() => setShowSMA200(!showSMA200)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    showSMA200
                      ? 'bg-[#9b59b6]/20 border-[#9b59b6] text-[#9b59b6]'
                      : 'bg-[#1b283a] border-[#2b3a50] text-[#a8b6c9]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9b59b6]"></span>
                  SMA 200
                </button>

                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    showVolume
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                      : 'bg-[#1b283a] border-[#2b3a50] text-[#a8b6c9]'
                  }`}
                >
                  Volume
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(['D', '15m', '1h'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      timeframe === tf
                        ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                        : 'bg-[#1b283a] text-[#a8b6c9] hover:text-white'
                    }`}
                  >
                    {tf === 'D' ? 'Daily' : tf}
                  </button>
                ))}
              </div>
            </div>

            {/* TradingView Lightweight Charts Container */}
            <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden border border-[#1b283a]" />

            {/* RSI Sub-pane */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-[#a8b6c9] mb-1">
                <span className="font-semibold text-white">Relative Strength Index (RSI · 14)</span>
                <span>Current: <strong className="text-[#8e44ad]">{ind?.rsi14?.toFixed(1) || '44.4'}</strong> (Overbought: 70 / Oversold: 30)</span>
              </div>
              <div ref={rsiContainerRef} className="w-full rounded-xl overflow-hidden border border-[#1b283a]" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#a8b6c9]">
              <span>Charts by TradingView Lightweight Charts™</span>
              <span>Latest session: {data?.last_session || '2026-10-09'}</span>
            </div>
          </div>

          {/* Reference Levels & Indicator Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reference Levels */}
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">Calculated Reference Levels</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                      <th className="py-2 px-3">Reference</th>
                      <th className="py-2 px-3">Basis</th>
                      <th className="py-2 px-3 text-right">₹ Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">SMA 20</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">20-session trend reference</td>
                      <td className="py-2 px-3 text-right font-mono text-[#f39c12]">
                        ₹{levels?.gate ? Math.round(levels.gate).toLocaleString('en-IN') : '4,749'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">SMA 50</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">50-session trend reference</td>
                      <td className="py-2 px-3 text-right font-mono text-[#3498db]">
                        ₹{levels?.stop ? Math.round(levels.stop).toLocaleString('en-IN') : '4,826'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">SMA 200</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">Long-term structural DMA</td>
                      <td className="py-2 px-3 text-right font-mono text-[#9b59b6]">
                        ₹{ind?.sma200 ? Math.round(ind.sma200).toLocaleString('en-IN') : '4,418'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">Floor / Support</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">Old demand shelf</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">
                        ₹{levels?.floor?.toLocaleString('en-IN') || '4,616'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">R1 / S1 Pivot</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">Floor pivot resistance / support</td>
                      <td className="py-2 px-3 text-right font-mono text-white">
                        ₹{levels?.r1 ? Math.round(levels.r1).toLocaleString('en-IN') : '4,704'} / ₹
                        {levels?.s1 ? Math.round(levels.s1).toLocaleString('en-IN') : '4,598'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#1b283a]">
                      <td className="py-2 px-3 font-semibold text-white">Fib 38.2%</td>
                      <td className="py-2 px-3 text-[#a8b6c9]">52-week swing retracement</td>
                      <td className="py-2 px-3 text-right font-mono text-white">
                        ₹{levels?.fib?.['0.382'] ? Math.round(levels.fib['0.382']).toLocaleString('en-IN') : '4,512'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Sessions OHLCV */}
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">Last Six Sessions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                      <th className="py-2 px-2.5">Date</th>
                      <th className="py-2 px-2.5">Open</th>
                      <th className="py-2 px-2.5">High</th>
                      <th className="py-2 px-2.5">Low</th>
                      <th className="py-2 px-2.5">Close</th>
                      <th className="py-2 px-2.5 text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.week || []).slice(-6).reverse().map((bar) => (
                      <tr key={bar.d} className="border-b border-[#1b283a] hover:bg-[#1b283a]/30">
                        <td className="py-2 px-2.5 font-mono text-white">{bar.d}</td>
                        <td className="py-2 px-2.5 text-[#a8b6c9]">₹{Math.round(bar.o)}</td>
                        <td className="py-2 px-2.5 text-emerald-400">₹{Math.round(bar.h)}</td>
                        <td className="py-2 px-2.5 text-red-400">₹{Math.round(bar.l)}</td>
                        <td className="py-2 px-2.5 font-semibold text-white">₹{Math.round(bar.c)}</td>
                        <td className="py-2 px-2.5 text-right text-[#a8b6c9]">
                          {(bar.v / 100000).toFixed(1)}L
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: FUTURES BOOK */}
      {marketTab === 'futures' && (
        <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">HAL Stock Futures</h3>
              <p className="text-xs text-[#a8b6c9]">Contract specifications, open interest, and lot sizes.</p>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#83caff] px-2 py-0.5 rounded bg-[#1f344c]">
              NSE F&amp;O
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                  <th className="py-2.5 px-3">Contract Expiry</th>
                  <th className="py-2.5 px-3">Lot Size</th>
                  <th className="py-2.5 px-3">Last Traded ₹</th>
                  <th className="py-2.5 px-3">Open Interest</th>
                  <th className="py-2.5 px-3">Volume</th>
                  <th className="py-2.5 px-3">Basis vs Spot</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { expiry: '2026-10-27', lot: 150, ltp: 4670.5, oi: '45.0 L', vol: '8.5 L', basis: '+₹14.9' },
                  { expiry: '2026-11-26', lot: 150, ltp: 4695.5, oi: '37.0 L', vol: '3.2 L', basis: '+₹39.9' },
                  { expiry: '2026-12-31', lot: 150, ltp: 4720.0, oi: '12.5 L', vol: '0.9 L', basis: '+₹64.4' }
                ].map((row) => (
                  <tr key={row.expiry} className="border-b border-[#1b283a] hover:bg-[#1b283a]/40">
                    <td className="py-3 px-3 font-bold text-white">{row.expiry}</td>
                    <td className="py-3 px-3 text-[#a8b6c9]">{row.lot} units</td>
                    <td className="py-3 px-3 font-semibold text-[#83caff]">₹{row.ltp.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-[#a8b6c9]">{row.oi}</td>
                    <td className="py-3 px-3 text-[#a8b6c9]">{row.vol}</td>
                    <td className="py-3 px-3 font-mono text-emerald-400">{row.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: OPTION CHAIN */}
      {marketTab === 'options' && (
        <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Option Chain · Calls &amp; Puts</h3>
              <p className="text-xs text-[#a8b6c9]">Indicative Greeks and bid/ask spreads for HAL.</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="bg-[#1b283a] border border-[#2b3a50] text-white px-3 py-1.5 rounded-lg text-xs"
              >
                <option value="2026-10-27">Expiry: 2026-10-27 (Front)</option>
                <option value="2026-11-26">Expiry: 2026-11-26 (Next)</option>
                <option value="2026-12-31">Expiry: 2026-12-31 (Far)</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#a8b6c9]" />
                <input
                  type="text"
                  placeholder="Filter strike..."
                  value={strikeFilter}
                  onChange={(e) => setStrikeFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center">
              <thead>
                <tr className="border-b border-[#2b3a50] text-[#a8b6c9] bg-[#1b283a]">
                  <th colSpan={3} className="py-2 border-r border-[#2b3a50] text-emerald-400">CALL OPTIONS</th>
                  <th className="py-2 font-bold text-white">STRIKE ₹</th>
                  <th colSpan={4} className="py-2 border-l border-[#2b3a50] text-red-400">PUT OPTIONS</th>
                </tr>
                <tr className="border-b border-[#2b3a50] text-[11px] text-[#a8b6c9]">
                  <th className="py-2 px-2">Call LTP</th>
                  <th className="py-2 px-2">Call OI</th>
                  <th className="py-2 px-2 border-r border-[#2b3a50]">Call IV</th>
                  <th className="py-2 px-3 text-white font-bold">Strike</th>
                  <th className="py-2 px-2 border-l border-[#2b3a50]">Put LTP</th>
                  <th className="py-2 px-2">Bid / Ask</th>
                  <th className="py-2 px-2">Put Delta</th>
                  <th className="py-2 px-2">Put IV</th>
                </tr>
              </thead>
              <tbody>
                {filteredStrikes.map((strike) => {
                  const isATM = Math.abs(strike - quote.price) < 60;
                  const isITMPut = strike > quote.price;
                  const putLtp = Math.max(strike - quote.price, 12) + 24;
                  const callLtp = Math.max(quote.price - strike, 15) + 22;

                  return (
                    <tr
                      key={strike}
                      className={`border-b border-[#1b283a] hover:bg-[#1b283a]/40 ${
                        isATM ? 'bg-[#1f344c]/30 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2 px-2 text-white">₹{callLtp.toFixed(1)}</td>
                      <td className="py-2 px-2 text-[#a8b6c9]">1.2L</td>
                      <td className="py-2 px-2 border-r border-[#2b3a50] text-[#a8b6c9]">25.4%</td>
                      <td className="py-2 px-3 font-bold text-white bg-[#141d2b]">
                        ₹{strike} {isATM ? '• ATM' : ''}
                      </td>
                      <td className="py-2 px-2 border-l border-[#2b3a50] text-white">₹{putLtp.toFixed(1)}</td>
                      <td className="py-2 px-2 text-[#a8b6c9]">
                        ₹{(putLtp - 1).toFixed(1)} / ₹{(putLtp + 1).toFixed(1)}
                      </td>
                      <td className="py-2 px-2 font-mono text-[#83caff]">
                        {isITMPut ? '-0.62' : '-0.34'}
                      </td>
                      <td className="py-2 px-2 text-[#a8b6c9]">26.8%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TRADINGVIEW EMBED */}
      {marketTab === 'tradingview' && (
        <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Interactive TradingView Chart</h3>
              <p className="text-xs text-[#a8b6c9]">Live TradingView embed widget for NSE: HAL with RSI &amp; MACD studies.</p>
            </div>
            <a
              href="https://in.tradingview.com/symbols/NSE-HAL/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#83caff] hover:underline flex items-center gap-1 font-semibold"
            >
              Full Screen TradingView ↗
            </a>
          </div>

          <div className="h-[500px] w-full rounded-xl overflow-hidden bg-[#0c111b] border border-[#2b3a50]">
            <iframe
              title="TradingView HAL"
              src="https://s.tradingview.com/widgetembed/?symbol=NSE%3AHAL&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FKolkata"
              className="w-full h-full border-0"
            />
          </div>

          <p className="text-[11px] text-[#a8b6c9]">
            TradingView quotes can be delayed and may differ from your broker marks. This external widget does not execute trades or provide live private broker portfolios.
          </p>
        </div>
      )}
    </div>
  );
};

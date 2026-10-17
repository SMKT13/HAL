/**
 * Technical analysis, Option Greeks risk, and Scenario modelling for HAL.
 */

import { isFiniteNumber, validDate, putPrice } from './portfolio';

export interface Candle {
  d?: string;
  t?: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export const DAY = 86400000;

export function istDate(t: number = Date.now()): string {
  return new Date(t + 19800000).toISOString().slice(0, 10);
}

export function expiryTime(d: string): number {
  return validDate(d) ? Date.parse(d + 'T15:30:00+05:30') : NaN;
}

export function daysLeft(d: string, now: number = Date.now()): number {
  return (expiryTime(d) - now) / DAY;
}

export function mean(a: number[]): number | null {
  if (!a.length) return null;
  return a.reduce((sum, val) => sum + val, 0) / a.length;
}

export function calculateSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => (i < period - 1 ? null : mean(data.slice(i - period + 1, i + 1))));
}

export function calculateEMA(data: number[], period: number): (number | null)[] {
  const out: (number | null)[] = data.map(() => null);
  let e: number | null = null;
  let window: number[] = [];
  const k = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (!isFiniteNumber(data[i])) {
      window = [];
      e = null;
      continue;
    }
    if (e === null) {
      window.push(data[i]);
      if (window.length === period) {
        e = mean(window)!;
        out[i] = e;
      }
    } else {
      e = data[i] * k + e * (1 - k);
      out[i] = e;
    }
  }
  return out;
}

export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const out: (number | null)[] = data.map(() => null);
  if (data.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;

  const getRSI = (g: number, l: number) => {
    if (g === 0 && l === 0) return 50;
    if (l === 0) return 100;
    return 100 - 100 / (1 + g / l);
  };

  out[period] = getRSI(gain, loss);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gain = (gain * (period - 1) + Math.max(0, diff)) / period;
    loss = (loss * (period - 1) + Math.max(0, -diff)) / period;
    out[i] = getRSI(gain, loss);
  }
  return out;
}

export function calculateATR(rows: Candle[], period: number = 14): number | null {
  if (rows.length <= period) return null;
  const tr: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    tr.push(Math.max(curr.h - curr.l, Math.abs(curr.h - prev.c), Math.abs(curr.l - prev.c)));
  }
  let atr = mean(tr.slice(0, period))!;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return atr;
}

export function calculateTechnicals(candles: Candle[]) {
  if (!candles || candles.length < 2) return null;
  const closes = candles.map((c) => c.c);
  const n = closes.length;
  const last = candles[n - 1];

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = closes.map((_, i) =>
    isFiniteNumber(ema12[i]) && isFiniteNumber(ema26[i]) ? ema12[i]! - ema26[i]! : null
  );
  const validMacd = macd.map((v) => (v === null ? 0 : v));
  const signal = calculateEMA(validMacd, 9);
  const hist =
    isFiniteNumber(macd[n - 1]) && isFiniteNumber(signal[n - 1])
      ? macd[n - 1]! - signal[n - 1]!
      : null;

  const rsi = calculateRSI(closes, 14);

  // Bollinger bands (20)
  const slice20 = closes.slice(-20);
  const bbMean = mean(slice20) ?? last.c;
  const sd =
    n >= 20 ? Math.sqrt(mean(slice20.map((x) => (x - bbMean) ** 2)) ?? 0) : null;
  const bbLow = sd !== null ? bbMean - 2 * sd : null;
  const bbHigh = sd !== null ? bbMean + 2 * sd : null;

  // Realized Volatility (20-day annualized)
  const returns: number[] = [];
  for (let i = n - 20; i < n; i++) {
    if (i > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const retMean = mean(returns) ?? 0;
  const vol =
    returns.length === 20
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + (r - retMean) ** 2, 0) / 19
        ) *
        Math.sqrt(252) *
        100
      : null;

  // Pivot, Support, Resistance
  const p = (last.h + last.l + last.c) / 3;
  const s1 = 2 * p - last.h;
  const r1 = 2 * p - last.l;
  const s2 = p - (last.h - last.l);
  const r2 = p + (last.h - last.l);

  return {
    last,
    sma20: sma20[n - 1],
    sma50: sma50[n - 1],
    sma200: sma200[n - 1],
    rsi: rsi[n - 1],
    macd: macd[n - 1],
    signal: signal[n - 1],
    hist,
    atr: calculateATR(candles, 14),
    bbLow,
    bbHigh,
    vol,
    pivot: p,
    s1,
    r1,
    s2,
    r2,
    series: {
      sma20,
      sma50,
      sma200,
      rsi,
      macd,
      signal
    }
  };
}

export interface JournalRecord {
  id: string;
  kind: 'close' | 'fee' | 'settlement';
  date: string;
  note?: string;
  amount?: number;
  leg?: {
    type: 'FUT' | 'PE';
    expiry: string;
    lots: number;
    lotSize: number;
    entry: number;
    strike?: number | null;
  };
  exit?: number;
  fees?: number;
}

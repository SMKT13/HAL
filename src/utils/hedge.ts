/**
 * Protective-put comparisons and hedge screening engine for HAL.
 */

import { putPrice, isFiniteNumber } from './portfolio';
import { expiryTime, DAY } from './analytics';

export interface HedgeSettings {
  budget: number;
  maxLoss: number;
  protectThrough: string;
  buyFees: number;
  exitFees: number;
  slippage: number;
  maxSpread: number;
  ivShift: number;
  rate: number;
  dividend: number;
}

export const defaultHedgeSettings: HedgeSettings = {
  budget: 50000,
  maxLoss: 100000,
  protectThrough: '2026-10-27',
  buyFees: 200,
  exitFees: 100,
  slippage: 0.5,
  maxSpread: 10,
  ivShift: 0,
  rate: 6,
  dividend: 0
};

export interface OptionQuoteItem {
  strike: number;
  expiry: string;
  ltp: number;
  bid: number;
  ask: number;
  oi: number;
  volume: number;
  iv: number;
  delta: number;
  theta: number;
  lotSize: number;
}

export interface HedgeCandidate {
  id: string;
  expiry: string;
  strike: number;
  lots: number;
  lotSize: number;
  units: number;
  grossCost: number;
  premium: number;
  netOutlay: number;
  exitFees: number;
  stressLoss: number;
  scenarios: {
    time: number;
    label: string;
    values: { shock: number; price: number; pnl: number }[];
  }[];
  limits: string[];
  expiryGap: boolean;
  iv: number;
  delta: number;
  theta: number;
  spread: number;
  badges: string[];
}

export function compareHedges(
  futureUnits: number,
  spot: number,
  options: OptionQuoteItem[],
  settings: HedgeSettings,
  now: number = Date.now()
): {
  candidates: HedgeCandidate[];
  shortlist: HedgeCandidate[];
  excluded: { expiry: string; strike: number; reasons: string[] }[];
} {
  const s = { ...defaultHedgeSettings, ...settings };
  const slip = s.slippage / 100;
  const candidates: HedgeCandidate[] = [];
  const excluded: { expiry: string; strike: number; reasons: string[] }[] = [];

  const shocks = [0, -3, -5, -10];
  const end = expiryTime(s.protectThrough);

  for (const o of options) {
    const reasons: string[] = [];
    if (o.lotSize <= 0 || futureUnits % o.lotSize !== 0) {
      reasons.push('Whole put lots cannot match futures units exactly');
    }
    const spread =
      o.ask > 0 && o.bid > 0
        ? ((o.ask - o.bid) / ((o.ask + o.bid) / 2)) * 100
        : 100;
    if (spread > s.maxSpread) {
      reasons.push(`Bid/ask spread (${spread.toFixed(1)}%) exceeds limit (${s.maxSpread}%)`);
    }
    if (o.iv <= 0 || o.iv + s.ivShift <= 0) {
      reasons.push('Valid IV unavailable for model');
    }

    if (reasons.length) {
      excluded.push({ expiry: o.expiry, strike: o.strike, reasons });
      continue;
    }

    const premium = o.ask * (1 + slip) * futureUnits;
    const grossCost = premium + s.buyFees;
    const lots = futureUnits / o.lotSize;

    // Evaluate stress scenarios across time and spot shocks
    const gridTimes = [
      { time: now, label: 'Now' },
      { time: now + (end - now) / 2, label: 'Midpoint' },
      { time: end, label: 'Protection date' }
    ];

    const scenarios = gridTimes.map((g) => ({
      time: g.time,
      label: g.label,
      values: shocks.map((shock) => {
        const scenarioSpot = spot * (1 + shock / 100);
        const futChange = (scenarioSpot - spot) * futureUnits;
        const yearsRemaining = Math.max(0, (expiryTime(o.expiry) - g.time) / DAY / 365);
        const scenarioPutVal = putPrice(
          scenarioSpot,
          o.strike,
          yearsRemaining,
          s.rate / 100,
          (o.iv + s.ivShift) / 100,
          s.dividend / 100
        );
        const pnl = futChange + scenarioPutVal * futureUnits - grossCost;
        return { shock, price: scenarioSpot, pnl };
      })
    }));

    const minScenarioPnl = Math.min(...scenarios.flatMap((g) => g.values.map((v) => v.pnl)));
    const stressLoss = Math.max(0, -minScenarioPnl);

    const limits: string[] = [];
    if (grossCost > s.budget) limits.push('Above new-hedge budget');
    if (stressLoss > s.maxLoss) limits.push('Above loss limit in sampled scenarios');

    candidates.push({
      id: `${o.expiry}:${o.strike}`,
      expiry: o.expiry,
      strike: o.strike,
      lots,
      lotSize: o.lotSize,
      units: futureUnits,
      grossCost,
      premium,
      netOutlay: grossCost,
      exitFees: s.exitFees,
      stressLoss,
      scenarios,
      limits,
      expiryGap: o.expiry < s.protectThrough,
      iv: o.iv,
      delta: o.delta,
      theta: o.theta,
      spread,
      badges: []
    });
  }

  // Sort candidates
  const tie = (a: HedgeCandidate, b: HedgeCandidate) =>
    a.grossCost - b.grossCost || a.spread - b.spread || a.strike - b.strike;

  candidates.sort(tie);

  const eligible = candidates.filter((c) => c.limits.length === 0);
  const shortlist: HedgeCandidate[] = [];

  if (eligible.length > 0) {
    const minCost = Math.min(...eligible.map((c) => c.grossCost));
    const maxCost = Math.max(...eligible.map((c) => c.grossCost));
    const minLoss = Math.min(...eligible.map((c) => c.stressLoss));
    const maxLoss = Math.max(...eligible.map((c) => c.stressLoss));

    const balance = (c: HedgeCandidate) =>
      ((c.grossCost - minCost) / (maxCost - minCost || 1)) ** 2 +
      ((c.stressLoss - minLoss) / (maxLoss - minLoss || 1)) ** 2;

    const lowerCost = [...eligible].sort(tie)[0];
    const balanced = [...eligible].sort((a, b) => balance(a) - balance(b) || tie(a, b))[0];
    const stronger = [...eligible].sort((a, b) => a.stressLoss - b.stressLoss || tie(a, b))[0];

    if (lowerCost && !lowerCost.badges.includes('Lower cost')) lowerCost.badges.push('Lower cost');
    if (balanced && !balanced.badges.includes('Balanced')) balanced.badges.push('Balanced');
    if (stronger && !stronger.badges.includes('Stronger protection')) stronger.badges.push('Stronger protection');

    for (const c of [lowerCost, balanced, stronger]) {
      if (c && !shortlist.some((item) => item.id === c.id)) {
        shortlist.push(c);
      }
    }
  }

  return { candidates, shortlist, excluded };
}

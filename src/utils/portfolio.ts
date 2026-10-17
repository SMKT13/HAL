/**
 * Pure, dependency-free HAL Portfolio and Options valuation calculations.
 */

export interface PositionLeg {
  key: 'f' | 'p1' | 'p2';
  qty: number;
  average: number;
  expiry: string;
  expired: boolean;
  days: number | null;
  mark: number | null;
  source: string;
  markedAt: string | null;
  pnl: number | null;
}

export interface PositionState {
  fq: number;
  fa: number;
  fexpiry: string;
  fmark: number | null;
  fmarkAt: string | null;
  p1q: number;
  p1a: number;
  p1strike: number;
  p1iv: number;
  p1expiry: string;
  p1mark: number | null;
  p1markAt: string | null;
  p2q: number;
  p2a: number;
  p2strike: number;
  p2iv: number;
  p2expiry: string;
  p2mark: number | null;
  p2markAt: string | null;
  realized: number;
  costs: number;
  rate: number;
  dividend: number;
  lot: number;
}

export const defaultPosition: PositionState = {
  fq: 300,
  fa: 5124.9,
  fexpiry: '2026-10-27',
  fmark: null,
  fmarkAt: null,
  p1q: 150,
  p1a: 57.4,
  p1strike: 4500,
  p1iv: 24.8,
  p1expiry: '2026-10-27',
  p1mark: null,
  p1markAt: null,
  p2q: 150,
  p2a: 24.1,
  p2strike: 4300,
  p2iv: 28.7,
  p2expiry: '2026-10-27',
  p2mark: null,
  p2markAt: null,
  realized: -7011,
  costs: 0,
  rate: 6.5,
  dividend: 0,
  lot: 150
};

export const isFiniteNumber = (val: any): val is number =>
  typeof val === 'number' && Number.isFinite(val);

export function validDate(value: any): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function validate(p: PositionState): string {
  for (const key of Object.keys(defaultPosition) as (keyof PositionState)[]) {
    const value = p[key];
    if (key.endsWith('expiry')) {
      if (!validDate(value)) return 'Enter a valid expiry date for each contract.';
    } else if (key.endsWith('At')) {
      if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
        return 'Invalid broker-mark timestamp.';
      }
    } else if (key.endsWith('mark') && value === null) {
      continue;
    } else if (!isFiniteNumber(value) || (key !== 'realized' && (value as number) < 0)) {
      return 'Enter finite, non-negative numbers; realized P&L may be negative.';
    }
  }

  if (
    !Number.isInteger(p.fq) ||
    !Number.isInteger(p.p1q) ||
    !Number.isInteger(p.p2q) ||
    !Number.isInteger(p.lot) ||
    p.lot < 1
  ) {
    return 'Quantities and lot size must be whole units; lot size must be positive.';
  }

  if (p.p1strike <= 0 || p.p2strike <= 0) return 'Put strikes must be positive.';
  if (p.p1iv > 500 || p.p2iv > 500 || p.rate > 100 || p.dividend > 100) {
    return 'Check the IV, interest-rate and dividend-yield percentages.';
  }

  return '';
}

export function normalize(saved: any = {}): PositionState {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return { ...defaultPosition };
  }
  const p = { ...defaultPosition };
  for (const key of Object.keys(defaultPosition) as (keyof PositionState)[]) {
    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      (p as any)[key] = saved[key];
    }
  }
  const error = validate(p);
  if (error) {
    console.warn('Position validation error:', error);
    return { ...defaultPosition };
  }
  return p;
}

export function normalCDF(x: number): number {
  if (x === 0) return 0.5;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - tail : tail;
}

export function putPrice(
  spot: number,
  strike: number,
  years: number,
  rate: number,
  iv: number,
  dividend = 0
): number {
  if (
    ![spot, strike, years, rate, iv, dividend].every(isFiniteNumber) ||
    spot <= 0 ||
    strike <= 0 ||
    iv < 0
  ) {
    throw new Error('Invalid option-model inputs.');
  }
  if (years <= 0) return Math.max(strike - spot, 0);
  if (iv === 0) {
    return Math.max(
      strike * Math.exp(-rate * years) - spot * Math.exp(-dividend * years),
      0
    );
  }
  const d1 =
    (Math.log(spot / strike) + (rate - dividend + (iv * iv) / 2) * years) /
    (iv * Math.sqrt(years));
  const d2 = d1 - iv * Math.sqrt(years);
  return Math.max(
    0,
    strike * Math.exp(-rate * years) * normalCDF(-d2) -
      spot * Math.exp(-dividend * years) * normalCDF(-d1)
  );
}

export function daysBetween(date: string, expiry: string): number {
  return (Date.parse(expiry) - Date.parse(date)) / 86400000;
}

export function markBook(
  p: PositionState,
  spot: number | null | undefined,
  asOfDate?: string | null,
  today = todayIST()
) {
  const error = validate(p);
  if (error) throw new Error(error);
  const validSpot =
    isFiniteNumber(spot) && spot > 0 && asOfDate && validDate(asOfDate);

  const legs: PositionLeg[] = (['f', 'p1', 'p2'] as const).map((key) => {
    const qty = p[`${key}q` as keyof PositionState] as number;
    const average = p[`${key}a` as keyof PositionState] as number;
    const expiry = p[`${key}expiry` as keyof PositionState] as string;
    const days = validSpot ? daysBetween(asOfDate!, expiry) : null;
    const expired = expiry <= today;
    const manual = p[`${key}mark` as keyof PositionState] as number | null;

    let mark = manual;
    let source = 'Broker mark (manual)';
    if (manual === null) {
      source = expired
        ? 'Expiry reached — enter broker/settlement mark'
        : 'Model estimate';
      if (validSpot && !expired && days !== null && days > 0) {
        const years = days / 365;
        mark =
          key === 'f'
            ? spot! * Math.exp(((p.rate - p.dividend) / 100) * years)
            : putPrice(
                spot!,
                p[`${key}strike` as keyof PositionState] as number,
                years,
                p.rate / 100,
                (p[`${key}iv` as keyof PositionState] as number) / 100,
                p.dividend / 100
              );
      }
    }

    return {
      key,
      qty,
      average,
      expiry,
      expired,
      days,
      mark,
      source,
      markedAt: p[`${key}markAt` as keyof PositionState] as string | null,
      pnl:
        qty === 0
          ? 0
          : mark === null
          ? null
          : (mark - average) * qty
    };
  });

  const open = legs.some((l) => l.pnl === null)
    ? null
    : legs.reduce((sum, l) => sum + (l.pnl || 0), 0);

  return {
    legs,
    open,
    total: open === null ? null : open + p.realized - p.costs
  };
}

export function expiryPayoff(p: PositionState, spot: number) {
  if (!isFiniteNumber(spot) || spot < 0) throw new Error('Invalid scenario price.');
  const active = (['f', 'p1', 'p2'] as const).filter(
    (key) => (p[`${key}q` as keyof PositionState] as number) > 0
  );
  if (
    new Set(
      active.map((key) => p[`${key}expiry` as keyof PositionState] as string)
    ).size > 1
  ) {
    return null;
  }

  const futures = p.fq * (spot - p.fa);
  const puts = (['p1', 'p2'] as const).reduce(
    (sum, key) =>
      sum +
      (p[`${key}q` as keyof PositionState] as number) *
        (Math.max(
          (p[`${key}strike` as keyof PositionState] as number) - spot,
          0
        ) -
          (p[`${key}a` as keyof PositionState] as number)),
    0
  );
  const open = futures + puts;
  return { futures, puts, open, total: open + p.realized - p.costs };
}

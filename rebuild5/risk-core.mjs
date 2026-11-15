// HAL Desk 5 — independent deterministic portfolio scenario primitives.
// No broker I/O, no Fincept source code, no order placement.
// Inputs use INR/share and share quantities; percentages are decimals.
export function validateLeg(leg) {
  if (!leg || !["FUT","PE","CE"].includes(leg.type)) throw Error("unsupported leg");
  if (!Number.isInteger(leg.quantity) || leg.quantity <= 0) throw Error("invalid quantity");
  if (!Number.isFinite(leg.entry) || leg.entry < 0) throw Error("invalid entry");
  if (leg.type !== "FUT" && (!Number.isFinite(leg.strike) || leg.strike <= 0)) throw Error("invalid strike");
  if (typeof leg.expiry !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(leg.expiry) ||
      !Number.isFinite(Date.parse(leg.expiry + "T00:00:00Z")) ||
      new Date(leg.expiry + "T00:00:00Z").toISOString().slice(0,10) !== leg.expiry)
    throw Error("invalid expiry");
  if (!["long","short"].includes(leg.side)) throw Error("invalid side");
  return leg;
}
export function intrinsic(type, strike, spot) {
  if (!Number.isFinite(spot) || spot < 0) throw Error("invalid spot");
  if (!Number.isFinite(strike) || strike <= 0) throw Error("invalid strike");
  if (type === "PE") return Math.max(strike - spot, 0);
  if (type === "CE") return Math.max(spot - strike, 0);
  throw Error("invalid option type");
}
export function expiryPayoff(legs, spot, asOfExpiry) {
  if (!Array.isArray(legs) || !legs.length) throw Error("no legs");
  if (!Number.isFinite(spot) || spot < 0) throw Error("invalid spot");
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(asOfExpiry || "")) throw Error("invalid date");
  let pnl = 0;
  for (const raw of legs) {
    const leg = validateLeg(raw);
    if (leg.expiry !== asOfExpiry) throw Error("mixed expiry: use dated mark-to-model scenarios");
    const value = leg.type === "FUT" ? spot : intrinsic(leg.type,leg.strike,spot);
    pnl += (leg.side === "long" ? 1 : -1) * leg.quantity * (value - leg.entry);
  }
  return pnl;
}
export function protectionCoverage(legs, throughDate) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(throughDate || "")) throw Error("invalid date");
  let futures = 0, puts = 0;
  for (const raw of legs) {
    const leg = validateLeg(raw);
    if (leg.type === "FUT" && leg.side === "long" && leg.expiry >= throughDate) futures += leg.quantity;
    if (leg.type === "PE" && leg.side === "long" && leg.expiry >= throughDate) puts += leg.quantity;
  }
  return {futures, puts, covered: Math.min(futures, puts), uncovered: Math.max(0,futures-puts),
    ratio: futures ? Math.min(1,puts/futures) : null};
}
export function incrementalRisk({currentMarks,scenarioMarks,quantities,sides}) {
  if (![currentMarks,scenarioMarks,quantities,sides].every(Array.isArray) ||
      !currentMarks.length || ![scenarioMarks,quantities,sides].every(x=>x.length===currentMarks.length))
    throw Error("invalid marks");
  return currentMarks.reduce((sum,mark,i)=>{
    if (![mark,scenarioMarks[i]].every(x=>typeof x==="number" && Number.isFinite(x) && x>=0) ||
        !Number.isInteger(quantities[i]) || quantities[i]<=0 ||
        !["long","short"].includes(sides[i])) throw Error("missing or invalid mark");
    return sum+(sides[i]==="long"?1:-1)*quantities[i]*(scenarioMarks[i]-mark);
  },0);
}

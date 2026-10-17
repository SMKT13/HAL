// The React desk and Android app execute the same regression-tested calculations.
import "../../android/app/src/main/assets/core.js";
import "../../android/app/src/main/assets/analytics.js";
import "../../android/app/src/main/assets/hedge.js";
export const C = (globalThis as any).HALCore;
export const A = (globalThis as any).HALAnalytics;
export const H = (globalThis as any).HALHedge;

// Preserve the existing web viewer calculations independently of Android 4.x.
import "../../web-engine/core.js";
import "../../web-engine/analytics.js";
import "../../web-engine/hedge.js";
export const C = (globalThis as any).HALCore;
export const A = (globalThis as any).HALAnalytics;
export const H = (globalThis as any).HALHedge;

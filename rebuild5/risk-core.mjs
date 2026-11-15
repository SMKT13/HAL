// Compatibility re-export. Android risk5.js is the single source of truth.
import core from '../android/app/src/main/assets/risk5.js';
export const {validDate,validateLeg,intrinsic,expiryPayoff,protectionCoverage,protectionTimeline,settlementScenario,incrementalRisk}=core;

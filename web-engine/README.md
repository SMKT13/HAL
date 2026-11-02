# Existing web viewer calculations

These three modules are preserved byte-for-byte from HAL Desk 3.3 commit `76a041dc1302164bef227a2dfdf669ae5b2fa7e4`: `core.js`, `analytics.js` and `hedge.js`. The React viewer imports them through `src/utils/engine.ts`.

They were moved out of the old Android asset directory so Android 4.0.2 can use its independently tested `engine4.js` without changing the existing web viewer. The accompanying tests have only their module paths adjusted. Run `npm run test:web-engine` from the repository root.

The web viewer retains its earlier schema-2 behavior. This directory is not bundled into the Android APK.

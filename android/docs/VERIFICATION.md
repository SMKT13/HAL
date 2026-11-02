# HAL Desk 4.0.2 — protective-put mark fix

Verified 2 November 2026. Signed with the existing HAL identity; package `in.smkt.haldesk`, versionName **4.0.2**, versionCode **20**. Compared with the delivered 4.0.1 APK, code 19. Minimum API 26, target API 35.

## Reported issue and reproduced cause

The user reported both protective-put marks unavailable in My Position with “Exact listed contract unavailable,” while Research displayed the option chain.

A confirmed Android-specific bug can produce this exact symptom. Manually entered legs have no saved instrument key. The JavaScript bridge sent `instrument_key: null`; Android's JSONObject.optString coerced this to the literal string `"null"`. Native verification compared that string with the provider's contract key and incorrectly returned `instrument_key_mismatch`. The portfolio adapter then removed every listed contract for that expiry/strike, so a valid chain quote vanished from portfolio valuation.

A regression against the unpatched code failed on both Robolectric API 26 and API 35 with the incorrect mismatch result. A separate data-adapter reproduction changed the same synthetic put mark from 50 to unavailable after the failed verification. Those pre-fix results are retained under `verification/reproduce-null-key.*`. The earlier desktop provider tests used a different JSONObject implementation and did not exercise this Android null-key path.

This reproduces the symptom, but the user's actual phone records and authenticated requests were not inspected. A genuine saved expiry/strike/key/lot mismatch remains possible for any individual leg.

## Changes

- Native contract matching now handles an absent or JSON-null key explicitly. The bridge also omits unset keys.
- A key mismatch for one saved leg no longer deletes a valid listed contract from the entire portfolio's market-data view. Real saved-key mismatches still fail exact matching.
- Match exact expiry, strike, type, HAL underlying and verified lot size. An explicit key selects its matching contract; ambiguous metadata is rejected instead of choosing the first result.
- Keep actual missing-contract, wrong-date, wrong-strike and wrong-lot outcomes unavailable. No guessed prices or automatic changes to recorded trades.
- Show saved versus provider-listed expiry and lot metadata beside an unavailable position, with instructions to review the listed-contract selector.
- Reset an obsolete Research expiry selection after new metadata, avoid starting with an expired cached selection, and display chain request failures in the chain card.
- Keep package, schema, database, WebView origin, credentials and signing identity unchanged. No new positions or fixture holdings are inserted.

## Verification

| Check | Result |
|---|---:|
| Calculation, evidence, cache and data tests | **153 passed; zero failures/skips** |
| Android native/framework tests | **57 passed; zero failures/skips** |
| Browser integration checks | **28 passed** |
| Mocked Gemini assertions | **219 passed** |
| Android lint | **0 errors; 3 reviewed warnings** |
| APK assembly | Passed |
| Original certificate comparison | Passed against 4.0.1 |
| v2/v3 APK signatures | Verified |
| ZIP and 64-bit ELF load alignment | Passed 16 KB checks |
| Packaged UI assets against tested source | Exact byte match |

The 10 new native test cases (five methods on each of API 26 and 35) cover Android JSON null coercion, absent keys for both 4500 and 4400 synthetic puts, immutable input records, real date/strike/key/lot mismatches, ambiguous contracts, explicit key selection and malformed keys. Four new data tests cover cached failures, valid quote preservation and strict mismatches. Three new UI checks cover both protective puts, bridge key omission, incorrect-expiry explanations and Research expiry/error handling.

The three lint warnings are unchanged and reviewed: deliberate synchronous credential persistence, an API-33 back-navigation attribute ignored on older Android, and JavaScript enabled only for the isolated local UI. No live broker account or paid AI request was used in tests.

Certificate SHA-256: `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`

APK SHA-256: `0b3421a9921fecb9a798ae302304ff7db6575b8de088e830197b0ca1ec2ebeab`

APK size: 31644819 bytes.

## Install and verify on the phone

1. Export the current JSON book backup.
2. Open `HAL-Desk-v4.0.2-signed.apk` and choose **Update**. Do not uninstall or clear app storage.
3. Open **My Position → Book → Verify contracts**, then refresh market data. Let the foreground requests complete.
4. Confirm that each put's exact expiry, strike and lot size match your broker contract. If a mark remains unavailable, the position now shows the saved date and any same-strike provider-listed dates. Use **Edit / manual mark → Fill from listed contract** only after reviewing the intended contract; preserve the actual entry premium and lot count.

The patch does not overwrite entries, holdings, journal history or manual marks. JSON-null and absent-key positions resolve from verified metadata; an intentionally manual mark remains manual until the user clears it.

## Remaining limits

No physical phone or emulator installation was available. Robolectric API 26/35 tests are Android framework simulations. A real-device upgrade, the particular phone's Keystore contents, and authenticated Upstox/Gemini calls remain unverified.

Provider Greek timestamps and theta-unit provenance can still be incomplete. This affects aggregate Greeks and strict hedge rankings, not display of a correctly matched REST put mark. Option-chain REST refresh remains separate from the foreground spot/futures/index stream preview.

FinBERT actual download/inference and mobile performance were not exercised. Model pricing remains an estimate; earlier-expiry puts are temporary protection. Background monitoring is not guaranteed. Prior release scope and documented provider restrictions remain in `docs/API-CAPABILITIES.md`.

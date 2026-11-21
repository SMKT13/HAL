# HAL Atlas AI Desk 5.4 — implementation audit (21 Nov 2026)

## Branch and rollback boundaries
- Development-only branch: `feature/hal-atlas-ai-desk-5.4.0`
- Based on `rebuild/hal-atlas-5.3.0` at `651146da203d9108d60a9728d07ee3546a66459b`.
- Keep `main`, `rebuild/hal-atlas-5.3.0`, and `restore/hal-atlas-5.3.0` untouched.
- Existing build identity remains `in.smkt.haldesk`, 5.3.0, versionCode 59 **while changes are under development**. Assign a strictly higher code for the first release candidate after full verification.
- The source branch is NOT a replacement for the pinned 5.3.0 restore APK/source. Do not install this work as a downgraded replacement or clear device storage.

## Implemented in this branch (development slice)
1. Added `ai-intelligence5.js` as a pure local classification, smart-evidence and priority module. Source is included before `ui4.js` by the asset builder.
2. Added adaptive Daily Brief with Market, Position/Hedge, Recovery, News, What Changed and Next Review entry points.
3. Split AI Desk internal navigation into Brief, Ask Atlas, Deep Research, while retaining legacy finance engines and native key settings.
4. Smart context selection excludes private portfolio evidence from market-only/research questions even when the source packet contains saved positions. A comprehensive Daily Brief can include approved financial context.
5. Connected the existing six-role `AgentDesk` to Android's actual Gemini request path, with stage-progress events, six-request consent disclosure and source schema alignment.
6. Preserved role summaries through bounded sanitization so Bull, Bear and Risk Chair stages can consider earlier analysts.
7. Added a separate AndroidKeyStore AES-GCM encrypted AI history store. Ordinary saved reports expire after 90 days; pinned reports remain until manual deletion. Includes native bridge methods and history read/pin/delete/clear UI.
8. Added independent test inputs for JS context/privacy/priority and Java 90-day retention policy, with native test-script registration.
9. Added encrypted conversation IDs, opt-in follow-up context, native revision-scope filtering, and an exact-payload equality check before Android sends approved previous turns.
10. Corrected 90-day expiry to apply to the last activity of an ordinary conversation rather than deleting individual turns mid-discussion. Removed silent record truncation on storage limits.
11. Added a structured Gemini response schema for Brief and Ask Atlas (not the six short role calls), validation of required sections and citations against the approved source URLs, plus sectioned screen rendering.
12. Added a manually triggered read-only model metadata check. It does not generate text, use portfolio evidence, or silently switch model IDs.
13. Fixed the 'fresh' versus 'current' quote-status mismatch; added cautious, labeled calendar-day expiry review when a verified NSE session count is not provided.
14. Added private `NativeAiDeskActivity` (Compose) with Brief, Ask Atlas, Deep Research and expandable encrypted history. The native gateway launches the original consent-protected WebView AI analysis instead of creating a second unverified AI calculation engine.
15. Registered a validated native-to-WebView AI route and a native-terminal entry point. `main` and restore branches were not changed.
16. Corrected adaptive priority precedence so an imminent verified expiry cannot be hidden by a lower-priority coverage gap; clarified that invalid market quotes are not current prices.
17. Carried the application-owned recovery-completeness caution safely through native evidence sanitization without trusting arbitrary user text.
18. Added a configurable, conservative local AI request allowance (default 20 reservations per IST day, 1–60 configurable), six-call reservation for Deep Research, and a clear distinction from actual Google billing limits.
19. Added JS native-integration guard tests, additional priority tests, and a Robolectric test for daily request limits and India-calendar midnight reset.

## Checks executed in the assistant tool runtime
- Parsed `ui4.js` and `ai-intelligence5.js` with a JavaScript parser: no syntax errors.
- Executed the **18 focused JavaScript tests** (15 priority/privacy tests and 3 native-integration guard tests) in an isolated tool runtime: 18 passed.
- Parsed `ui4.js`, `ai-intelligence5.js`, `ai-intelligence5.test.js`, and `scripts/build-assets.js` successfully.
- Passed 10 earlier structural wiring checks covering build order, native opt-in context, six-agent invocation, schema and model probe connections.
- Reviewed the new branch files via the connected GitHub repository.

## Not yet proven or incomplete
- No full `npm test`, `npm run assets`, Gradle, Robolectric, Android lint, APK build, signing, or device run was performed in this environment. Do not interpret checked-in tests as passing.
- A native Compose AI gateway is implemented, including encrypted-history viewing and launch into the full desk; native in-screen Gemini chat and verified live market data parity remain incomplete.
- Initial threaded follow-ups are wired through saved conversation IDs, with up to eight bounded, consented, revision-matched previous exchanges. A polished full chat transcript and message search UX remain incomplete.
- Structured response format, field bounds, and source URL validation are implemented; independent claim-level numerical verification is **not** complete. Gemini should never be trusted as the source of position P&L.
- Exact NSE trading-session expiry counting is not connected; the priority engine accepts a verified count but does not invent one.
- Live model metadata verification is available on demand, but remains untested with a real API key. A conservative local request allowance has been implemented; accurate provider billing/quota telemetry, optional search grounding, and robust report export remain incomplete.
- A database upgrade rehearsal against the user's signed installation and a live API verification are outstanding.
- Restore baseline requires an independently retained original-key-signed APK; this branch has not replaced it.

## Safety boundaries maintained
- No order execution, broker writes or fund transfers were introduced.
- No changes to SQLite/Room transaction schema or legacy financial-book migrations.
- AI remains an interpretation layer over existing deterministic financial engines.
- History ciphertext is kept in separate private preferences with a separate Keystore alias; no plaintext financial history is intentionally persisted in app preferences.
- All Gemini calls require the existing explicit evidence consent workflow.

## Next implementation gates
1. Run full offline asset/JS and Java/Android test suites, resolve regressions.
2. Complete conversation transcript and safe resumable-thread UX, building on revision-scoped opt-in history.
3. Test the structured Gemini API contract live; add independent numerical-claim checks and ensure reports remain usable when a provider cannot support JSON output.
4. Complete native Compose UX, conversation-history search, provider usage telemetry and cross-screen consistency.
5. Rehearse signed data-preserving installation from 5.3.0 on a backed-up Android device.
6. Only then prepare a versionCode >59 candidate and request separate merge/release approval.

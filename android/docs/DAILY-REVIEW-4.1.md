# HAL Desk 4.1 daily review

The daily workflow is Today → My Position → Plan. Today shows the combined open
P&L, a prioritized review action, changes since the previous visit and a relevant
headline. Contract details, source clocks, market context and advanced planning
inputs remain available on demand.

## Review comparisons

The first complete, fresh, non-manual valuation seen on Today is saved as an
automatic review. Every required contract needs current quote and trade times.
Cached, failed, future-dated or incomplete observations cannot advance it.
The previous review stays fixed for the visit; refreshes do not overwrite the
comparison baseline. A new app launch or return after at least five minutes away
starts a new visit. Explicit checkpoints remain available.

Automatic reviews use the checksummed native cache key `snapshot:review` (or
`hal_review_v4` in a browser). They do not increment the portfolio revision or
replace its previous-book recovery copy, and are not included in book exports.
A missing cache only resets the automatic comparison. Changed books suppress
like-for-like P&L deltas. Comparisons describe observations, not news causality.

## Planning and protection

- My Position explains combined futures units, put quantities, entry premium,
  protection expiry and remaining uncovered quantity. Quantity is not a loss floor.
- What if? starts with a 5% fall, the first active put expiry or unchanged spot.
  Missing IV is explicitly requested; no default volatility is invented.
- Compare keeps current exposure beside a hypothetical whole-lot futures
  reduction at the same price, date and model assumptions. It shows additional
  P&L from current marks, deducts the entered exit cost once, and retains existing
  puts. A reduction can leave excess put exposure. Holdings and journals never
  change when comparing.
- Find a Hedge retains the listed-contract, exact-quantity and liquidity gates.
  Its current-versus-replacement comparison remains the way to compare new puts.
- Input edits or data updates invalidate displayed calculations.

## Business evidence and AI

Business groups headlines and user-entered notes under Order book, Deliveries &
execution, Revenue & margins and Cash conversion. Upcoming events come only from
explicit user-entered event dates. Topic matches do not establish trends or
verify user notes. Original financial statements and indicators remain accessible.

Explain actions prepare a contextual Gemini question. The existing exact-evidence
preview and explicit consent are required before sending. Headline explanations
exclude portfolio data and do not claim the full source article was read.
Private note text and journal memos remain outside AI evidence.

## Validation and distribution

`npm test` includes deterministic workflow regressions. `npm run test:ui` covers
new and existing flows with synthetic native callbacks at 320, 390 and 768 px in
both themes. CI rebuilds assets, checks their hashes, runs native tests/lint and
produces an unsigned 4.1.0 candidate (versionCode 21), plus UI screenshots.

Live provider access, physical-phone installation and private release signing
are separate from these synthetic checks. The original signing certificate is
still required to update an existing installation without removing its data.

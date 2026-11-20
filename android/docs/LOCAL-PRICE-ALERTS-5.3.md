# HAL Atlas 5.3 — local spot alerts

The native terminal configures optional price-above and price-below alerts for **HAL NSE cash equity only**. The existing foreground read-only Upstox refresh supplies the quote; no additional market call is made. Stale, missing or future exchange/trade timestamps and provider quality warnings suppress alerts. State is stored locally, preventing duplicate triggers from replayed observations; crossing back re-arms.

Alerts appear inside the open app only. There are **no background alarms, push notifications, WorkManager jobs or order placement**. This does not cover futures/options marks, and timing is not guaranteed. Full Android SDK and real-device validation remain required.

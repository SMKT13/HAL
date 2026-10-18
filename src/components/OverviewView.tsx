import React from "react";
import { A, C } from "../utils/engine";
import { money, number, when } from "../utils/api";
import { Panel, Metric, Notice } from "./UI";
import { useFreshnessClock } from "../utils/useFreshnessClock";
export function OverviewView({ market, snapshot, book, goAI, navigate }: any) {
  const now = useFreshnessClock(!!snapshot);
  const risk = A.risk(book.legs, snapshot, now),
    ledger = A.ledger(book, snapshot);
  const spot = snapshot?.spot?.last_price ?? market?.quote?.price,
    prev = snapshot?.spot?.prev_close ?? market?.quote?.prev_close;
  const change = spot && prev ? (spot / prev - 1) * 100 : null;
  const ind = market?.ind || {};
  return (
    <div className="view-stack">
      <div className="hero">
        <div>
          <p className="eyebrow">HINDUSTAN AERONAUTICS LIMITED</p>
          <h1>Clarity for your HAL book.</h1>
          <p className="muted">
            Market context, open exposure and the next decision to review.
          </p>
        </div>
        <button className="primary" onClick={() => goAI("copilot")}>
          Ask AI Copilot ↗
        </button>
      </div>
      <div className="metrics">
        <Metric
          label="HAL spot"
          value={money(spot)}
          note={
            change === null
              ? "Awaiting provider data"
              : number(change, 2) + "% vs previous close"
          }
        />
        <Metric
          label="Open P&L"
          value={money(ledger.open)}
          note={
            book.legs.length
              ? book.preferences.markMode === "bid"
                ? "Indicative bid marks"
                : "Exact-contract LTP / manual marks"
              : "No open positions"
          }
        />
        <Metric
          label="Net recorded P&L"
          value={money(ledger.net)}
          note="Open + realized − charges"
        />
        <Metric
          label="Put quantity coverage"
          value={risk.coverage === null ? "—" : number(risk.coverage) + "%"}
          note="Strikes and expiry determine protection"
        />
      </div>
      <div className="two-columns">
        <Panel
          title="Exposure & protection"
          action={
            <button onClick={() => navigate("positions")}>
              Open position desk →
            </button>
          }
        >
          <div className="metrics compact">
            <Metric label="Futures units" value={number(risk.futureUnits, 0)} />
            <Metric label="Put units" value={number(risk.putUnits, 0)} />
            <Metric label="Basket delta" value={number(risk.delta)} />
            <Metric label="Next expiry" value={risk.nextExpiry || "—"} />
          </div>
          {!book.legs.length && (
            <Notice>
              Your book is empty. Enter your actual holdings or import a backup
              in Settings.
            </Notice>
          )}
          {risk.warnings.map((w: any) => (
            <Notice key={w.title}>
              <b>{w.title}.</b> {w.detail}
            </Notice>
          ))}
          <p className="muted small">
            {C.freshness(snapshot, now)} · {when(snapshot?.spot?.quote_as_of)}
          </p>
        </Panel>
        <Panel
          title="Daily technical context"
          action={
            <button onClick={() => navigate("markets")}>View chart →</button>
          }
        >
          <div className="data-list">
            {[
              ["SMA 20", money(ind.sma20)],
              ["SMA 50", money(ind.sma50)],
              ["SMA 200", money(ind.sma200)],
              ["RSI 14", number(ind.rsi14)],
              ["MACD histogram", number(ind.macd_hist, 2)],
              ["ATR 14", money(ind.atr14)],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <p className="muted small">
            Completed session: {market?.indicator_session || "Unavailable"} ·{" "}
            {market?.source || "Daily data unavailable"}
          </p>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel title="NIFTY context">
          <div className="metrics compact">
            <Metric label="Index" value={number(market?.mkt?.price)} />
            <Metric
              label="HAL beta / 60 sessions"
              value={number(market?.mkt?.beta60, 2)}
            />
            <Metric
              label="Correlation"
              value={number(market?.mkt?.corr60, 2)}
            />
          </div>
          <p className="muted small">
            {market?.mkt
              ? "Computed from date-aligned provider returns. " +
                when(market.mkt.quote_as_of)
              : "Benchmark data unavailable."}
          </p>
        </Panel>
        <Panel title="Research workspace">
          <p className="muted">
            Keep financial disclosures, headlines and your thesis beside the
            position book.
          </p>
          <div className="actions">
            <button onClick={() => navigate("research")}>HAL research</button>
            <button onClick={() => navigate("news")}>Newsroom</button>
            <button onClick={() => goAI("deliberate")}>AI perspectives</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

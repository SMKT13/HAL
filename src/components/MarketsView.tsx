import React, { useState, useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { A } from "../utils/engine";
import { money, number, when } from "../utils/api";
import { Panel, Notice, Tabs, Metric, Link } from "./UI";
export function MarketsView({
  market,
  snapshot,
  fetchResearch,
  research,
}: any) {
  const [tab, setTab] = useState("chart"),
    [frame, setFrame] = useState("D"),
    [expiry, setExpiry] = useState(""),
    [chain, setChain] = useState<any>(null),
    [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const packet = research["candles:" + frame + ":consolidated"];
  useEffect(() => {
    let active = true;
    setError("");
    fetchResearch("candles", frame).catch(
      (e: any) => active && setError(e.message),
    );
    return () => {
      active = false;
    };
  }, [frame]);
  useEffect(() => {
    if (!expiry && snapshot?.option_expiry) setExpiry(snapshot.option_expiry);
  }, [snapshot?.option_expiry]);
  useEffect(() => {
    let active = true;
    if (!expiry) return;
    setChain(null);
    fetchResearch("chain", expiry)
      .then((r: any) => {
        if (active) setChain(r.data);
      })
      .catch((e: any) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [expiry, snapshot?.fetched_at_iso]);
  const raw = [
    ...(packet?.data?.history?.candles || []),
    ...(packet?.data?.intraday?.candles || []),
  ];
  const rows = raw.length
    ? A.candles(raw)
    : frame === "D"
      ? (market?.daily || []).map((r: any) => ({
          ...r,
          t: Date.parse(r.d + "T09:15:00+05:30"),
        }))
      : [];
  const tech = raw.length
    ? A.technicals(raw, frame, Date.now(), packet?.fetched_at_iso)
    : null;
  useEffect(() => {
    if (tab !== "chart" || !container.current) return;
    const el = container.current,
      style = getComputedStyle(document.documentElement);
    const chart = createChart(el, {
      height: 420,
      width: el.clientWidth,
      layout: {
        background: {
          type: ColorType.Solid,
          color: style.getPropertyValue("--card").trim(),
        },
        textColor: style.getPropertyValue("--mut").trim(),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: style.getPropertyValue("--line").trim() },
      },
      timeScale: { timeVisible: frame !== "D" },
      localization: {
        locale: "en-IN",
        timeFormatter: (t: any) =>
          frame === "D"
            ? String(t)
            : new Date(Number(t) * 1000).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }),
      },
    });
    const bars = chart.addCandlestickSeries({
      upColor: "#55cfa2",
      downColor: "#f68d8a",
      borderVisible: false,
      wickUpColor: "#55cfa2",
      wickDownColor: "#f68d8a",
    });
    const times = rows.map((r: any) =>
      frame === "D"
        ? new Date(r.t + 19800000).toISOString().slice(0, 10)
        : Math.floor(r.t / 1000),
    );
    bars.setData(
      rows.map((r: any, i: number) => ({
        time: times[i],
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
      })),
    );
    for (const [n, color] of [
      [20, "#7dc7ff"],
      [50, "#d2b3ff"],
      [200, "#edc474"],
    ] as const) {
      const ma = A.sma(
        rows.map((r: any) => r.c),
        n,
      );
      chart
        .addLineSeries({
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        .setData(
          ma.flatMap((v: any, i: number) =>
            v === null ? [] : [{ time: times[i], value: v }],
          ),
        );
    }
    chart.timeScale().fitContent();
    const observer = new ResizeObserver(() =>
      chart.applyOptions({ width: el.clientWidth }),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [tab, frame, packet, market]);
  const futures = snapshot?.futures || [],
    rollSpread =
      futures.length >= 2 &&
      futures[0].quote?.last_price &&
      futures[1].quote?.last_price
        ? futures[1].quote.last_price - futures[0].quote.last_price
        : null;
  return (
    <div className="view-stack">
      <div className="hero">
        <div>
          <p className="eyebrow">MARKET WORKSPACE</p>
          <h1>Price, structure, contracts.</h1>
        </div>
        <Link url="https://www.tradingview.com/chart/?symbol=NSE%3AHAL">
          Open TradingView
        </Link>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ["chart", "Price chart"],
          ["futures", "Futures"],
          ["options", "Option chain"],
        ]}
      />
      <Notice>{error}</Notice>
      {tab === "chart" && (
        <Panel
          title="HAL / NSE"
          action={
            <Tabs
              value={frame}
              onChange={setFrame}
              items={[
                ["D", "Daily"],
                ["15m", "15 min"],
                ["1h", "1 hour"],
              ]}
            />
          }
        >
          <div ref={container} className="chart" />
          {!rows.length && (
            <Notice>No candles available for this timeframe.</Notice>
          )}
          <p className="muted small">
            SMA 20 / 50 / 200 · Chart includes provisional bars; indicator
            summaries use completed bars. Time: IST.{" "}
            {packet?.source || market?.source || "No provider data"} ·{" "}
            {when(packet?.fetched_at_iso || market?.fetched_at_iso)}
          </p>
          <div className="metrics compact">
            <Metric
              label="Completed-bar RSI 14"
              value={number(
                tech?.rsi ?? (frame === "D" ? market?.ind?.rsi14 : null),
              )}
            />
            <Metric
              label="MACD histogram"
              value={number(
                tech?.hist ?? (frame === "D" ? market?.ind?.macd_hist : null),
                2,
              )}
            />
            <Metric
              label="ATR 14"
              value={money(
                tech?.atr ?? (frame === "D" ? market?.ind?.atr14 : null),
              )}
            />
            <Metric label="Bias" value={tech?.bias || "See daily context"} />
          </div>
        </Panel>
      )}
      {tab === "futures" && (
        <Panel title="Listed HAL futures">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Expiry</th>
                  <th>Lot size</th>
                  <th>LTP</th>
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>Quote time</th>
                </tr>
              </thead>
              <tbody>
                {futures.map((f: any) => (
                  <tr key={f.expiry}>
                    <td>{f.trading_symbol || "HAL FUT"}</td>
                    <td>{f.expiry}</td>
                    <td>{f.lot_size ?? "—"}</td>
                    <td>{money(f.quote?.last_price)}</td>
                    <td>{money(f.quote?.bid)}</td>
                    <td>{money(f.quote?.ask)}</td>
                    <td>{when(f.quote?.quote_as_of)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!futures.length && (
            <Notice>
              Connect the Upstox feed to discover listed contracts.
            </Notice>
          )}
          <Metric
            label="Next minus near-month LTP spread"
            value={money(rollSpread)}
            note="Indicative quote difference; execution, charges and liquidity excluded"
          />
        </Panel>
      )}
      {tab === "options" && (
        <Panel
          title="HAL option chain"
          action={
            <select
              aria-label="Option expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            >
              <option value="">Select expiry</option>
              {(snapshot?.available_expiries || []).map((d: string) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          }
        >
          <p className="muted small">
            {expiry || "No expiry selected"} · Retrieved{" "}
            {when(chain?.fetched_at_iso)}. Chain time is retrieval time; full
            quote timestamps and depth are checked separately in Put hedge.
          </p>
          <Notice>{chain?.chain_error}</Notice>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Call LTP</th>
                  <th>Call OI</th>
                  <th>Strike</th>
                  <th>Put bid</th>
                  <th>Put ask</th>
                  <th>Put LTP</th>
                  <th>Put OI</th>
                  <th>IV %</th>
                  <th>Delta</th>
                  <th>Lot size</th>
                </tr>
              </thead>
              <tbody>
                {(chain?.option_rows || []).map((r: any) => (
                  <tr key={r.strike}>
                    <td>{money(r.call?.ltp)}</td>
                    <td>{number(r.call?.oi, 0)}</td>
                    <th>{number(r.strike, 0)}</th>
                    <td>{money(r.put?.bid)}</td>
                    <td>{money(r.put?.ask)}</td>
                    <td>{money(r.put?.ltp)}</td>
                    <td>{number(r.put?.oi, 0)}</td>
                    <td>{number(r.put?.iv)}</td>
                    <td>{number(r.put?.delta, 3)}</td>
                    <td>{r.put?.lot_size ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!chain?.option_rows?.length && (
            <Notice>No option quotes available for this expiry.</Notice>
          )}
        </Panel>
      )}
    </div>
  );
}

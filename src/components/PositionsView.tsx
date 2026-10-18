import React, { useState, useEffect, useRef, useMemo } from "react";
import { A, C, H } from "../utils/engine";
import { api, money, number, when } from "../utils/api";
import { download, csvCell } from "../utils/book";
import { Panel, Metric, Notice, Tabs, Field } from "./UI";
import { useFreshnessClock } from "../utils/useFreshnessClock";
export function PositionsView({ book, updateBook, snapshot, goAI }: any) {
  const [tab, setTab] = useState("book"),
    [draft, setDraft] = useState(() => structuredClone(book.legs)),
    [message, setMessage] = useState("");
  const [funding, setFunding] = useState(book.funding),
    [settings, setSettings] = useState(book.hedge);
  const [comparison, setHedge] = useState<any>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState({
      spot: snapshot?.spot?.last_price || 0,
      days: 0,
      ivShift: 0,
      fallbackIV: null as number | null,
      rate: 6,
      dividend: 0,
    }),
    [scenarioResult, setScenarioResult] = useState<any>(null);
  const [close, setClose] = useState({
      index: 0,
      lots: 1,
      exit: 0,
      fees: 0,
      date: A.istDate(),
    }),
    [cash, setCash] = useState({
      kind: "fee",
      amount: 0,
      date: A.istDate(),
      note: "",
    });
  useEffect(() => {
    setDraft(structuredClone(book.legs));
    setHedge(null);
    setScenarioResult(null);
  }, [JSON.stringify(book.legs)]);
  const latestBook = useRef(book);
  latestBook.current = book;
  const comparisonContext = useMemo(
    () => JSON.stringify([book.legs, settings, snapshot]),
    [book.legs, settings, snapshot],
  );
  const currentContext = useRef(comparisonContext),
    requestRevision = useRef(0),
    mounted = useRef(true);
  if (currentContext.current !== comparisonContext) {
    currentContext.current = comparisonContext;
    requestRevision.current++;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestRevision.current++;
    };
  }, []);
  const now = useFreshnessClock(!!snapshot || !!comparison);
  const inputsChanged =
    comparison && comparison.revision !== requestRevision.current;
  const expired =
    comparison &&
    !comparison.errors.length &&
    Math.max(now, Date.now()) > comparison.validUntil;
  const hedge = inputsChanged || expired ? null : comparison;
  useEffect(() => {
    setFunding(book.funding);
  }, [JSON.stringify(book.funding)]);
  useEffect(() => {
    setSettings(book.hedge);
  }, [JSON.stringify(book.hedge)]);
  const marked = C.mtm(book.legs, snapshot),
    risk = A.risk(book.legs, snapshot, now),
    ledger = A.ledger(book, snapshot);
  const updateLeg = (index: number, key: string, value: any) =>
    setDraft((old: any[]) =>
      old.map((l, i) =>
        i === index
          ? {
              ...l,
              [key]: value,
              ...(key === "manual"
                ? { manualAt: value === null ? null : new Date().toISOString() }
                : {}),
            }
          : l,
      ),
    );
  const addLeg = () => {
    if (draft.length >= 12) return;
    setDraft([
      ...draft,
      {
        type: "FUT",
        expiry: snapshot?.futures?.[0]?.expiry || "",
        lots: 1,
        lotSize: snapshot?.futures?.[0]?.lot_size || 0,
        entry: 0,
        strike: null,
        manual: null,
        manualAt: null,
      },
    ]);
  };
  const save = () => {
    try {
      if (draft.length) C.validate(draft);
      const b = A.validateBook({ ...book, legs: draft });
      if (!updateBook(b))
        return setMessage(
          "Open book was not saved. Your edits have been retained; retry saving.",
        );
      setMessage(
        "Open book saved. Contract lot sizes are checked against available quotes.",
      );
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  const compare = async () => {
    const revision = ++requestRevision.current;
    const stillCurrent = () => revision === requestRevision.current;
    setBusy(true);
    setHedge(null);
    setMessage("");
    try {
      A.hedgePreferences(settings, true);
      const fresh = await api("/api/upstox/hal");
      const required = [
        ...new Set<string>([
          ...(fresh.available_expiries || []).filter(
            (d: string) => d >= settings.protectThrough,
          ),
          ...book.legs
            .filter((l: any) => l.type === "PE")
            .map((l: any) => l.expiry),
        ]),
      ];
      const chains: any = {},
        failed: string[] = [];
      await Promise.all(
        required.map(async (expiry) => {
          try {
            const r = await api(
              "/api/upstox/research?section=hedges&frame=" + expiry,
            );
            chains[expiry] = r.data;
          } catch {
            failed.push(expiry);
          }
        }),
      );
      if (!stillCurrent()) {
        if (mounted.current)
          setMessage(
            "Comparison inputs changed during refresh. Refresh and compare puts again.",
          );
        return;
      }
      const result = H.compare(
        book.legs,
        fresh,
        chains,
        settings,
        Date.now(),
        failed,
      );
      if (!updateBook({ ...latestBook.current, hedge: settings }))
        throw Error(
          "Hedge settings were not saved. Retry the comparison after resolving the save error.",
        );
      setHedge({ ...result, revision });
      setSelected(result.shortlist[0]?.id || "");
    } catch (e: any) {
      if (stillCurrent()) setMessage(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const candidate = hedge?.candidates.find((c: any) => c.id === selected);
  return (
    <div className="view-stack">
      <div className="hero">
        <div>
          <p className="eyebrow">POSITION DESK</p>
          <h1>Your book, with context.</h1>
        </div>
        <button onClick={() => goAI("copilot")}>Discuss with AI ↗</button>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ["book", "Open book"],
          ["risk", "Risk & funding"],
          ["scenario", "Scenarios"],
          ["hedge", "Put hedge"],
          ["journal", "Journal"],
        ]}
      />
      <Notice>{message}</Notice>
      <Notice>
        {inputsChanged
          ? "Comparison inputs changed. Refresh and compare puts again."
          : expired
            ? "Comparison quotes have expired. Refresh and compare puts again."
            : null}
      </Notice>
      <Notice>
        {busy &&
          "Refreshing comparison. Changes to inputs will discard this response."}
      </Notice>
      <div className="metrics">
        <Metric label="Open P&L" value={money(ledger.open)} />
        <Metric label="Realized" value={money(ledger.realized)} />
        <Metric label="Charges" value={money(ledger.charges)} />
        <Metric label="Net recorded P&L" value={money(ledger.net)} />
      </div>
      {tab === "book" && (
        <>
          <Panel
            title="Open positions"
            action={
              <select
                aria-label="Mark mode"
                value={book.preferences.markMode}
                onChange={(e) =>
                  updateBook({
                    ...book,
                    preferences: {
                      ...book.preferences,
                      markMode: e.target.value,
                    },
                  })
                }
              >
                <option value="ltp">LTP marks</option>
                <option value="bid">Bid marks</option>
              </select>
            }
          >
            {!marked.rows.length ? (
              <Notice>No open positions saved.</Notice>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Expiry</th>
                      <th>Lots × size</th>
                      <th>Entry</th>
                      <th>Mark</th>
                      <th>Open P&L</th>
                      <th>Source / time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marked.rows.map((l: any, i: number) => (
                      <tr key={i}>
                        <td>
                          {l.type === "PE"
                            ? number(l.strike, 0) + " PE"
                            : "HAL FUT"}
                        </td>
                        <td>{l.expiry}</td>
                        <td>
                          {l.lots} × {l.lotSize}
                        </td>
                        <td>{money(l.entry)}</td>
                        <td>{money(l.price)}</td>
                        <td>{money(l.pnl)}</td>
                        <td>
                          <small>
                            {l.source}
                            <br />
                            {when(l.stamp)}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted small">
              {C.freshness(snapshot, now)}. Manual marks override quotes.
              Missing marks stay unavailable; theoretical values appear only
              under Scenarios.
            </p>
          </Panel>
          <Panel
            title="Edit actual holdings"
            action={
              <button onClick={addLeg} disabled={draft.length >= 12}>
                + Add leg
              </button>
            }
          >
            <p className="muted small">
              Record fills made outside this app. Use Journal to close a leg and
              retain its realized P&L.
            </p>
            {draft.map((l: any, i: number) => (
              <div className="leg-editor" key={i}>
                <Field label={"Leg " + (i + 1)}>
                  <select
                    aria-label={"Contract type " + (i + 1)}
                    value={l.type}
                    onChange={(e) => updateLeg(i, "type", e.target.value)}
                  >
                    <option>FUT</option>
                    <option>PE</option>
                  </select>
                </Field>
                <Field label="Expiry">
                  <input
                    aria-label={"Expiry " + (i + 1)}
                    type="date"
                    value={l.expiry}
                    onChange={(e) => updateLeg(i, "expiry", e.target.value)}
                  />
                </Field>
                {[
                  "lots",
                  "lotSize",
                  "entry",
                  ...(l.type === "PE" ? ["strike"] : []),
                ].map((k) => (
                  <Field
                    key={k}
                    label={
                      {
                        lots: "Lots",
                        lotSize: "Units / lot",
                        entry: "Entry price",
                        strike: "Strike",
                      }[k]
                    }
                  >
                    <input
                      aria-label={k + " " + (i + 1)}
                      type="number"
                      min="0"
                      step={k === "entry" ? "0.05" : "1"}
                      value={l[k] ?? ""}
                      onChange={(e) => updateLeg(i, k, Number(e.target.value))}
                    />
                  </Field>
                ))}
                <Field label="Manual mark (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={l.manual ?? ""}
                    onChange={(e) =>
                      updateLeg(
                        i,
                        "manual",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </Field>
                <button
                  onClick={() =>
                    setDraft(draft.filter((_: any, n: number) => n !== i))
                  }
                >
                  Remove from draft
                </button>
              </div>
            ))}
            <button className="primary" onClick={save}>
              Save open book
            </button>
          </Panel>
        </>
      )}
      {tab === "risk" && (
        <>
          <Panel title="Exposure across expiries">
            <div className="metrics compact">
              <Metric
                label="Futures / put units"
                value={`${risk.futureUnits} / ${risk.putUnits}`}
              />
              <Metric
                label="Quantity coverage"
                value={
                  risk.coverage === null ? "—" : number(risk.coverage) + "%"
                }
              />
              <Metric label="Delta" value={number(risk.delta)} />
              <Metric label="Theta / day" value={money(risk.theta)} />
            </div>
            {risk.warnings.map((w: any) => (
              <Notice key={w.title}>
                <b>{w.title}</b> · {w.detail}
              </Notice>
            ))}
            <div className="data-list">
              {risk.timeline.map((r: any) => (
                <div key={r.date}>
                  <span>After {r.date}</span>
                  <b>{r.uncovered} uncovered futures units</b>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Funding snapshot">
            <div className="form-grid">
              {["margin", "free"].map((k) => (
                <Field
                  label={k === "margin" ? "Margin used" : "Free funds"}
                  key={k}
                >
                  <input
                    type="number"
                    min="0"
                    value={funding[k] ?? ""}
                    onChange={(e) =>
                      setFunding({
                        ...funding,
                        [k]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <button
              onClick={() => {
                if (
                  Object.values(funding).some(
                    (v: any) =>
                      typeof v === "number" && (!Number.isFinite(v) || v < 0),
                  )
                )
                  return setMessage("Enter non-negative funding values.");
                updateBook({
                  ...book,
                  funding: { ...funding, at: new Date().toISOString() },
                });
              }}
            >
              Save funding snapshot
            </button>
            <p className="muted small">
              Manually recorded · {when(book.funding.at)}. This is not a live
              broker balance.
            </p>
          </Panel>
        </>
      )}
      {tab === "scenario" && (
        <Panel title="Model a price and time scenario">
          <div className="form-grid">
            {[
              ["spot", "HAL scenario price"],
              ["days", "Calendar days ahead"],
              ["ivShift", "IV shift (percentage points)"],
              ["fallbackIV", "IV assumption if missing (%)"],
              ["rate", "Annual rate (%)"],
              ["dividend", "Dividend yield (%)"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  step="any"
                  value={scenario[key] ?? ""}
                  onChange={(e) =>
                    setScenario({
                      ...scenario,
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              try {
                setScenarioResult(A.scenario(book.legs, snapshot, scenario));
                setMessage("");
              } catch (e: any) {
                setScenarioResult(null);
                setMessage(e.message);
              }
            }}
          >
            Calculate scenario
          </button>
          {scenarioResult && (
            <>
              <Metric
                label="Modelled open P&L from entry"
                value={money(scenarioResult.total)}
                note={when(new Date(scenarioResult.horizon).toISOString())}
              />
              <p className="muted">{scenarioResult.assumptions}</p>
            </>
          )}
          <p className="muted small">
            The horizon must be on or before the earliest saved expiry. Existing
            marks and actual contract expiries are used.
          </p>
        </Panel>
      )}
      {tab === "hedge" && (
        <>
          <Panel title="Compare protective puts">
            <p className="muted">
              Compare replacing the current put basket with puts matching your
              long futures units. Candidates never change your saved holdings.
            </p>
            <div className="form-grid">
              {[
                ["budget", "New-hedge budget (₹)"],
                ["maxLoss", "Sampled additional-loss limit (₹)"],
                ["protectThrough", "Protect through"],
                ["buyFees", "Estimated buy charges (₹)"],
                ["exitFees", "Estimated old-put exit charges (₹)"],
                ["slippage", "Slippage (%)"],
                ["maxSpread", "Maximum spread (%)"],
                ["ivShift", "IV shift (points)"],
                ["rate", "Annual rate (%)"],
                ["dividend", "Dividend yield (%)"],
              ].map(([key, label]) => (
                <Field label={label} key={key}>
                  <input
                    aria-label={label}
                    type={key === "protectThrough" ? "date" : "number"}
                    step="any"
                    value={settings[key] ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [key]:
                          key === "protectThrough"
                            ? e.target.value
                            : e.target.value === ""
                              ? null
                              : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <button className="primary" disabled={busy} onClick={compare}>
              {busy ? "Refreshing exact contracts…" : "Refresh & compare puts"}
            </button>
            <p className="muted small">
              Requires recent trades, two-sided prices, sufficient displayed
              quantity, valid Greeks and verified lot sizes across every
              relevant listed expiry. Market closure or missing quotes can leave
              no eligible candidate.
            </p>
          </Panel>
          {hedge && (
            <>
              <Notice>{hedge.errors.join(" ")}</Notice>
              {hedge.warnings.map((w: string) => (
                <Notice key={w}>{w}</Notice>
              ))}
              {!hedge.errors.length && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Existing put bid value"
                      value={money(hedge.oldBidValue)}
                    />
                    <Metric
                      label="Estimated sale proceeds"
                      value={money(hedge.oldSaleProceeds)}
                    />
                    <Metric
                      label="Futures units to cover"
                      value={number(hedge.futureUnits, 0)}
                    />
                    <Metric
                      label="Eligible / evaluated"
                      value={`${hedge.eligible.length} / ${hedge.candidates.length}`}
                    />
                  </div>
                  <div className="candidate-grid">
                    {hedge.shortlist.map((c: any) => (
                      <Panel key={c.id} title={c.badges.join(" · ")}>
                        <h3>{number(c.strike, 0)} PE</h3>
                        <p className="muted">
                          {c.expiry} · {c.lots} lots × {c.lotSize}
                        </p>
                        <div className="data-list">
                          <div>
                            <span>New premium + buy fees</span>
                            <b>{money(c.grossCost)}</b>
                          </div>
                          <div>
                            <span>Net cash outlay</span>
                            <b>{money(c.netOutlay)}</b>
                          </div>
                          <div>
                            <span>Worst sampled additional loss</span>
                            <b>{money(c.stressLoss)}</b>
                          </div>
                          <div>
                            <span>Bid / ask</span>
                            <b>
                              {money(c.quote.bid)} / {money(c.quote.ask)}
                            </b>
                          </div>
                        </div>
                        {c.expiryGap && (
                          <Notice>
                            This put expires before a saved futures leg.
                          </Notice>
                        )}
                        <button onClick={() => setSelected(c.id)}>
                          Inspect scenarios
                        </button>
                      </Panel>
                    ))}
                  </div>
                  {!hedge.shortlist.length && (
                    <Notice>
                      No candidate meets your budget, loss limit and
                      quote-quality requirements.
                    </Notice>
                  )}
                  {candidate && (
                    <Panel title={`${candidate.strike} PE · keep vs replace`}>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Horizon</th>
                              <th>Spot shock</th>
                              <th>Keep: additional P&L</th>
                              <th>Replace: additional P&L</th>
                              <th>Replace: P&L from entry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidate.scenarios.flatMap((g: any, i: number) =>
                              g.values.map((v: any, j: number) => (
                                <tr key={i + ":" + j}>
                                  <td>{g.label}</td>
                                  <td>{v.shock}%</td>
                                  <td>{money(hedge.keep[i].values[j].pnl)}</td>
                                  <td>{money(v.pnl)}</td>
                                  <td>{money(v.entryPnl)}</td>
                                </tr>
                              )),
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="muted small">
                        Net cash outlay is not P&L. Additional P&L starts from
                        current futures marks and old-put bids; the entry view
                        adds saved futures P&L and old premium. Earlier journal
                        P&L is excluded. European Black–Scholes estimates at
                        sampled prices/dates are not a maximum-loss guarantee.
                      </p>
                    </Panel>
                  )}
                </>
              )}
              <details className="panel">
                <summary>
                  Excluded and over-limit contracts (
                  {hedge.excluded.length +
                    hedge.candidates.filter((c: any) => c.limits.length).length}
                  )
                </summary>
                {hedge.excluded.map((c: any) => (
                  <p key={c.expiry + ":" + c.strike}>
                    {c.expiry} · {c.strike} PE — {c.reasons.join("; ")}
                  </p>
                ))}
                {hedge.candidates
                  .filter((c: any) => c.limits.length)
                  .map((c: any) => (
                    <p key={c.id}>
                      {c.expiry} · {c.strike} PE — {c.limits.join("; ")}
                    </p>
                  ))}
              </details>
            </>
          )}
        </>
      )}
      {tab === "journal" && (
        <>
          <Panel title="Record an actual close">
            <p className="muted">
              This records a completed fill and reduces the saved open quantity.
              It does not send an order.
            </p>
            <div className="form-grid">
              <Field label="Open leg">
                <select
                  value={close.index}
                  onChange={(e) =>
                    setClose({ ...close, index: Number(e.target.value) })
                  }
                >
                  {book.legs.map((l: any, i: number) => (
                    <option value={i} key={i}>
                      {l.type} {l.strike || ""} · {l.expiry}
                    </option>
                  ))}
                </select>
              </Field>
              {[
                ["lots", "Closed lots"],
                ["exit", "Actual exit price"],
                ["fees", "Total charges"],
                ["date", "Close date"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type={key === "date" ? "date" : "number"}
                    value={close[key]}
                    onChange={(e) =>
                      setClose({
                        ...close,
                        [key]:
                          key === "date"
                            ? e.target.value
                            : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <button
              onClick={() => {
                try {
                  const saved = updateBook(
                    A.closeLeg(
                      book,
                      close.index,
                      close.lots,
                      close.exit,
                      close.fees,
                      close.date,
                    ),
                  );
                  if (!saved)
                    return setMessage(
                      "Actual close was not saved. Your inputs have been retained; retry saving.",
                    );
                  setMessage("Actual close recorded.");
                } catch (e: any) {
                  setMessage(e.message);
                }
              }}
            >
              Record close
            </button>
          </Panel>
          <Panel title="Charges & settlement cash">
            <div className="form-grid">
              <Field label="Record type">
                <select
                  value={cash.kind}
                  onChange={(e) => setCash({ ...cash, kind: e.target.value })}
                >
                  <option value="fee">Charges</option>
                  <option value="settlement">Settlement cash only</option>
                </select>
              </Field>
              <Field label="Amount">
                <input
                  type="number"
                  value={cash.amount}
                  onChange={(e) =>
                    setCash({ ...cash, amount: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={cash.date}
                  onChange={(e) => setCash({ ...cash, date: e.target.value })}
                />
              </Field>
              <Field label="Note">
                <input
                  value={cash.note}
                  onChange={(e) => setCash({ ...cash, note: e.target.value })}
                />
              </Field>
            </div>
            <button
              onClick={() => {
                try {
                  updateBook(
                    A.validateBook({
                      ...book,
                      journal: [
                        ...book.journal,
                        { ...cash, id: crypto.randomUUID() },
                      ],
                    }),
                  );
                } catch (e: any) {
                  setMessage(e.message);
                }
              }}
            >
              Add journal entry
            </button>
            <p className="muted small">
              Settlement cash is tracked separately and is not added again to
              trading P&L.
            </p>
          </Panel>
          <Panel
            title="Saved journal"
            action={
              <button
                onClick={() =>
                  download(
                    "hal-journal.csv",
                    [
                      ["Date", "Kind", "Amount / realized gross", "Note"],
                      ...book.journal.map((j: any) => [
                        j.date,
                        j.kind,
                        j.kind === "close"
                          ? (j.exit - j.leg.entry) * j.leg.lots * j.leg.lotSize
                          : j.amount,
                        j.note,
                      ]),
                    ]
                      .map((r) => r.map(csvCell).join(","))
                      .join("\r\n"),
                    "text/csv",
                  )
                }
              >
                Export CSV
              </button>
            }
          >
            <div className="data-list">
              {book.journal.map((j: any) => (
                <div key={j.id}>
                  <span>
                    {j.date} · {j.kind} · {j.note}
                  </span>
                  <b>
                    {money(
                      j.kind === "close"
                        ? (j.exit - j.leg.entry) * j.leg.lots * j.leg.lotSize
                        : j.amount,
                    )}
                  </b>
                </div>
              ))}
            </div>
            {!book.journal.length && (
              <p className="muted">No journal entries.</p>
            )}
          </Panel>
          {book.legacy && (
            <Panel title="Imported legacy reconciliation">
              <Notice>
                Opening realized total: {money(book.legacy.realized)} · opening
                charges: {money(book.legacy.costs)}. The earlier amount-only
                notebook is retained below and is not added again to these
                totals.
              </Notice>
              <div className="data-list">
                {book.legacy.journal.map((j: any, i: number) => (
                  <div key={i}>
                    <span>
                      {j.date} · {j.kind} · {j.note}
                    </span>
                    <b>{money(j.amount)}</b>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

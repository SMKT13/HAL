import React, { useState, useEffect } from "react";
import { A } from "../utils/engine";
import { number, when } from "../utils/api";
import { Panel, Notice, Tabs, Metric, Field, Link } from "./UI";
export function ResearchView({
  book,
  updateBook,
  fetchResearch,
  research,
  goAI,
}: any) {
  const [tab, setTab] = useState("financials"),
    [statement, setStatement] = useState("consolidated"),
    [error, setError] = useState(""),
    [note, setNote] = useState({
      title: "",
      text: "",
      url: "",
      category: "Other",
      date: A.istDate(),
    });
  const packet = research["fundamentals:D:" + statement],
    summary = A.financialSummary(packet?.data);
  const refresh = () =>
    fetchResearch("fundamentals", "D", statement).catch((e: any) =>
      setError(e.message),
    );
  useEffect(() => {
    setError("");
    refresh();
  }, [statement]);
  return (
    <div className="view-stack">
      <div className="hero">
        <div>
          <p className="eyebrow">HAL RESEARCH</p>
          <h1>Build a sourced thesis.</h1>
        </div>
        <button onClick={() => goAI("research")}>Search with Gemini ↗</button>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ["financials", "Financials"],
          ["notes", "Business notes"],
        ]}
      />
      <Notice>{error || packet?.error}</Notice>
      {tab === "financials" && (
        <>
          <Panel
            title="Reported fundamentals"
            action={
              <div className="actions">
                <select
                  aria-label="Statement basis"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                >
                  <option value="consolidated">Consolidated</option>
                  <option value="standalone">Standalone</option>
                </select>
                <button onClick={refresh}>Refresh</button>
              </div>
            }
          >
            <p className="muted small">
              {packet?.source || "Feed unavailable"} ·{" "}
              {when(packet?.fetched_at_iso)} · Values retain provider units and
              reported periods.
            </p>
            <Notice>
              {Object.entries(packet?.errors || {})
                .map(([field, reason]) => `${field}: ${reason}`)
                .join(" · ")}
            </Notice>
            <div className="metrics">
              <Metric
                label="Revenue (reported units)"
                value={number(summary.revenue?.value, 2)}
                note={summary.revenue?.period}
              />
              <Metric
                label="Net profit (reported units)"
                value={number(summary.profit?.value, 2)}
                note={summary.profit?.period}
              />
              <Metric
                label="Net margin"
                value={
                  summary.margin === null
                    ? "—"
                    : number(summary.margin, 2) + "%"
                }
              />
              <Metric
                label="Operating margin"
                value={
                  summary.opMargin === null
                    ? "—"
                    : number(summary.opMargin, 2) + "%"
                }
              />
            </div>
            {!summary.revenue && (
              <Notice>
                Financial data has not been returned. No archived figures are
                substituted.
              </Notice>
            )}
            {(packet?.data?.income?.income_statement || []).map((row: any) => (
              <details key={row.category}>
                <summary>
                  {row.category.replaceAll("_", " ")} · quarterly
                </summary>
                <div className="data-list">
                  {(row.history || []).map((h: any) => (
                    <div key={h.period}>
                      <span>{h.period}</span>
                      <b>{number(h.value, 2)}</b>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </Panel>
          <Panel title="Statements, ownership & corporate actions">
            {Object.entries(packet?.data || {})
              .filter(([k]) => k !== "income")
              .map(([k, v]) => (
                <details key={k}>
                  <summary>{k.replaceAll("_", " ")}</summary>
                  <pre className="data-json">{JSON.stringify(v, null, 2)}</pre>
                </details>
              ))}
            <p className="muted small">
              Review period, statement basis and units before comparing figures.
              Data may depend on your Upstox entitlements.
            </p>
          </Panel>
        </>
      )}
      {tab === "notes" && (
        <>
          <Panel title="Your research notebook">
            <div className="form-grid">
              <Field label="Title">
                <input
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                />
              </Field>
              <Field label="Source URL (optional)">
                <input
                  value={note.url}
                  onChange={(e) => setNote({ ...note, url: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <select
                  value={note.category}
                  onChange={(e) =>
                    setNote({ ...note, category: e.target.value })
                  }
                >
                  {[
                    "Order book",
                    "Deliveries",
                    "Guidance",
                    "Results",
                    "Other",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Note">
              <textarea
                value={note.text}
                onChange={(e) => setNote({ ...note, text: e.target.value })}
              />
            </Field>
            <button
              className="primary"
              onClick={() => {
                if (!note.title.trim() || !note.text.trim())
                  return setError("Enter a title and note.");
                if (note.url && !A.safeURL(note.url))
                  return setError("Use a public HTTPS source URL.");
                const saved = updateBook({
                  ...book,
                  notes: [{ ...note, id: crypto.randomUUID() }, ...book.notes],
                });
                if (!saved)
                  return setError(
                    "Note was not saved. Your draft has been retained; retry saving or copy it before leaving this screen.",
                  );
                setNote({ ...note, title: "", text: "", url: "" });
                setError("");
              }}
            >
              Save note
            </button>
          </Panel>
          {book.notes.map((n: any) => (
            <Panel key={n.id} title={n.title}>
              <p className="muted small">
                {n.date} · {n.category} · Personal note
              </p>
              <p className="preserve-lines">{n.text}</p>
              {n.url && <Link url={n.url}>Source</Link>}
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { api, when } from "../utils/api";
import { Panel, Notice, Tabs, Field, Link } from "./UI";
export function AICopilotView({ book, initialMode = "deliberate" }: any) {
  const [mode, setMode] = useState(initialMode),
    [consent, setConsent] = useState(false),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null),
    [config, setConfig] = useState<any>(null);
  const requestRevision = useRef(0);
  useEffect(() => {
    api("/api/config")
      .then(setConfig)
      .catch((e: any) => setError(e.message));
  }, []);
  useEffect(() => {
    // Results belong to the mode and book that were submitted. Invalidate
    // pending responses when either changes, and when the view unmounts.
    requestRevision.current++;
    setResult(null);
    setError("");
    setBusy(false);
    return () => {
      requestRevision.current++;
    };
  }, [mode, JSON.stringify(book)]);
  const run = async () => {
    const revision = ++requestRevision.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await api("/api/ai/" + mode, {
        consent,
        message: question,
        ...(mode !== "research"
          ? { book: { ...book, notes: [], bookmarks: [] } }
          : {}),
      });
      if (revision === requestRevision.current) setResult(r);
    } catch (e: any) {
      if (revision === requestRevision.current) setError(e.message);
    } finally {
      if (revision === requestRevision.current) setBusy(false);
    }
  };
  return (
    <div className="view-stack">
      <div className="hero ai-hero">
        <div>
          <p className="eyebrow">GEMINI · AI COPILOT</p>
          <h1>
            A second perspective.
            <br />
            Grounded in what is known.
          </h1>
          <p className="muted">
            Explore your exposure, question assumptions and research HAL
            disclosures.
          </p>
        </div>
        <span className="ai-orb" aria-hidden="true">
          ✦
        </span>
      </div>
      <Tabs
        value={mode}
        onChange={setMode}
        items={[
          ["deliberate", "Six perspectives"],
          ["copilot", "Position Copilot"],
          ["research", "Search research"],
        ]}
      />
      <Panel
        title={
          mode === "deliberate"
            ? "Review the book from six perspectives"
            : mode === "copilot"
              ? "Ask about your recorded positions"
              : "Research a company question"
        }
      >
        <p className="muted">
          {mode === "deliberate"
            ? "One Gemini model reviews technicals, fundamentals, news, derivatives, risk and synthesis. Missing evidence remains explicit."
            : mode === "copilot"
              ? "The server adds provider quotes and computes exposure from your validated book. Model commentary can be wrong; verify it against the recorded data."
              : "Gemini can use Google Search and return source links. A grounded label appears only when the provider returns search sources."}
        </p>
        <p className="muted small">
          Model: {config?.model || "Checking…"} · AI{" "}
          {config?.aiEnabled ? "configured" : "unavailable"} · Search{" "}
          {config?.searchEnabled ? "enabled" : "disabled"}
        </p>
        {mode !== "deliberate" && (
          <Field
            label={mode === "copilot" ? "Your question" : "Research query"}
          >
            <textarea
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                mode === "copilot"
                  ? "Where does my hedge expire before my futures?"
                  : "Find recent official HAL results and explain what changed."
              }
            />
          </Field>
        )}
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            {mode === "research"
              ? "Send this question to Gemini and Google Search."
              : "Send this question and my open legs, marks and computed ledger to Gemini."}{" "}
            Requests use the server’s configured account and may use its quota.
            Nothing is sent until I run the request.
          </span>
        </label>
        <button
          className="primary"
          disabled={
            !consent ||
            busy ||
            !config?.aiEnabled ||
            (mode === "research" && !config?.searchEnabled) ||
            (mode !== "deliberate" && !question.trim())
          }
          onClick={run}
        >
          {busy
            ? "Gemini is reviewing…"
            : mode === "deliberate"
              ? "Run six-perspective review"
              : mode === "research"
                ? "Research with search"
                : "Ask Copilot"}
        </button>
      </Panel>
      <Notice>{error}</Notice>
      {result && (
        <>
          <div className="provenance">
            <b>{result.source}</b>
            <span>
              {result.grounded
                ? "Search sources returned"
                : "No live search grounding"}
            </span>
            <span>Generated {when(result.generatedAt)}</span>
            {result.dataAsOf && (
              <span>Market quote {when(result.dataAsOf)}</span>
            )}
          </div>
          {mode === "deliberate" ? (
            <>
              <Panel title={result.consensus}>
                <p>{result.consensusSummary}</p>
              </Panel>
              <div className="candidate-grid">
                {result.agents.map((agent: any, i: number) => (
                  <Panel key={i} title={agent.name}>
                    <p className="eyebrow">{agent.stance}</p>
                    <ul>
                      {agent.keyPoints.map((point: string, j: number) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  </Panel>
                ))}
              </div>
              <Panel title="Questions to monitor">
                <ul>
                  {result.recommendations.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Panel>
            </>
          ) : (
            <Panel
              title={
                mode === "research" ? "Research response" : "Copilot response"
              }
            >
              <div className="preserve-lines">
                {result.reply || result.report}
              </div>
            </Panel>
          )}
          {!!result.sources?.length && (
            <Panel title="Sources returned by Gemini">
              <div className="source-list">
                {result.sources.map((s: any, i: number) => (
                  <Link key={i} url={s.url}>
                    {s.title || s.url}
                  </Link>
                ))}
              </div>
              <p className="muted small">
                Source links do not guarantee that every statement is supported.
                Open the original disclosures to verify.
              </p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

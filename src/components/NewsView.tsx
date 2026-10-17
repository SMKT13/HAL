import React, { useEffect, useState } from "react";
import { A } from "../utils/engine";
import { when } from "../utils/api";
import { Panel, Notice, Tabs, Link } from "./UI";
export function NewsView({ book, updateBook, fetchResearch, research }: any) {
  const [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    setError("");
    const results = await Promise.allSettled(
      ["news", "filings"].map((s) => fetchResearch(s)),
    );
    setError(
      results
        .filter((r) => r.status === "rejected")
        .map((r: any) => r.reason.message)
        .join(" · "),
    );
    setBusy(false);
  };
  useEffect(() => {
    refresh();
  }, []);
  const news = research["news:D:consolidated"],
    filings = research["filings:D:consolidated"];
  const items = [
    ...A.newsItems(news?.data?.articles),
    ...(filings?.data?.items || [])
      .filter((n: any) => A.safeURL(n.url))
      .map((n: any) => ({ ...n, url: A.safeURL(n.url) })),
  ].sort(
    (a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0),
  );
  const unique = items.filter(
    (n: any, i: number) => items.findIndex((x: any) => x.url === n.url) === i,
  );
  const selected =
    filter === "saved"
      ? book.bookmarks
      : filter === "official"
        ? unique.filter((n: any) => n.official)
        : unique;
  const bookmark = (n: any) =>
    updateBook({
      ...book,
      bookmarks: book.bookmarks.some((b: any) => b.url === n.url)
        ? book.bookmarks.filter((b: any) => b.url !== n.url)
        : [...book.bookmarks, n],
    });
  return (
    <div className="view-stack">
      <div className="hero">
        <div>
          <p className="eyebrow">NEWSROOM</p>
          <h1>What changed, with a source.</h1>
        </div>
        <button disabled={busy} onClick={refresh}>
          {busy ? "Refreshing…" : "Refresh newsroom"}
        </button>
      </div>
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          ["all", "All headlines"],
          ["official", "NSE disclosures"],
          ["saved", "Saved"],
        ]}
      />
      <Notice>{error}</Notice>
      <Notice>
        {[news, filings]
          .flatMap((p) =>
            Object.entries(p?.errors || {}).map(([k, v]) => `${k}: ${v}`),
          )
          .join(" · ")}
      </Notice>
      <p className="muted small">
        Upstox news and the latest NSE RSS window. An empty feed does not prove
        there are no announcements. Retrieved{" "}
        {when(news?.fetched_at_iso || filings?.fetched_at_iso)}
      </p>
      {!selected.length && (
        <Panel title="No headlines available">
          <p className="muted">
            Refresh the feed, check your connection, or switch filters.
          </p>
        </Panel>
      )}
      {selected.map((n: any) => (
        <Panel
          key={n.url}
          title={n.title}
          action={
            <button onClick={() => bookmark(n)}>
              {book.bookmarks.some((b: any) => b.url === n.url)
                ? "Unsave"
                : "Save"}
            </button>
          }
        >
          <p className="muted small">
            {n.source} · {when(n.published)}
            {n.official ? " · Official disclosure" : ""}
          </p>
          {n.summary && <p>{n.summary}</p>}
          <Link url={n.url}>Read source</Link>
        </Panel>
      ))}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { OverviewView } from "./components/OverviewView";
import { PositionsView } from "./components/PositionsView";
import { MarketsView } from "./components/MarketsView";
import { ResearchView } from "./components/ResearchView";
import { NewsView } from "./components/NewsView";
import { AICopilotView } from "./components/AICopilotView";
import { SettingsModal } from "./components/SettingsModal";
import { Notice } from "./components/UI";
import { A, C } from "./utils/engine";
import { loadBook, saveBook } from "./utils/book";
import { api, viewerKey, when } from "./utils/api";

export function App() {
  const [initial] = useState(() => loadBook(localStorage));
  const [book, setBook] = useState(initial.book),
    [notice, setNotice] = useState(initial.notice);
  const [tab, setTab] = useState("overview"),
    [aiMode, setAiMode] = useState("deliberate"),
    [settings, setSettings] = useState(false);
  const [market, setMarket] = useState<any>(null),
    [snapshot, setSnapshot] = useState<any>(null),
    [loading, setLoading] = useState(false),
    [feedError, setFeedError] = useState("");
  const [research, setResearch] = useState<any>({});
  const current = useRef(book);
  current.current = book;
  const busy = useRef(false),
    generation = useRef(0);
  const updateBook = (next: any) => {
    try {
      if (initial.blocked && !localStorage.getItem("hal_recovery_ack"))
        throw Error(
          "Recover or import the saved book in Settings before editing.",
        );
      const clean = saveBook(localStorage, next);
      setBook(clean);
      setNotice("Saved on this device.");
    } catch (e: any) {
      setNotice(e.message);
    }
  };
  const fetchResearch = async (
    section: string,
    frame = "D",
    type = "consolidated",
  ) => {
    const key = section + ":" + frame + ":" + type;
    try {
      const data = await api(
        `/api/upstox/research?section=${section}&frame=${encodeURIComponent(frame)}&type=${type}`,
      );
      setResearch((old: any) => ({ ...old, [key]: data }));
      return data;
    } catch (e: any) {
      setResearch((old: any) => ({ ...old, [key]: { error: e.message } }));
      throw e;
    }
  };
  const refresh = async (force = false) => {
    if (busy.current && !force) return;
    if (!viewerKey()) {
      setFeedError(
        "Connect your viewer key in Desk Settings to load market data.",
      );
      return;
    }
    busy.current = true;
    setLoading(true);
    const revision = ++generation.current;
    const results = await Promise.allSettled([
      api("/api/data"),
      api("/api/upstox/hal"),
    ]);
    if (revision !== generation.current) return;
    const messages: string[] = [];
    if (results[0].status === "fulfilled") setMarket(results[0].value);
    else {
      setMarket((old: any) =>
        old ? { ...old, stale: true, data_status: "stale" } : null,
      );
      messages.push("Daily feed: " + results[0].reason.message);
    }
    if (results[1].status === "fulfilled") {
      const snap = results[1].value,
        chains: any = {},
        failed: string[] = [];
      const expiries = [
        ...new Set<string>(
          current.current.legs
            .filter((l: any) => l.type === "PE")
            .map((l: any) => l.expiry),
        ),
      ];
      await Promise.all(
        expiries.map(async (expiry) => {
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
      if (revision === generation.current)
        setSnapshot({
          ...snap,
          ...chains[snap.option_expiry],
          chains,
          failedExpiries: failed,
          researchUnavailable: false,
        });
      if (failed.length)
        messages.push("Some saved put expiry quotes could not be refreshed.");
    } else {
      setSnapshot((old: any) =>
        old ? { ...old, researchUnavailable: true } : null,
      );
      messages.push("Broker feed: " + results[1].reason.message);
    }
    if (revision === generation.current) setFeedError(messages.join(" "));
    if (revision === generation.current) {
      busy.current = false;
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!book.preferences.auto) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [book.preferences.auto]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        book.preferences.theme === "dark" ||
          (book.preferences.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [book.preferences.theme]);
  const effective = snapshot
    ? { ...snapshot, markMode: book.preferences.markMode }
    : null;
  const goAI = (mode = "deliberate") => {
    setAiMode(mode);
    setTab("ai");
  };
  return (
    <>
      <Header
        activeTab={tab}
        onTabChange={setTab}
        onRefresh={() => refresh()}
        onOpenSettings={() => setSettings(true)}
        loading={loading}
        dataStatus={
          snapshot && !snapshot.researchUnavailable
            ? C.freshness(snapshot) === "Recent market quote"
              ? "live"
              : "stale"
            : market?.data_status || "unavailable"
        }
        lastSession={market?.last_session}
      />
      <main className="desk-shell">
        <div className="desk-caption">
          <span>PERSONAL RESEARCH TERMINAL</span>
          <span>HAL · INDIA / NSE</span>
        </div>
        <Notice>{feedError}</Notice>
        <Notice>{notice}</Notice>
        {tab === "overview" && (
          <OverviewView
            market={market}
            snapshot={effective}
            book={book}
            goAI={goAI}
            navigate={setTab}
          />
        )}
        {tab === "positions" && (
          <PositionsView
            book={book}
            updateBook={updateBook}
            snapshot={effective}
            fetchResearch={fetchResearch}
            goAI={goAI}
          />
        )}
        {tab === "markets" && (
          <MarketsView
            market={market}
            snapshot={effective}
            fetchResearch={fetchResearch}
            research={research}
          />
        )}
        {tab === "research" && (
          <ResearchView
            book={book}
            updateBook={updateBook}
            fetchResearch={fetchResearch}
            research={research}
            goAI={goAI}
          />
        )}
        {tab === "news" && (
          <NewsView
            book={book}
            updateBook={updateBook}
            fetchResearch={fetchResearch}
            research={research}
          />
        )}
        {tab === "ai" && <AICopilotView book={book} initialMode={aiMode} />}
        <footer>
          Monitoring only · Quotes may be delayed · Provider time:{" "}
          {when(snapshot?.spot?.quote_as_of || market?.quote_as_of)} · No order
          execution
        </footer>
      </main>
      {settings && (
        <SettingsModal
          book={book}
          updateBook={updateBook}
          onImport={(next: any) => {
            initial.blocked = false;
            setBook(next);
            setNotice(
              "Backup imported and saved. Previous data is retained as a recovery copy.",
            );
          }}
          onConnect={() => {
            setResearch({});
            setSnapshot(null);
            setMarket(null);
            setSettings(false);
            refresh(true);
          }}
          onClose={() => setSettings(false)}
        />
      )}
    </>
  );
}

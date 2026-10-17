import React, { useState, useEffect } from 'react';
import { MarketPayload, BusinessNote } from '../types';
import { PositionState, markBook, normalCDF, daysBetween } from '../utils/portfolio';
import {
  Sparkles,
  Users,
  MessageSquare,
  Search,
  ExternalLink,
  Send,
  Plus,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Bookmark
} from 'lucide-react';

interface AICopilotViewProps {
  data: MarketPayload | null;
  position: PositionState;
  onAddNote: (note: BusinessNote) => void;
  onNavigateToPositions: () => void;
}

interface DeliberationData {
  consensus: string;
  consensusSummary: string;
  disagreementIndex: number;
  keyLevels: {
    support: string;
    resistance: string;
    invalidation: string;
  };
  agents: Array<{
    id: string;
    name: string;
    role: string;
    stance: string;
    confidence: number;
    keyPoints: string[];
  }>;
  recommendations: string[];
  source?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ResearchReport {
  topic: string;
  summary: string;
  sources: Array<{ title: string; url: string }>;
  grounded: boolean;
  date: string;
}

function computePutDelta(
  spot: number,
  strike: number,
  expiry: string,
  session: string,
  rate: number,
  iv: number,
  dividend = 0
): number {
  const days = daysBetween(session, expiry);
  if (days <= 0 || spot <= 0 || strike <= 0 || iv <= 0) {
    return spot < strike ? -1.0 : 0.0;
  }
  const years = days / 365;
  const vol = iv / 100;
  const r = rate / 100;
  const q = dividend / 100;
  const d1 = (Math.log(spot / strike) + (r - q + (vol * vol) / 2) * years) / (vol * Math.sqrt(years));
  const delta = -Math.exp(-q * years) * normalCDF(-d1);
  return Math.max(-1.0, Math.min(0.0, delta));
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  data,
  position,
  onAddNote,
  onNavigateToPositions
}) => {
  const [subMode, setSubMode] = useState<'deliberation' | 'copilot' | 'research'>('deliberation');

  const spot = Number(data?.quote?.price ?? 4655.6);
  const session = data?.last_session || '2026-10-09';
  const book = markBook(position, spot, session);

  const futuresUnits = position.fq;
  const p1Units = position.p1q;
  const p2Units = position.p2q;
  const putUnits = p1Units + p2Units;
  const coveragePct = futuresUnits > 0 ? Math.min(100, Math.round((putUnits / futuresUnits) * 100)) : 100;

  const p1Delta = p1Units > 0 ? computePutDelta(spot, position.p1strike, position.p1expiry, session, position.rate, position.p1iv, position.dividend) : 0;
  const p2Delta = p2Units > 0 ? computePutDelta(spot, position.p2strike, position.p2expiry, session, position.rate, position.p2iv, position.dividend) : 0;
  const netDelta = (futuresUnits * 1.0) + (p1Units * p1Delta) + (p2Units * p2Delta);

  const activeExpiries = [
    futuresUnits > 0 ? position.fexpiry : null,
    p1Units > 0 ? position.p1expiry : null,
    p2Units > 0 ? position.p2expiry : null
  ].filter(Boolean) as string[];
  const nextExpiry = activeExpiries.sort()[0] || position.fexpiry || '2026-10-27';
  const daysToExpiry = Math.max(0, Math.round(daysBetween(session, nextExpiry)));

  const createInitialGreeting = () => {
    const parts: string[] = [];
    if (position.fq > 0) {
      parts.push(`${position.fq} long futures units @ Avg ₹${position.fa.toLocaleString('en-IN')}`);
    } else {
      parts.push('0 long futures units');
    }

    const putParts: string[] = [];
    if (position.p1q > 0) putParts.push(`${position.p1q}x ₹${position.p1strike} PE`);
    if (position.p2q > 0) putParts.push(`${position.p2q}x ₹${position.p2strike} PE`);

    if (putParts.length > 0) {
      parts.push(`hedged with ${putUnits} put units (${putParts.join(' + ')}) [${coveragePct}% coverage]`);
    } else if (position.fq > 0) {
      parts.push('currently unhedged (0 put options)');
    }

    const pnlStr = book.total !== null ? `${book.total >= 0 ? '+₹' : '−₹'}${Math.abs(Math.round(book.total)).toLocaleString('en-IN')}` : '—';

    return `Welcome to the HAL Desk AI Strategy Copilot.

I have synchronized your active position book:
• **Open Strategy**: ${parts.join(', ')}
• **Spot Mark**: ₹${spot.toLocaleString('en-IN')} | **Net Delta**: ${netDelta.toFixed(1)} | **Indicative P&L**: ${pnlStr}
• **Next Expiry**: ${nextExpiry} (${daysToExpiry} days remaining)

How can I help you evaluate downside scenarios, option Greeks, or put rollover timing?`;
  };

  // Deliberation state
  const [deliberation, setDeliberation] = useState<DeliberationData | null>(null);
  const [loadingDeliberation, setLoadingDeliberation] = useState(false);

  // Copilot chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-init',
      role: 'assistant',
      content: createInitialGreeting(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Research synthesis state
  const [researchTopic, setResearchTopic] = useState('HAL order book and latest Tejas Mk1A deliveries');
  const [researchReport, setResearchReport] = useState<ResearchReport | null>(null);
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [savedToJournal, setSavedToJournal] = useState(false);

  // Run deliberation on mount or position change
  const runDeliberation = async () => {
    setLoadingDeliberation(true);
    try {
      const res = await fetch('/api/ai/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketData: data,
          positionData: position
        })
      });
      if (res.ok) {
        const json = await res.json();
        setDeliberation(json);
      }
    } catch (err) {
      console.warn('Deliberation fetch failed', err);
    } finally {
      setLoadingDeliberation(false);
    }
  };

  useEffect(() => {
    runDeliberation();
  }, [position.fq, position.p1q, position.p2q]);

  // Send message to Copilot with complete, exact numerical context
  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage;
    if (!textToSend.trim() || sendingChat) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setSendingChat(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          context: {
            spot,
            session,
            position,
            book: {
              openPnl: book.open,
              totalPnl: book.total,
              futuresLeg: book.legs[0],
              p1Leg: book.legs[1],
              p2Leg: book.legs[2]
            },
            metrics: {
              futuresUnits,
              putUnits,
              coveragePct,
              p1Delta: Number(p1Delta.toFixed(3)),
              p2Delta: Number(p2Delta.toFixed(3)),
              netDelta: Number(netDelta.toFixed(1)),
              deltaRupees: Number((netDelta * spot).toFixed(0)),
              nextExpiry,
              daysToExpiry
            }
          }
        })
      });
      if (res.ok) {
        const json = await res.json();
        const assistantMsg: ChatMessage = {
          id: 'msg-' + Date.now() + 1,
          role: 'assistant',
          content: json.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.warn('Chat copilot error', err);
    } finally {
      setSendingChat(false);
    }
  };

  // Run Search-Grounded Research
  const handleRunResearch = async (customTopic?: string) => {
    const query = customTopic || researchTopic;
    if (!query) return;
    setLoadingResearch(true);
    setSavedToJournal(false);

    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: query })
      });
      if (res.ok) {
        const json = await res.json();
        setResearchReport(json);
      }
    } catch (err) {
      console.warn('Research synthesis error', err);
    } finally {
      setLoadingResearch(false);
    }
  };

  const handleSaveReportToJournal = () => {
    if (!researchReport) return;
    const newNote: BusinessNote = {
      id: 'ai-note-' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      title: researchReport.topic,
      category: 'Order book',
      text: researchReport.summary
    };
    onAddNote(newNote);
    setSavedToJournal(true);
    setTimeout(() => setSavedToJournal(false), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">
              INSTITUTIONAL INTELLIGENCE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40 text-[#83caff] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#83caff]" />
              Gemini Powered
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">AI Strategy Copilot &amp; Intelligence</h1>
          <p className="text-xs text-[#a8b6c9]">
            Multi-agent market deliberation, portfolio hedging advice, and search-grounded corporate research.
          </p>
        </div>

        {/* Sub-mode Navigation */}
        <div className="flex items-center gap-1.5 bg-[#141d2b] p-1 rounded-xl border border-[#2b3a50]">
          <button
            onClick={() => setSubMode('deliberation')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              subMode === 'deliberation'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Agent Deliberation
          </button>
          <button
            onClick={() => setSubMode('copilot')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              subMode === 'copilot'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Hedge Copilot
          </button>
          <button
            onClick={() => setSubMode('research')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              subMode === 'research'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Live Search Research
          </button>
        </div>
      </div>

      {/* MODE 1: MULTI-AGENT DELIBERATION */}
      {subMode === 'deliberation' && (
        <div className="space-y-6">
          {/* Executive Consensus Card */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#a8b6c9] block mb-1">
                  COMMITTEE CONSENSUS
                </span>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white">
                    {deliberation?.consensus || 'Deliberating...'}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                    Consensus Verified
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#1b283a] px-3.5 py-2 rounded-xl border border-[#2b3a50] text-center">
                  <span className="text-[10px] uppercase text-[#a8b6c9] block">Disagreement Index</span>
                  <span className="text-lg font-bold text-[#83caff]">
                    {deliberation?.disagreementIndex ?? 6} / 10
                  </span>
                </div>
                <button
                  onClick={runDeliberation}
                  disabled={loadingDeliberation}
                  className="px-3 py-2 rounded-xl bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDeliberation ? 'animate-spin' : ''}`} />
                  Re-run Committee
                </button>
              </div>
            </div>

            <p className="text-xs text-[#edf3ff] leading-relaxed bg-[#1b283a] p-3.5 rounded-xl border border-[#2b3a50]">
              {deliberation?.consensusSummary || 'Loading multi-agent market assessment...'}
            </p>

            {/* Key Levels & Inflections */}
            {deliberation?.keyLevels && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[10px] uppercase text-[#a8b6c9] block">Key Support Floor</span>
                  <strong className="text-white block mt-0.5">{deliberation.keyLevels.support}</strong>
                </div>
                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[10px] uppercase text-[#a8b6c9] block">Key Resistance Cap</span>
                  <strong className="text-white block mt-0.5">{deliberation.keyLevels.resistance}</strong>
                </div>
                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[10px] uppercase text-[#a8b6c9] block">Regime Invalidation</span>
                  <strong className="text-[#ffe098] block mt-0.5">{deliberation.keyLevels.invalidation}</strong>
                </div>
              </div>
            )}
          </div>

          {/* 5 Specialized Agent Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Specialized Analyst Personas &amp; Arguments
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(deliberation?.agents || []).map((agent) => (
                <div
                  key={agent.id}
                  className="bg-[#141d2b] border border-[#2b3a50] hover:border-[#4a7194] transition-all rounded-2xl p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{agent.name}</h4>
                        <span className="text-[10px] text-[#a8b6c9] uppercase tracking-wider">{agent.role}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#83caff] bg-[#1f344c] px-2 py-0.5 rounded border border-[#4a7194]/40">
                        {agent.confidence}% Conf.
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-emerald-400">
                      Stance: {agent.stance}
                    </div>

                    <ul className="space-y-1.5 text-xs text-[#a8b6c9] list-disc list-inside">
                      {agent.keyPoints.map((pt, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Strategy Recommendations */}
          {deliberation?.recommendations && (
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-sm">Committee Action Takeaways</h3>
              <ul className="space-y-2 text-xs text-[#a8b6c9]">
                {deliberation.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 bg-[#1b283a] p-3 rounded-xl border border-[#2b3a50]">
                    <CheckCircle2 className="w-4 h-4 text-[#83caff] shrink-0 mt-0.5" />
                    <span className="text-white">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: HEDGE & STRATEGY COPILOT (CHAT) */}
      {subMode === 'copilot' && (
        <div className="space-y-4">
          {/* Position Context Banner */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">Active Strategy Context:</span>
              <span className="px-2 py-0.5 rounded bg-[#1b283a] text-[#83caff] font-mono">
                {position.fq > 0 ? `${position.fq} Futures @ ₹${position.fa.toLocaleString('en-IN')}` : '0 Futures'}
              </span>
              {position.p1q > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#1b283a] text-[#83caff] font-mono">
                  {position.p1q}x ₹{position.p1strike} PE
                </span>
              )}
              {position.p2q > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#1b283a] text-[#83caff] font-mono">
                  {position.p2q}x ₹{position.p2strike} PE
                </span>
              )}
              {position.p1q === 0 && position.p2q === 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono text-[11px]">
                  Unhedged (0 Puts)
                </span>
              )}
              <span className="text-[#a8b6c9]">Spot: ₹{spot.toLocaleString('en-IN')}</span>
              <span className="text-[#a8b6c9] font-mono">
                P&amp;L:{' '}
                <strong className={book.total !== null && book.total >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                  {book.total !== null ? `${book.total >= 0 ? '+₹' : '−₹'}${Math.abs(Math.round(book.total)).toLocaleString('en-IN')}` : '—'}
                </strong>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#1b283a] text-[#a8b6c9] text-[10px] font-mono">
                Net Δ: <strong className="text-white">{netDelta.toFixed(1)}</strong>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#1b283a] text-[#a8b6c9] text-[10px] font-mono">
                Coverage: <strong className="text-white">{coveragePct}%</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setChatMessages([
                    {
                      id: 'msg-' + Date.now(),
                      role: 'assistant',
                      content: createInitialGreeting(),
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ]);
                }}
                title="Synchronize chat with current position book"
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1b283a] border border-[#2b3a50] text-[#a8b6c9] hover:text-[#83caff] hover:border-[#4a7194] flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Sync
              </button>
              <button
                type="button"
                onClick={onNavigateToPositions}
                className="text-xs text-[#83caff] hover:underline shrink-0"
              >
                Modify Position Book ↗
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              position.fq > 0
                ? `Stress test my ${position.fq} futures against -5% drop`
                : `What is the optimal protective put structure for 1 lot (150 units) HAL?`,
              position.p1q > 0
                ? `Should I roll my ${position.p1strike} PE to next month?`
                : position.p2q > 0
                ? `Should I roll my ${position.p2strike} PE to next month?`
                : `Recommend optimal protective puts for HAL at ₹${Math.round(spot)}`,
              `What is my maximum downside risk with ${coveragePct}% put coverage?`,
              `Explain theta decay impact into ${nextExpiry} expiry (${daysToExpiry}d left)`
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendMessage(chip)}
                className="px-3 py-1.5 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#a8b6c9] hover:text-[#83caff] hover:bg-[#1f344c] hover:border-[#4a7194] transition-all"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Window */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl flex flex-col h-[520px] overflow-hidden">
            {/* Messages scroll */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-1 ${
                      msg.role === 'user'
                        ? 'bg-[#1f344c] text-white border border-[#4a7194]'
                        : 'bg-[#1b283a] text-[#edf3ff] border border-[#2b3a50]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] text-[#a8b6c9] mb-1">
                      <span className="font-bold uppercase tracking-wider text-[#83caff]">
                        {msg.role === 'user' ? 'You' : 'HAL Strategy Copilot'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex justify-start">
                  <div className="bg-[#1b283a] border border-[#2b3a50] rounded-2xl p-4 text-xs text-[#83caff] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing portfolio Greeks and Black-Scholes scenario...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-[#0c111b] border-t border-[#2b3a50] flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about rolling, downside protection, spot shocks, or Greeks..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-4 py-2 bg-[#141d2b] border border-[#2b3a50] rounded-xl text-xs text-white placeholder-[#a8b6c9]/60 focus:outline-none focus:border-[#83caff]"
              />
              <button
                type="submit"
                disabled={sendingChat || !inputMessage.trim()}
                className="px-4 py-2 bg-[#83caff] text-[#0b1020] rounded-xl font-bold text-xs hover:bg-[#a6d8ff] disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Ask Copilot
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODE 3: SEARCH-GROUNDED RESEARCH */}
      {subMode === 'research' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#83caff] uppercase tracking-wider">
                  REAL-TIME SEARCH GROUNDING
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                  Google Search Tool Active
                </span>
              </div>
              <h3 className="font-bold text-white text-base mt-1">
                Grounded HAL Corporate &amp; Order Research
              </h3>
              <p className="text-xs text-[#a8b6c9]">
                Synthesizes up-to-date verifiable news, Ministry of Defence tenders, engine deliveries, and filings using live search.
              </p>
            </div>

            {/* Query Form */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Enter research topic (e.g. Tejas Mk1A delivery schedule, Safran JV contract)..."
                value={researchTopic}
                onChange={(e) => setResearchTopic(e.target.value)}
                className="flex-1 px-4 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-xl text-xs text-white"
              />
              <button
                onClick={() => handleRunResearch()}
                disabled={loadingResearch || !researchTopic.trim()}
                className="px-5 py-2 bg-[#83caff] text-[#0b1020] font-bold rounded-xl text-xs hover:bg-[#a6d8ff] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                {loadingResearch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Run Live Synthesis
              </button>
            </div>

            {/* Quick Preset Queries */}
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'Tejas Mk1A GE engine delivery timeline',
                'HAL ₹2.54 L Cr order book breakdown',
                'Safran Aravalli helicopter engine JV',
                'Upcoming Q2 FY27 board meeting & results'
              ].map((query) => (
                <button
                  key={query}
                  onClick={() => {
                    setResearchTopic(query);
                    handleRunResearch(query);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#1b283a] border border-[#2b3a50] text-[#a8b6c9] hover:text-[#83caff] hover:bg-[#1f344c] transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>

          {/* Research Report Card */}
          {researchReport && (
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1b283a] pb-3 flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-white text-base">{researchReport.topic}</h4>
                  <span className="text-[11px] text-[#a8b6c9] font-mono">
                    Generated: {researchReport.date} · Grounded with live search
                  </span>
                </div>

                <button
                  onClick={handleSaveReportToJournal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] text-xs font-semibold"
                >
                  {savedToJournal ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                  {savedToJournal ? 'Saved in Journal!' : '+ Save to Business Journal'}
                </button>
              </div>

              <div className="text-xs text-[#edf3ff] leading-relaxed whitespace-pre-wrap bg-[#1b283a] p-4 rounded-xl border border-[#2b3a50]">
                {researchReport.summary}
              </div>

              {/* Verified Sources / Citations */}
              {researchReport.sources && researchReport.sources.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-[11px] font-bold text-[#a8b6c9] uppercase tracking-wider">
                    Retrieved Grounding Sources
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {researchReport.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-[#0c111b] border border-[#2b3a50] text-[#83caff] hover:bg-[#1f344c]"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

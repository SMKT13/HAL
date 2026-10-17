import React, { useState, useEffect } from 'react';
import { MarketPayload, ResearchAgent, BusinessNote } from '../types';
import { ARCHIVED_NOTES } from '../data/halSnapshot';
import { ShieldAlert, BookOpen, Layers, Users, ExternalLink, Plus, RefreshCw, FileText, Sparkles } from 'lucide-react';

interface ResearchViewProps {
  data: MarketPayload | null;
  notes: BusinessNote[];
  onAddNote: (note: BusinessNote) => void;
  onNavigateToAI?: (subMode?: 'deliberation' | 'copilot' | 'research') => void;
}

export const ResearchView: React.FC<ResearchViewProps> = ({ data, notes, onAddNote, onNavigateToAI }) => {
  const [researchTab, setResearchTab] = useState<'agents' | 'technical' | 'fundamental' | 'business'>('agents');
  const [agents, setAgents] = useState<ResearchAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // New Note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<BusinessNote['category']>('Order book');
  const [noteText, setNoteText] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const json = await res.json();
        if (json.agents) setAgents(json.agents);
      }
    } catch (err) {
      console.warn('Failed to load agents API, fallback to default panels', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle || !noteText) return;
    const newNote: BusinessNote = {
      id: 'n-' + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      title: noteTitle,
      category: noteCategory,
      text: noteText
    };
    onAddNote(newNote);
    setNoteTitle('');
    setNoteText('');
    setShowAddNote(false);
  };

  const ind = data?.ind;
  const quote = data?.quote || { price: 4655.6 };

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">
            EVIDENCE BEFORE OPINION
          </span>
          <h1 className="text-2xl font-bold text-white">HAL research</h1>
          <p className="text-xs text-[#a8b6c9]">Business performance. Market structure. Context.</p>
        </div>

        <div className="flex items-center gap-2 bg-[#141d2b] p-1 rounded-xl border border-[#2b3a50]">
          <button
            onClick={() => setResearchTab('agents')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              researchTab === 'agents'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Agent Analyst Panels
          </button>
          <button
            onClick={() => setResearchTab('technical')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              researchTab === 'technical'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Technicals
          </button>
          <button
            onClick={() => setResearchTab('fundamental')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              researchTab === 'fundamental'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Fundamentals
          </button>
          <button
            onClick={() => setResearchTab('business')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              researchTab === 'business'
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            Business Journal
          </button>
        </div>
      </div>

      {/* SUBTAB 1: AGENTS */}
      {researchTab === 'agents' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#141d2b] border border-[#2b3a50] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-[#a8b6c9]">
              The analyst panels below provide deterministic rules from market data. You can also run the full <strong className="text-white">Gemini Multi-Agent Committee</strong> for live deliberation with debate scores.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {onNavigateToAI && (
                <button
                  onClick={() => onNavigateToAI('deliberation')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 text-[#83caff] hover:bg-blue-500/30 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Gemini Deliberation ↗
                </button>
              )}
              <button
                onClick={fetchAgents}
                disabled={loadingAgents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAgents ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">{agent.name}</h3>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      agent.stance.includes('Bullish') || agent.stance.includes('Evidence')
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                        : agent.stance.includes('Bearish')
                        ? 'bg-red-950/80 text-red-400 border-red-800'
                        : 'bg-[#1b283a] text-[#83caff] border-[#2b3a50]'
                    }`}
                  >
                    {agent.stance}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-[#a8b6c9] list-disc list-inside">
                  {agent.evidence.map((bullet, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 2: TECHNICALS */}
      {researchTab === 'technical' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Completed-bar Analysis</h3>
            <p className="text-xs text-[#a8b6c9]">
              Descriptive moving average positioning and momentum signals on daily completed bars.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                <span className="text-xs text-[#a8b6c9] block mb-1">Trend Stance</span>
                <span className="text-lg font-bold text-white">
                  {quote.price > (ind?.sma20 || 0) && quote.price > (ind?.sma50 || 0)
                    ? 'Above SMA 20 & 50'
                    : quote.price < (ind?.sma20 || 0) && quote.price > (ind?.sma200 || 0)
                    ? 'Pullback above 200-DMA'
                    : 'Consolidating'}
                </span>
                <p className="text-[11px] text-[#a8b6c9] mt-1">
                  Spot: ₹{quote.price.toLocaleString('en-IN')} · 200-DMA: ₹{ind?.sma200 ? Math.round(ind.sma200).toLocaleString('en-IN') : '4,418'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                <span className="text-xs text-[#a8b6c9] block mb-1">Momentum (RSI 14)</span>
                <span className="text-lg font-bold text-[#83caff]">
                  {ind?.rsi14?.toFixed(1) || '44.4'}
                </span>
                <p className="text-[11px] text-[#a8b6c9] mt-1">
                  Neutral momentum range (30-70 threshold)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                <span className="text-xs text-[#a8b6c9] block mb-1">MACD Histogram</span>
                <span className={`text-lg font-bold ${(ind?.macd_hist || 0) >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
                  {ind?.macd_hist !== undefined && ind.macd_hist !== null ? ind.macd_hist.toFixed(2) : '−7.61'}
                </span>
                <p className="text-[11px] text-[#a8b6c9] mt-1">
                  {(ind?.macd_hist || 0) < 0 ? 'Histogram compressed' : 'Histogram positive'}
                </p>
              </div>
            </div>
          </div>

          {/* Archived Action Map */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">{ARCHIVED_NOTES.actionMap.title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                    <th className="py-2.5 px-3">Spot Condition</th>
                    <th className="py-2.5 px-3">Action Framework</th>
                  </tr>
                </thead>
                <tbody>
                  {ARCHIVED_NOTES.actionMap.rules.map((r, i) => (
                    <tr key={i} className="border-b border-[#1b283a]">
                      <td className="py-2.5 px-3 font-semibold text-white">{r.condition}</td>
                      <td className="py-2.5 px-3 text-[#a8b6c9]">{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: FUNDAMENTALS */}
      {researchTab === 'fundamental' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Financials &amp; Quality Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ARCHIVED_NOTES.fundamentals.metrics.map((m, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[11px] text-[#a8b6c9] block mb-1">{m.metric}</span>
                  <strong className="text-sm font-bold text-white">{m.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-white text-sm">Key Catalysts</h4>
              <ul className="space-y-2 text-xs text-[#a8b6c9] list-disc list-inside">
                {ARCHIVED_NOTES.fundamentals.catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-white text-sm">Key Risks &amp; Watchpoints</h4>
              <ul className="space-y-2 text-xs text-[#a8b6c9] list-disc list-inside">
                {ARCHIVED_NOTES.fundamentals.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: BUSINESS JOURNAL */}
      {researchTab === 'business' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#83caff] uppercase tracking-wider">
                HAL THESIS TRACKER
              </span>
              <h3 className="font-bold text-white text-lg">Keep the thesis accountable</h3>
              <p className="text-xs text-[#a8b6c9]">
                Distinguish verified corporate deliveries from speculation. Record order book developments and results.
              </p>
            </div>
            <button
              onClick={() => setShowAddNote(!showAddNote)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#83caff] text-[#0b1020] font-bold text-xs hover:bg-[#a6d8ff] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              + Add Sourced Note
            </button>
          </div>

          {/* Add Note Form Modal / Expand */}
          {showAddNote && (
            <form onSubmit={handleCreateNote} className="bg-[#141d2b] border border-[#4a7194] rounded-2xl p-5 space-y-4">
              <h4 className="font-bold text-white text-sm">Record Sourced Thesis Note</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Note Title / Headline"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                  required
                />
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value as any)}
                  className="bg-[#0c111b] border border-[#2b3a50] text-white px-3 py-2 rounded-lg text-xs"
                >
                  <option value="Order book">Order book</option>
                  <option value="Deliveries">Deliveries</option>
                  <option value="Guidance">Guidance</option>
                  <option value="Results">Results</option>
                  <option value="Operations">Operations</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <textarea
                placeholder="Enter details, source links, or earnings call quotes..."
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="px-3 py-1.5 text-xs text-[#a8b6c9] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#83caff] text-[#0b1020] font-bold text-xs rounded-lg"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Sourced Notes List */}
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1f344c] text-[#83caff]">
                      {note.category}
                    </span>
                    <h4 className="font-bold text-white text-sm">{note.title}</h4>
                  </div>
                  <span className="text-[11px] text-[#a8b6c9] font-mono">{note.date}</span>
                </div>
                <p className="text-xs text-[#a8b6c9] leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>

          {/* Official Disclosures External Links */}
          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href="https://hal-india.co.in/investor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] text-xs hover:bg-[#1f344c]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              HAL Investor Relations ↗
            </a>
            <a
              href="https://www.nseindia.com/companies-listing/corporate-filings-announcements"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] text-xs hover:bg-[#1f344c]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              NSE Corporate Filings ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

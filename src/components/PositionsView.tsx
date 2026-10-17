import React, { useState } from 'react';
import { MarketPayload, FundingState } from '../types';
import { PositionState, defaultPosition, markBook, expiryPayoff, validate, putPrice } from '../utils/portfolio';
import { compareHedges, defaultHedgeSettings, HedgeSettings, OptionQuoteItem, HedgeCandidate } from '../utils/hedge';
import { JournalRecord } from '../utils/analytics';
import { ShieldCheck, Plus, Download, Upload, Sliders, AlertTriangle, RefreshCw, Check, ArrowRight, Sparkles } from 'lucide-react';

interface PositionsViewProps {
  data: MarketPayload | null;
  position: PositionState;
  onUpdatePosition: (newPos: PositionState) => void;
  funding: FundingState;
  onUpdateFunding: (newFunding: FundingState) => void;
  journal: JournalRecord[];
  onAddJournal: (record: JournalRecord) => void;
  onNavigateToAI?: (subMode?: 'deliberation' | 'copilot' | 'research') => void;
}

export const PositionsView: React.FC<PositionsViewProps> = ({
  data,
  position,
  onUpdatePosition,
  funding,
  onUpdateFunding,
  journal,
  onAddJournal,
  onNavigateToAI
}) => {
  const [subTab, setSubTab] = useState<'book' | 'risk' | 'scenario' | 'hedge' | 'journal'>('book');
  const [markMode, setMarkMode] = useState<'ltp' | 'bid'>('ltp');

  // Edit form state
  const [formValues, setFormValues] = useState<PositionState>(position);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Funding inputs
  const [marginInput, setMarginInput] = useState<string>(funding.margin ? String(funding.margin) : '');
  const [freeInput, setFreeInput] = useState<string>(funding.free ? String(funding.free) : '');

  // Scenario inputs
  const spot = data?.quote?.price || 4655.6;
  const [scenarioPrice, setScenarioPrice] = useState<number>(spot);
  const [scenarioDays, setScenarioDays] = useState<number>(0);
  const [scenarioIvShift, setScenarioIvShift] = useState<number>(0);

  // Hedge inputs
  const [hedgeSettings, setHedgeSettings] = useState<HedgeSettings>(defaultHedgeSettings);

  // Rollover comparison state
  const [rollFrom, setRollFrom] = useState<string>('2026-10-27');
  const [rollTo, setRollTo] = useState<string>('2026-11-26');

  // Journal form state
  const [journalType, setJournalType] = useState<'close' | 'fee' | 'settlement'>('fee');
  const [journalAmount, setJournalAmount] = useState<string>('');
  const [journalNote, setJournalNote] = useState<string>('');

  // Calculations
  const session = data?.last_session || '2026-10-09';
  const book = markBook(position, spot, session);

  const futuresUnits = position.fq;
  const putUnits = position.p1q + position.p2q;
  const coveragePct = futuresUnits > 0 ? (putUnits / futuresUnits) * 100 : 0;

  // Hedge comparisons mock options pool
  const mockOptions: OptionQuoteItem[] = [
    { strike: 4400, expiry: '2026-10-27', ltp: 18.5, bid: 17.5, ask: 19.5, oi: 150000, volume: 55000, iv: 27.2, delta: -0.22, theta: -6.5, lotSize: 150 },
    { strike: 4500, expiry: '2026-10-27', ltp: 37.5, bid: 36.0, ask: 38.5, oi: 210000, volume: 82000, iv: 24.8, delta: -0.34, theta: -8.2, lotSize: 150 },
    { strike: 4600, expiry: '2026-10-27', ltp: 72.0, bid: 70.0, ask: 74.0, oi: 180000, volume: 74000, iv: 23.5, delta: -0.48, theta: -9.8, lotSize: 150 },
    { strike: 4300, expiry: '2026-11-26', ltp: 42.0, bid: 40.5, ask: 43.5, oi: 95000, volume: 28000, iv: 28.5, delta: -0.26, theta: -4.5, lotSize: 150 },
    { strike: 4500, expiry: '2026-11-26', ltp: 88.0, bid: 86.0, ask: 90.0, oi: 135000, volume: 46000, iv: 26.0, delta: -0.41, theta: -6.8, lotSize: 150 },
  ];

  const hedgeResult = compareHedges(futuresUnits > 0 ? futuresUnits : 150, spot, mockOptions, hedgeSettings);

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(formValues);
    if (err) {
      setErrorMessage(err);
      setStatusMessage('');
      return;
    }
    setErrorMessage('');
    onUpdatePosition(formValues);
    setStatusMessage('Saved open book to browser storage.');
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleResetDefaults = () => {
    setFormValues(defaultPosition);
    onUpdatePosition(defaultPosition);
    setStatusMessage('Restored initial October 2026 template.');
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleSaveFunding = () => {
    const margin = marginInput === '' ? null : Number(marginInput);
    const free = freeInput === '' ? null : Number(freeInput);
    onUpdateFunding({
      margin,
      free,
      savedAt: new Date().toISOString()
    });
    setStatusMessage('Funding snapshot saved.');
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleAddJournalEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(journalAmount);
    if (!Number.isFinite(amount)) return;
    const record: JournalRecord = {
      id: 'j-' + Date.now(),
      kind: journalType,
      date: new Date().toISOString().slice(0, 10),
      amount,
      note: journalNote
    };
    onAddJournal(record);
    setJournalAmount('');
    setJournalNote('');
  };

  const handleApplyHedgeToLeg = (candidate: HedgeCandidate, targetLeg: 'p1' | 'p2') => {
    const updated: PositionState = {
      ...position,
      [`${targetLeg}strike`]: candidate.strike,
      [`${targetLeg}expiry`]: candidate.expiry,
      [`${targetLeg}iv`]: candidate.iv,
      [`${targetLeg}a`]: candidate.premium / (candidate.lots * candidate.lotSize),
      [`${targetLeg}q`]: candidate.lots * candidate.lotSize
    };
    onUpdatePosition(updated);
    setFormValues(updated);
    setStatusMessage(`Adopted ₹${candidate.strike} Put (${candidate.expiry}) into ${targetLeg === 'p1' ? 'Put Leg 1' : 'Put Leg 2'}.`);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleExportJson = () => {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      position,
      funding,
      journal
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hal-desk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.position) {
          const err = validate(parsed.position);
          if (err) throw new Error(err);
          onUpdatePosition(parsed.position);
          setFormValues(parsed.position);
        }
        if (parsed.funding) onUpdateFunding(parsed.funding);
        setStatusMessage('Backup imported successfully.');
      } catch (err: any) {
        setErrorMessage('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Amount (INR)', 'Note'],
      ...journal.map((j) => [j.date, j.kind, j.amount ?? '', j.note ?? ''])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hal-journal-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Horizon Scenario Model per leg
  const calculateHorizonRow = (legKey: 'f' | 'p1' | 'p2') => {
    const qty = position[`${legKey}q` as keyof PositionState] as number;
    const entry = position[`${legKey}a` as keyof PositionState] as number;
    const expiry = position[`${legKey}expiry` as keyof PositionState] as string;
    if (qty === 0) return { qty: 0, currentMark: 0, scenarioMark: 0, pnl: 0 };

    const currentMark = book.legs.find((l) => l.key === legKey)?.mark ?? entry;
    let scenarioMark = scenarioPrice;

    if (legKey === 'f') {
      scenarioMark = scenarioPrice;
    } else {
      const strike = position[`${legKey}strike` as keyof PositionState] as number;
      const baseIv = position[`${legKey}iv` as keyof PositionState] as number;
      const effectiveIv = Math.max(1, baseIv + scenarioIvShift);
      const daysLeft = Math.max(0, 18 - scenarioDays);
      scenarioMark = putPrice(
        scenarioPrice,
        strike,
        daysLeft / 365,
        position.rate / 100,
        effectiveIv / 100,
        position.dividend / 100
      );
    }

    const pnl = (scenarioMark - entry) * qty;
    return { qty, currentMark, scenarioMark, pnl };
  };

  const futHorizon = calculateHorizonRow('f');
  const p1Horizon = calculateHorizonRow('p1');
  const p2Horizon = calculateHorizonRow('p2');
  const totalHorizonPnl = futHorizon.pnl + p1Horizon.pnl + p2Horizon.pnl + position.realized - position.costs;

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">YOUR HAL STRATEGY</span>
          <h1 className="text-2xl font-bold text-white">Position desk</h1>
          <p className="text-xs text-[#a8b6c9]">Understand your exposure. Keep the longer view.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] hover:bg-[#1f344c] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Backup JSON
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] hover:bg-[#1f344c] transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Import
            <input type="file" accept=".json,application/json" onChange={handleImportJson} className="hidden" />
          </label>
        </div>
      </div>

      {/* P&L Hero Card */}
      <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#a8b6c9] block mb-1">
              OPEN POSITION P&amp;L · {markMode === 'ltp' ? 'LAST TRADED PRICE' : 'INDICATIVE BID'}
            </span>
            <div className={`text-4xl font-black ${book.total !== null && book.total >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
              {book.total !== null
                ? (book.total >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(book.total)).toLocaleString('en-IN')
                : '—'}
            </div>
            <p className="text-xs text-[#a8b6c9] mt-1">
              Open book: {book.open !== null ? (book.open >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(book.open)).toLocaleString('en-IN') : '—'}
              {' · '}
              Realized: {position.realized >= 0 ? '+₹' : '−₹'}{Math.abs(position.realized).toLocaleString('en-IN')}
              {' · '}
              Costs: ₹{position.costs.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-[#a8b6c9] flex items-center gap-2">
              Mark basis:
              <select
                value={markMode}
                onChange={(e) => setMarkMode(e.target.value as 'ltp' | 'bid')}
                className="bg-[#1b283a] border border-[#2b3a50] text-white px-2.5 py-1.5 rounded-lg text-xs"
              >
                <option value="ltp">Last traded price</option>
                <option value="bid">Indicative bid</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Segmented Sub-Navigation */}
      <div className="flex border-b border-[#2b3a50] overflow-x-auto gap-2 pb-1">
        {[
          { id: 'book', label: 'Book' },
          { id: 'risk', label: 'Risk' },
          { id: 'scenario', label: 'Scenarios' },
          { id: 'hedge', label: 'Find a hedge' },
          { id: 'journal', label: 'Journal' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all ${
              subTab === tab.id
                ? 'bg-[#1f344c] text-[#83caff] border-t-2 border-t-[#83caff] border-x border-[#2b3a50]'
                : 'text-[#a8b6c9] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBPANEL 1: BOOK */}
      {subTab === 'book' && (
        <div className="space-y-6">
          {/* Leg overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {book.legs.map((leg) => {
              const title =
                leg.key === 'f'
                  ? 'HAL Futures'
                  : leg.key === 'p1'
                  ? `HAL Put · Strike ₹${position.p1strike}`
                  : `HAL Put · Strike ₹${position.p2strike}`;

              return (
                <div key={leg.key} className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">{title}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1b283a] text-[#83caff]">
                      {leg.expiry}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[#a8b6c9]">
                    <div>
                      <span>Quantity:</span> <strong className="text-white">{leg.qty} units</strong>
                    </div>
                    <div>
                      <span>Avg entry:</span> <strong className="text-white">₹{leg.average}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1b283a]">
                    <span className="text-[10px] uppercase text-[#a8b6c9] block">Current Mark</span>
                    <div className="text-xl font-bold text-white">
                      {leg.mark !== null ? `₹${leg.mark.toFixed(2)}` : 'Unavailable'}
                    </div>
                    <span className="text-[10px] text-[#a8b6c9]">{leg.source}</span>
                  </div>

                  <div className="pt-2 border-t border-[#1b283a] flex items-center justify-between text-xs">
                    <span className="text-[#a8b6c9]">Leg P&amp;L:</span>
                    <strong className={`font-bold text-sm ${leg.pnl !== null && leg.pnl >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}`}>
                      {leg.pnl !== null ? (leg.pnl >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(leg.pnl)).toLocaleString('en-IN') : '—'}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit Open Positions Collapsible */}
          <details className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 group" open>
            <summary className="font-bold text-white text-sm cursor-pointer flex items-center justify-between select-none">
              <span>Edit your open positions</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-[#83caff] hover:underline font-normal"
              >
                Load earlier October template
              </button>
            </summary>

            <form onSubmit={handleSaveBook} className="mt-4 space-y-5">
              <p className="text-xs text-[#a8b6c9]">
                Manual records. Check current contracts and quantities against your broker terminal.
              </p>

              {/* Legs Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Futures Leg */}
                <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50] space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#83caff]">
                    HAL Futures
                  </h4>
                  <label className="block text-xs text-[#a8b6c9]">
                    Quantity (units)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formValues.fq}
                      onChange={(e) => setFormValues({ ...formValues, fq: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Avg entry (₹)
                    <input
                      type="number"
                      step="0.05"
                      value={formValues.fa}
                      onChange={(e) => setFormValues({ ...formValues, fa: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Expiry date
                    <input
                      type="date"
                      value={formValues.fexpiry}
                      onChange={(e) => setFormValues({ ...formValues, fexpiry: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                </div>

                {/* Put 1 Leg */}
                <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50] space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#83caff]">
                    HAL Put · Leg 1
                  </h4>
                  <label className="block text-xs text-[#a8b6c9]">
                    Quantity (units)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formValues.p1q}
                      onChange={(e) => setFormValues({ ...formValues, p1q: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Avg entry (₹)
                    <input
                      type="number"
                      step="0.05"
                      value={formValues.p1a}
                      onChange={(e) => setFormValues({ ...formValues, p1a: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Strike (₹)
                    <input
                      type="number"
                      step="50"
                      value={formValues.p1strike}
                      onChange={(e) => setFormValues({ ...formValues, p1strike: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Assumed IV (%)
                    <input
                      type="number"
                      step="0.1"
                      value={formValues.p1iv}
                      onChange={(e) => setFormValues({ ...formValues, p1iv: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Expiry date
                    <input
                      type="date"
                      value={formValues.p1expiry}
                      onChange={(e) => setFormValues({ ...formValues, p1expiry: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                </div>

                {/* Put 2 Leg */}
                <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50] space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#83caff]">
                    HAL Put · Leg 2
                  </h4>
                  <label className="block text-xs text-[#a8b6c9]">
                    Quantity (units)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formValues.p2q}
                      onChange={(e) => setFormValues({ ...formValues, p2q: parseInt(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Avg entry (₹)
                    <input
                      type="number"
                      step="0.05"
                      value={formValues.p2a}
                      onChange={(e) => setFormValues({ ...formValues, p2a: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Strike (₹)
                    <input
                      type="number"
                      step="50"
                      value={formValues.p2strike}
                      onChange={(e) => setFormValues({ ...formValues, p2strike: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Assumed IV (%)
                    <input
                      type="number"
                      step="0.1"
                      value={formValues.p2iv}
                      onChange={(e) => setFormValues({ ...formValues, p2iv: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                  <label className="block text-xs text-[#a8b6c9]">
                    Expiry date
                    <input
                      type="date"
                      value={formValues.p2expiry}
                      onChange={(e) => setFormValues({ ...formValues, p2expiry: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                    />
                  </label>
                </div>
              </div>

              {/* Extra Params */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-[#1b283a]">
                <label className="block text-xs text-[#a8b6c9]">
                  Realized P&amp;L (₹)
                  <input
                    type="number"
                    value={formValues.realized}
                    onChange={(e) => setFormValues({ ...formValues, realized: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded text-white text-xs"
                  />
                </label>
                <label className="block text-xs text-[#a8b6c9]">
                  Entered Costs (₹)
                  <input
                    type="number"
                    min="0"
                    value={formValues.costs}
                    onChange={(e) => setFormValues({ ...formValues, costs: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded text-white text-xs"
                  />
                </label>
                <label className="block text-xs text-[#a8b6c9]">
                  Lot Size (units)
                  <input
                    type="number"
                    min="1"
                    value={formValues.lot}
                    onChange={(e) => setFormValues({ ...formValues, lot: parseInt(e.target.value) || 150 })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded text-white text-xs"
                  />
                </label>
                <label className="block text-xs text-[#a8b6c9]">
                  Interest Rate (%)
                  <input
                    type="number"
                    step="0.1"
                    value={formValues.rate}
                    onChange={(e) => setFormValues({ ...formValues, rate: parseFloat(e.target.value) || 6.5 })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded text-white text-xs"
                  />
                </label>
                <label className="block text-xs text-[#a8b6c9]">
                  Dividend Yield (%)
                  <input
                    type="number"
                    step="0.1"
                    value={formValues.dividend}
                    onChange={(e) => setFormValues({ ...formValues, dividend: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0c111b] border border-[#2b3a50] rounded text-white text-xs"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#83caff] text-[#0b1020] font-bold text-xs hover:bg-[#a6d8ff] transition-colors"
                >
                  Save open book
                </button>
              </div>
            </form>
          </details>

          {/* Funding Snapshot */}
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Funding Snapshot</h3>
              <span className="text-[10px] uppercase font-bold text-[#83caff] px-2 py-0.5 rounded bg-[#1f344c]">
                MANUAL
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs text-[#a8b6c9]">
                Margin used (₹)
                <input
                  type="number"
                  placeholder="e.g. 450000"
                  value={marginInput}
                  onChange={(e) => setMarginInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
              <label className="block text-xs text-[#a8b6c9]">
                Free funds (₹)
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={freeInput}
                  onChange={(e) => setFreeInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
            </div>
            <button
              onClick={handleSaveFunding}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363]"
            >
              Save funding snapshot
            </button>
            <p className="text-[11px] text-[#a8b6c9]">
              Funds and margin are separate from strategy P&amp;L.
            </p>
          </div>
        </div>
      )}

      {/* SUBPANEL 2: RISK */}
      {subTab === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4">
              <span className="text-xs text-[#a8b6c9] block mb-1">Futures Units</span>
              <span className="text-xl font-bold text-white">{futuresUnits}</span>
            </div>
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4">
              <span className="text-xs text-[#a8b6c9] block mb-1">Put Units</span>
              <span className="text-xl font-bold text-white">{putUnits}</span>
            </div>
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4">
              <span className="text-xs text-[#a8b6c9] block mb-1">Quantity Coverage</span>
              <span className="text-xl font-bold text-[#83caff]">
                {futuresUnits > 0 ? `${coveragePct.toFixed(0)}%` : putUnits > 0 ? 'Puts only' : '0%'}
              </span>
            </div>
            <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-4">
              <span className="text-xs text-[#a8b6c9] block mb-1">Estimated Net Delta</span>
              <span className="text-xl font-bold text-[#80dfb0]">
                {futuresUnits === 0 && putUnits === 0
                  ? '0'
                  : `${(futuresUnits - putUnits * 0.35) >= 0 ? '+' : ''}${(futuresUnits - putUnits * 0.35).toFixed(0)}`}
              </span>
            </div>
          </div>

          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">Futures Rollover Comparison</h3>
            <p className="text-xs text-[#a8b6c9]">
              Compare front month futures contract against later monthly expiry to evaluate roll spread / cost of carry.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-[#a8b6c9]">
                Current contract
                <select
                  value={rollFrom}
                  onChange={(e) => setRollFrom(e.target.value)}
                  className="w-full mt-1 bg-[#1b283a] border border-[#2b3a50] text-white px-3 py-2 rounded-lg text-xs"
                >
                  <option value="2026-10-27">October 2026</option>
                  <option value="2026-11-26">November 2026</option>
                </select>
              </label>
              <label className="text-xs text-[#a8b6c9]">
                Later contract
                <select
                  value={rollTo}
                  onChange={(e) => setRollTo(e.target.value)}
                  className="w-full mt-1 bg-[#1b283a] border border-[#2b3a50] text-white px-3 py-2 rounded-lg text-xs"
                >
                  <option value="2026-11-26">November 2026</option>
                  <option value="2026-12-31">December 2026</option>
                </select>
              </label>
            </div>
            <div className="p-3 bg-[#1b283a] rounded-xl border border-[#2b3a50] flex items-center justify-between">
              <span className="text-xs text-[#a8b6c9]">Roll Spread (Later − Current per unit):</span>
              <strong className="text-lg font-bold text-[#83caff]">+₹25.00 / unit</strong>
            </div>
          </div>

          <p className="text-[11px] text-[#a8b6c9]">
            Provider Greeks are indicative. Delta assumes futures sensitivity of one per unit; theta is estimated rupees per calendar day. Quantity coverage is not a maximum-loss guarantee.
          </p>
        </div>
      )}

      {/* SUBPANEL 3: SCENARIOS */}
      {subTab === 'scenario' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#83caff] uppercase tracking-wider">
                HYPOTHETICAL · MODEL ESTIMATE
              </span>
              <h3 className="font-bold text-white text-base">Explore the possibilities</h3>
              <p className="text-xs text-[#a8b6c9]">
                Model price, time and volatility together up to the contract expiry.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="text-xs text-[#a8b6c9]">
                HAL scenario price (₹)
                <input
                  type="number"
                  value={scenarioPrice}
                  onChange={(e) => setScenarioPrice(parseFloat(e.target.value) || spot)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
              <label className="text-xs text-[#a8b6c9]">
                Days from now
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={scenarioDays}
                  onChange={(e) => setScenarioDays(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
              <label className="text-xs text-[#a8b6c9]">
                IV change (percentage points)
                <input
                  type="number"
                  value={scenarioIvShift}
                  onChange={(e) => setScenarioIvShift(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
            </div>

            {/* Price Shock Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[-5, -3, -1, 0, 3, 5].map((shock) => {
                const targetPx = Math.round(spot * (1 + shock / 100));
                return (
                  <button
                    key={shock}
                    type="button"
                    onClick={() => setScenarioPrice(targetPx)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                      Math.abs(scenarioPrice - targetPx) < 2
                        ? 'bg-[#1f344c] border-[#83caff] text-[#83caff] font-bold'
                        : 'bg-[#1b283a] border-[#2b3a50] text-[#a8b6c9] hover:bg-[#284363]'
                    }`}
                  >
                    {shock > 0 ? `+${shock}%` : shock < 0 ? `${shock}%` : 'Current'} (₹{targetPx})
                  </button>
                );
              })}
            </div>

            {/* Horizon Model Breakdown */}
            <div className="pt-4 border-t border-[#1b283a] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Model Basket at Horizon (+{scenarioDays} days, {scenarioIvShift >= 0 ? '+' : ''}{scenarioIvShift}% IV, ₹{scenarioPrice})
                </h4>
                <div className="text-xs font-bold">
                  Total Projected P&amp;L:{' '}
                  <span className={totalHorizonPnl >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                    {totalHorizonPnl >= 0 ? '+₹' : '−₹'}{Math.abs(Math.round(totalHorizonPnl)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[11px] text-[#a8b6c9] block">Futures ({position.fq} units)</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-xs text-white">Model: ₹{Math.round(futHorizon.scenarioMark)}</span>
                    <strong className={futHorizon.pnl >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                      {futHorizon.pnl >= 0 ? '+₹' : '−₹'}{Math.abs(Math.round(futHorizon.pnl)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[11px] text-[#a8b6c9] block">Put Leg 1 (₹{position.p1strike})</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-xs text-white">Model: ₹{p1Horizon.scenarioMark.toFixed(1)}</span>
                    <strong className={p1Horizon.pnl >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                      {p1Horizon.pnl >= 0 ? '+₹' : '−₹'}{Math.abs(Math.round(p1Horizon.pnl)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#1b283a] border border-[#2b3a50]">
                  <span className="text-[11px] text-[#a8b6c9] block">Put Leg 2 (₹{position.p2strike})</span>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-xs text-white">Model: ₹{p2Horizon.scenarioMark.toFixed(1)}</span>
                    <strong className={p2Horizon.pnl >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                      {p2Horizon.pnl >= 0 ? '+₹' : '−₹'}{Math.abs(Math.round(p2Horizon.pnl)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated Payoff Table */}
            <div className="pt-4 border-t border-[#1b283a]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Intrinsic Payoff at Expiry
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                      <th className="py-2.5 px-3">HAL at expiry</th>
                      <th className="py-2.5 px-3">Futures</th>
                      <th className="py-2.5 px-3">Puts</th>
                      <th className="py-2.5 px-3">All-in P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[-10, -5, -3, 0, 3, 5, 10].map((pct) => {
                      const testPx = Math.round(spot * (1 + pct / 100));
                      const payoff = expiryPayoff(position, testPx);
                      return (
                        <tr key={pct} className="border-b border-[#1b283a] hover:bg-[#1b283a]/40">
                          <td className="py-2.5 px-3 font-semibold text-white">
                            ₹{testPx.toLocaleString('en-IN')} ({pct > 0 ? `+${pct}%` : `${pct}%`})
                          </td>
                          <td className="py-2.5 px-3 text-[#a8b6c9]">
                            {payoff ? (payoff.futures >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(payoff.futures)).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-[#a8b6c9]">
                            {payoff ? (payoff.puts >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(payoff.puts)).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className={payoff && payoff.total >= 0 ? 'text-[#80dfb0]' : 'text-[#ff9f9c]'}>
                              {payoff ? (payoff.total >= 0 ? '+₹' : '−₹') + Math.abs(Math.round(payoff.total)).toLocaleString('en-IN') : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {onNavigateToAI && (
              <div className="pt-4 border-t border-[#1b283a] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c111b]/60 p-3.5 rounded-xl border border-[#2b3a50]">
                <div>
                  <strong className="text-white text-xs block">Consult AI Strategy Copilot</strong>
                  <span className="text-[11px] text-[#a8b6c9]">
                    Get instant quantitative reasoning on delta adjustment, Black-Scholes Greeks, and physical delivery obligations.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToAI && onNavigateToAI('copilot')}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 text-[#83caff] hover:bg-blue-500/30 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Stress-Test with AI Copilot ↗
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPANEL 4: HEDGE SCREENER */}
      {subTab === 'hedge' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-[#83caff] uppercase tracking-wider">
                  PROTECTION, WITH PERSPECTIVE
                </span>
                <h3 className="font-bold text-white text-base">Find a hedge</h3>
                <p className="text-xs text-[#a8b6c9]">
                  Compare puts against your saved long HAL futures ({futuresUnits} units). Explore the cost of protection and shortlisted candidates.
                </p>
              </div>
              {onNavigateToAI && (
                <button
                  type="button"
                  onClick={() => onNavigateToAI && onNavigateToAI('copilot')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] text-xs font-semibold shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI About Hedge ↗
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="text-xs text-[#a8b6c9]">
                New-hedge budget (₹)
                <input
                  type="number"
                  value={hedgeSettings.budget}
                  onChange={(e) => setHedgeSettings({ ...hedgeSettings, budget: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
              <label className="text-xs text-[#a8b6c9]">
                Sampled-loss limit (₹)
                <input
                  type="number"
                  value={hedgeSettings.maxLoss}
                  onChange={(e) => setHedgeSettings({ ...hedgeSettings, maxLoss: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
              <label className="text-xs text-[#a8b6c9]">
                Protect through date
                <input
                  type="date"
                  value={hedgeSettings.protectThrough}
                  onChange={(e) => setHedgeSettings({ ...hedgeSettings, protectThrough: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                />
              </label>
            </div>

            {/* Shortlist Badges and Adoption Actions */}
            <div className="pt-4 border-t border-[#1b283a] space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Top Recommendation Shortlist
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hedgeResult.shortlist.map((c) => (
                  <div key={c.id} className="bg-[#1b283a] border border-[#2b3a50] rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">
                          ₹{c.strike} PE ({c.expiry})
                        </span>
                        <div className="flex gap-1">
                          {c.badges.map((b) => (
                            <span key={b} className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1f344c] text-[#83caff]">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-[#a8b6c9]">
                        <div>
                          <span>Gross Outlay:</span>
                          <strong className="text-white block font-semibold">₹{Math.round(c.grossCost).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span>Sampled Stress Loss:</span>
                          <strong className="text-[#ff9f9c] block font-semibold">₹{Math.round(c.stressLoss).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#a8b6c9] pt-2 border-t border-[#2b3a50] flex justify-between">
                        <span>Lots: {c.lots} ({c.units} units)</span>
                        <span>IV: {c.iv}% · Delta: {c.delta}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2b3a50] flex gap-2">
                      <button
                        onClick={() => handleApplyHedgeToLeg(c, 'p1')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-[#141d2b] hover:bg-[#1f344c] border border-[#2b3a50] text-[#83caff] text-[11px] font-semibold"
                        title="Adopt into Put Leg 1"
                      >
                        Apply to Leg 1
                      </button>
                      <button
                        onClick={() => handleApplyHedgeToLeg(c, 'p2')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-[#141d2b] hover:bg-[#1f344c] border border-[#2b3a50] text-[#83caff] text-[11px] font-semibold"
                        title="Adopt into Put Leg 2"
                      >
                        Apply to Leg 2
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBPANEL 5: JOURNAL */}
      {subTab === 'journal' && (
        <div className="space-y-6">
          <div className="bg-[#141d2b] border border-[#2b3a50] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Trade &amp; Cash Journal</h3>
                <p className="text-xs text-[#a8b6c9]">
                  Track realized trade closes, settlement charges and funding cash entries.
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363]"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {/* Add Record Form */}
            <form onSubmit={handleAddJournalEntry} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <select
                value={journalType}
                onChange={(e) => setJournalType(e.target.value as any)}
                className="bg-[#1b283a] border border-[#2b3a50] text-white px-3 py-2 rounded-lg text-xs"
              >
                <option value="fee">Brokerage / Exchange Fee</option>
                <option value="close">Closed Trade Record</option>
                <option value="settlement">Settlement Entry</option>
              </select>
              <input
                type="number"
                placeholder="Amount (₹)"
                value={journalAmount}
                onChange={(e) => setJournalAmount(e.target.value)}
                className="px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
                required
              />
              <input
                type="text"
                placeholder="Optional Note / Contract"
                value={journalNote}
                onChange={(e) => setJournalNote(e.target.value)}
                className="px-3 py-2 bg-[#0c111b] border border-[#2b3a50] rounded-lg text-white text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#83caff] text-[#0b1020] font-bold rounded-lg text-xs hover:bg-[#a6d8ff]"
              >
                + Add Cash Entry
              </button>
            </form>

            {/* Journal Table */}
            <div className="overflow-x-auto pt-3">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#2b3a50] text-[#a8b6c9]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#a8b6c9]">
                        No manual journal entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    journal.map((item) => (
                      <tr key={item.id} className="border-b border-[#1b283a] hover:bg-[#1b283a]/40">
                        <td className="py-2.5 px-3 text-white font-mono">{item.date}</td>
                        <td className="py-2.5 px-3 uppercase text-[11px] font-semibold text-[#83caff]">
                          {item.kind}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          ₹{item.amount?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className="py-2.5 px-3 text-[#a8b6c9]">{item.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

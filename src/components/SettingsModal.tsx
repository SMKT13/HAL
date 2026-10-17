import React from 'react';
import { MarketPayload } from '../types';
import { X, ShieldCheck, Download, Upload, FileText, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  onChangeTheme: (theme: string) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: (val: boolean) => void;
  data: MarketPayload | null;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onChangeTheme,
  autoRefresh,
  onToggleAutoRefresh,
  data,
  onExportBackup,
  onImportBackup
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141d2b] border border-[#2b3a50] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1b283a] pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Your desk settings</h2>
            <p className="text-xs text-[#a8b6c9]">HAL Desk configuration and data management.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#a8b6c9] hover:text-white hover:bg-[#1b283a]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Appearance & Refresh */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white block mb-1.5">Appearance</label>
            <select
              value={theme}
              onChange={(e) => onChangeTheme(e.target.value)}
              className="w-full bg-[#1b283a] border border-[#2b3a50] rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="dark">Graphite dark (Default)</option>
              <option value="light">Paper light</option>
              <option value="system">Follow device</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#a8b6c9] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => onToggleAutoRefresh(e.target.checked)}
              className="rounded bg-[#1b283a] border-[#2b3a50] text-[#83caff] focus:ring-0"
            >
            </input>
            <span>Auto-refresh market quotes every 60 seconds while open</span>
          </label>
        </div>

        {/* Connection */}
        <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50] space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Connection Architecture
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Active / Fallback Ready
            </span>
          </div>
          <p className="text-xs text-[#a8b6c9]">
            Read-only market data via Yahoo Finance chart proxy with local fallback to the verified 09-Oct-2026 snapshot.
          </p>
        </div>

        {/* Backup & Portability */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Backup &amp; Portability
          </h3>
          <p className="text-xs text-[#a8b6c9]">
            Back up positions, journal, and notes. Financial data is kept strictly inside your browser local storage.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onExportBackup}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363]"
            >
              <Download className="w-4 h-4" />
              Save Backup
            </button>
            <label className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg bg-[#1f344c] border border-[#4a7194] text-[#83caff] hover:bg-[#284363] cursor-pointer">
              <Upload className="w-4 h-4" />
              Import Backup
              <input type="file" accept=".json,application/json" onChange={onImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* Data Health */}
        <div className="p-4 rounded-xl bg-[#1b283a] border border-[#2b3a50] space-y-2 text-xs">
          <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
            Data Health &amp; Diagnostics
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[#a8b6c9]">
            <div>
              <span>Feed Status:</span> <strong className="text-white">{data?.data_status || 'snapshot'}</strong>
            </div>
            <div>
              <span>Quote Time:</span> <strong className="text-white">{data?.quote_as_of ? new Date(data.quote_as_of).toLocaleTimeString('en-IN') : 'Cached'}</strong>
            </div>
            <div>
              <span>Daily Session:</span> <strong className="text-white">{data?.last_session || '2026-10-09'}</strong>
            </div>
            <div>
              <span>Stale Flag:</span> <strong className="text-white">{data?.stale ? 'Yes' : 'No'}</strong>
            </div>
          </div>
        </div>

        {/* Notices */}
        <details className="text-xs text-[#a8b6c9] border-t border-[#1b283a] pt-3">
          <summary className="cursor-pointer text-[#83caff] font-semibold">
            Open Source Notices &amp; Attributions
          </summary>
          <div className="mt-2 p-3 bg-[#0c111b] rounded-lg border border-[#2b3a50] space-y-1 font-mono text-[10px]">
            <p className="text-white font-bold">TradingView Lightweight Charts™</p>
            <p>Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/</p>
            <p>Licensed under the Apache License, Version 2.0.</p>
          </div>
        </details>
      </div>
    </div>
  );
};

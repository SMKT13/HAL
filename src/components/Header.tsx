import React from 'react';
import { RefreshCw, Settings, ShieldCheck, Activity, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  loading: boolean;
  dataStatus?: string;
  lastSession?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onRefresh,
  onOpenSettings,
  loading,
  dataStatus = 'snapshot',
  lastSession = '2026-10-09'
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'positions', label: 'Position Desk' },
    { id: 'markets', label: 'Markets' },
    { id: 'research', label: 'HAL Research' },
    { id: 'news', label: 'Newsroom' },
    { id: 'ai', label: 'AI Copilot', isAi: true },
  ];

  const getStatusBadge = () => {
    switch (dataStatus) {
      case 'live':
        return { label: 'LIVE / RECENT', color: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
      case 'cached':
        return { label: 'CACHED FEED', color: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
      case 'stale':
        return { label: 'STALE CACHE', color: 'bg-amber-950 text-amber-400 border-amber-800' };
      default:
        return { label: 'ARCHIVED SNAPSHOT', color: 'bg-amber-950 text-amber-400 border-amber-800' };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="border-b border-[#1b283a] bg-[#0c111b]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#83caff] to-[#3b82f6] flex items-center justify-center font-black text-[#0b1020] text-lg shadow-sm">
              H
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">
                  HAL<span className="text-[#83caff] font-normal"> Desk</span>
                </span>
                <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded border border-[#2b3a50] text-[#a8b6c9] bg-[#141d2b]">
                  NSE: HAL
                </span>
              </div>
              <p className="text-[10px] tracking-widest uppercase font-semibold text-[#83caff]">
                RESEARCH &amp; RISK
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-[#141d2b] p-1 rounded-xl border border-[#2b3a50]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#1f344c] text-[#83caff] font-semibold shadow-sm border border-[#4a7194]'
                    : tab.isAi
                    ? 'text-[#83caff] hover:text-white hover:bg-[#1b283a]'
                    : 'text-[#a8b6c9] hover:text-white hover:bg-[#1b283a]'
                }`}
              >
                {tab.isAi && <Sparkles className="w-3.5 h-3.5 text-[#83caff]" />}
                {tab.label}
                {tab.isAi && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-[#83caff] border border-blue-400/30">
                    AI
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Actions & Status */}
          <div className="flex items-center gap-2.5">
            <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${badge.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              {badge.label}
            </div>

            <span className="text-[10px] tracking-wider font-mono uppercase bg-[#141d2b] border border-[#2b3a50] text-[#a8b6c9] px-2 py-1 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#83caff]" />
              READ ONLY
            </span>

            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh Market Data"
              className="p-2 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] hover:bg-[#1f344c] hover:border-[#4a7194] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onOpenSettings}
              title="Desk Settings & Backup"
              className="p-2 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#a8b6c9] hover:text-white hover:bg-[#1f344c] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto gap-1 pt-2 pb-1 border-t border-[#1b283a] mt-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 text-xs whitespace-nowrap rounded-lg transition-all flex items-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-[#1f344c] text-[#83caff] font-semibold border border-[#4a7194]'
                  : tab.isAi
                  ? 'text-[#83caff] hover:bg-[#141d2b]'
                  : 'text-[#a8b6c9] hover:bg-[#141d2b]'
              }`}
            >
              {tab.isAi && <Sparkles className="w-3 h-3 text-[#83caff]" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

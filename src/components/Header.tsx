import React from "react";
import { RefreshCw, Settings, ShieldCheck, Sparkles } from "lucide-react";
const tabs = [
  ["overview", "Overview"],
  ["positions", "Position Desk"],
  ["markets", "Markets"],
  ["research", "HAL Research"],
  ["news", "Newsroom"],
  ["ai", "AI Copilot"],
];
export function Header({
  activeTab,
  onTabChange,
  onRefresh,
  onOpenSettings,
  loading,
  dataStatus,
}: any) {
  const status =
    dataStatus === "live"
      ? "Recent quote"
      : dataStatus === "cached"
        ? "Cached feed"
        : dataStatus === "fresh_fetch"
          ? "Provider data"
          : dataStatus === "stale"
            ? "Older data"
            : "Not connected";
  return (
    <header className="main-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark">H</span>
          <div>
            <b>
              HAL <em>Desk</em>
            </b>
            <small>RESEARCH & RISK</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={activeTab === id ? "selected" : ""}
              aria-current={activeTab === id ? "page" : undefined}
            >
              {id === "ai" && <Sparkles size={14} />} {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="status-badge">{status}</span>
          <span className="read-only">
            <ShieldCheck size={12} /> READ ONLY
          </span>
          <button
            aria-label="Refresh market data"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          <button aria-label="Desk settings" onClick={onOpenSettings}>
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

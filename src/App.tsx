import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { PositionsView } from './components/PositionsView';
import { MarketsView } from './components/MarketsView';
import { ResearchView } from './components/ResearchView';
import { NewsView } from './components/NewsView';
import { AICopilotView } from './components/AICopilotView';
import { SettingsModal } from './components/SettingsModal';
import { MarketPayload, FundingState, NewsItem, BusinessNote } from './types';
import { PositionState, defaultPosition, normalize, validate } from './utils/portfolio';
import { JournalRecord } from './utils/analytics';
import { HAL_SNAPSHOT } from './data/halSnapshot';

const POS_STORAGE_KEY = 'halpos3';
const FUNDING_STORAGE_KEY = 'halfunding';
const JOURNAL_STORAGE_KEY = 'haljournal';
const NOTES_STORAGE_KEY = 'halnotes';

const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'n-1',
    title: 'Hindustan Aeronautics: Tejas Mk1A engine deliveries progress with GE Aerospace',
    summary: 'GE Aerospace delivers additional F404-IN20 engines for the Tejas Mk1A fighter jet program, easing supply bottleneck expectations.',
    url: 'https://hal-india.co.in/investor',
    published: '09-Oct-2026',
    source: 'NSE / HAL Investor Updates',
    official: true,
    category: 'Operations',
    bookmarked: false
  },
  {
    id: 'n-2',
    title: 'HAL signs joint venture contract with Safran for Aravalli helicopter engines',
    summary: 'The joint venture focuses on indigenous design, development, and production of helicopter engines for medium-lift platforms.',
    url: 'https://hal-india.co.in/investor',
    published: '05-Oct-2026',
    source: 'Company Announcement',
    official: true,
    category: 'Orders',
    bookmarked: true
  },
  {
    id: 'n-3',
    title: 'HAL order book crosses ₹2.54 L Cr; ₹90,000 Cr pipeline under evaluation',
    summary: 'Robust defence procurement visibility spanning fighter aircraft, helicopters, avionics, and aero-engine overhauls.',
    url: 'https://hal-india.co.in/investors/financial-results',
    published: '29-Sep-2026',
    source: 'Official Corporate Release',
    official: true,
    category: 'Orders',
    bookmarked: false
  },
  {
    id: 'n-4',
    title: 'Board of Directors Meeting intimation for Q2 Financial Results',
    summary: 'Meeting scheduled in November 2026 to review Q2 FY27 standalone and consolidated results.',
    url: 'https://hal-india.co.in/investors/financial-results',
    published: '24-Sep-2026',
    source: 'NSE Corporate Filing',
    official: true,
    category: 'Results',
    bookmarked: false
  }
];

const INITIAL_NOTES: BusinessNote[] = [
  {
    id: 'note-1',
    date: '2026-10-09',
    title: 'Tejas Mk1A Engine Deliveries & Timeline',
    category: 'Deliveries',
    text: 'GE delivered 3 F404 engines in August. Rate expected to accelerate into FY27 to sustain delivery schedule of 16 aircraft annually.'
  },
  {
    id: 'note-2',
    date: '2026-10-05',
    title: 'Order Book Depth & Margin Quality',
    category: 'Order book',
    text: 'Order book stands at ₹2.54 L Cr (~8x annual revenue). Management guiding 30-31% EBITDA margins due to high-margin spares and maintenance.'
  },
  {
    id: 'note-3',
    date: '2026-09-28',
    title: 'Safran Helicopter Engine JV',
    category: 'Operations',
    text: 'Contract finalized for Aravalli engine JV to power future Indian Multi-Role Helicopter (IMRH) fleet.'
  }
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [aiSubMode, setAiSubMode] = useState<'deliberation' | 'copilot' | 'research'>('deliberation');
  const [data, setData] = useState<MarketPayload | null>(HAL_SNAPSHOT as any);
  const [loading, setLoading] = useState<boolean>(false);
  const [theme, setTheme] = useState<string>('dark');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Position book state
  const [position, setPosition] = useState<PositionState>(() => {
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY) || localStorage.getItem('halpos2');
      return normalize(saved ? JSON.parse(saved) : {});
    } catch {
      return defaultPosition;
    }
  });

  // Funding state
  const [funding, setFunding] = useState<FundingState>(() => {
    try {
      const saved = localStorage.getItem(FUNDING_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { margin: null, free: null, savedAt: null };
    } catch {
      return { margin: null, free: null, savedAt: null };
    }
  });

  // Journal state
  const [journal, setJournal] = useState<JournalRecord[]>(() => {
    try {
      const saved = localStorage.getItem(JOURNAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Notes state
  const [notes, setNotes] = useState<BusinessNote[]>(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  // News state
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);

  // Fetch market data
  const fetchData = async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch('/api/data' + (force ? '?force=1' : ''), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.quote) {
          setData(json);
        }
      }
    } catch (err) {
      console.warn('Market fetch error, retaining cache/snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Theme application
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // Periodic auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Persist position
  const handleUpdatePosition = (newPos: PositionState) => {
    setPosition(newPos);
    try {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(newPos));
    } catch (err) {
      console.warn('Failed to save position to localStorage:', err);
    }
  };

  // Persist funding
  const handleUpdateFunding = (newFunding: FundingState) => {
    setFunding(newFunding);
    try {
      localStorage.setItem(FUNDING_STORAGE_KEY, JSON.stringify(newFunding));
    } catch (err) {
      console.warn('Failed to save funding to localStorage:', err);
    }
  };

  // Persist journal
  const handleAddJournal = (record: JournalRecord) => {
    const updated = [record, ...journal];
    setJournal(updated);
    try {
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save journal to localStorage:', err);
    }
  };

  // Persist notes
  const handleAddNote = (newNote: BusinessNote) => {
    const updated = [newNote, ...notes];
    setNotes(updated);
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save notes to localStorage:', err);
    }
  };

  const handleToggleBookmark = (id: string) => {
    setNews(news.map(item => item.id === id ? { ...item, bookmarked: !item.bookmarked } : item));
  };

  const handleExportBackup = () => {
    const backup = {
      version: 3,
      exportedAt: new Date().toISOString(),
      position,
      funding,
      journal,
      notes
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hal-desk-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const doc = JSON.parse(evt.target?.result as string);
        if (doc.position) handleUpdatePosition(doc.position);
        if (doc.funding) handleUpdateFunding(doc.funding);
        if (Array.isArray(doc.journal)) setJournal(doc.journal);
        if (Array.isArray(doc.notes)) setNotes(doc.notes);
      } catch (err: any) {
        console.warn('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-[#edf3ff] flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={() => fetchData(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        loading={loading}
        dataStatus={data?.data_status}
        lastSession={data?.last_session}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-20">
        {activeTab === 'overview' && (
          <OverviewView
            data={data}
            position={position}
            onNavigate={(tab) => {
              if (tab === 'ai') setAiSubMode('copilot');
              setActiveTab(tab);
            }}
          />
        )}
        {activeTab === 'positions' && (
          <PositionsView
            data={data}
            position={position}
            onUpdatePosition={handleUpdatePosition}
            funding={funding}
            onUpdateFunding={handleUpdateFunding}
            journal={journal}
            onAddJournal={handleAddJournal}
            onNavigateToAI={(mode) => {
              setAiSubMode(mode || 'copilot');
              setActiveTab('ai');
            }}
          />
        )}
        {activeTab === 'markets' && <MarketsView data={data} />}
        {activeTab === 'research' && (
          <ResearchView
            data={data}
            notes={notes}
            onAddNote={handleAddNote}
            onNavigateToAI={(mode) => {
              setAiSubMode(mode || 'deliberation');
              setActiveTab('ai');
            }}
          />
        )}
        {activeTab === 'news' && (
          <NewsView
            news={news}
            onToggleBookmark={handleToggleBookmark}
            onRefreshNews={() => fetchData(true)}
          />
        )}
        {activeTab === 'ai' && (
          <AICopilotView
            data={data}
            position={position}
            initialSubMode={aiSubMode}
            onAddNote={handleAddNote}
            onNavigateToPositions={() => setActiveTab('positions')}
          />
        )}
      </main>

      <footer className="border-t border-[#1b283a] py-6 text-center text-xs text-[#a8b6c9] bg-[#0c111b]/80">
        <p>
          HAL Desk 2.1 · Hindustan Aeronautics (NSE: HAL) · Personal Research &amp; Risk Dashboard
        </p>
        <p className="mt-1 text-[11px] text-[#a8b6c9]/70">
          Delayed market data. Model estimates and scenarios are educational; confirm executable prices, margins, expiry, and delivery obligations with your broker.
        </p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onChangeTheme={setTheme}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        data={data}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
};

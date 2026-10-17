import React, { useState } from 'react';
import { NewsItem } from '../types';
import { Bookmark, BookmarkCheck, ExternalLink, RefreshCw, Filter } from 'lucide-react';

interface NewsViewProps {
  news: NewsItem[];
  onToggleBookmark: (id: string) => void;
  onRefreshNews: () => void;
}

export const NewsView: React.FC<NewsViewProps> = ({ news, onToggleBookmark, onRefreshNews }) => {
  const [filter, setFilter] = useState<'all' | 'official' | 'Orders' | 'Results' | 'Operations' | 'saved'>('all');

  const filteredNews = news.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'official') return item.official;
    if (filter === 'saved') return item.bookmarked;
    return item.category === filter;
  });

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#83caff] uppercase">
            THE DEVELOPMENTS THAT MATTER
          </span>
          <h1 className="text-2xl font-bold text-white">Newsroom</h1>
          <p className="text-xs text-[#a8b6c9]">HAL headlines and official company disclosures.</p>
        </div>

        <button
          onClick={onRefreshNews}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141d2b] border border-[#2b3a50] text-[#83caff] text-xs hover:bg-[#1f344c] shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh feed
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Headlines' },
          { id: 'official', label: 'Official Disclosures' },
          { id: 'Orders', label: 'Orders & Contracts' },
          { id: 'Results', label: 'Financial Results' },
          { id: 'Operations', label: 'Operations & Engines' },
          { id: 'saved', label: 'Saved Bookmarks' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f.id
                ? 'bg-[#1f344c] text-[#83caff] border border-[#4a7194]'
                : 'bg-[#141d2b] border border-[#2b3a50] text-[#a8b6c9] hover:bg-[#1b283a]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* News List */}
      <div className="space-y-4">
        {filteredNews.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#a8b6c9] bg-[#141d2b] border border-[#2b3a50] rounded-2xl">
            No headlines match the chosen filter.
          </div>
        ) : (
          filteredNews.map((item) => (
            <article
              key={item.id}
              className="bg-[#141d2b] border border-[#2b3a50] hover:border-[#4a7194] transition-colors rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.official && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wider">
                        Official NSE Filing
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1f344c] text-[#83caff] uppercase tracking-wider">
                      {item.category}
                    </span>
                    <span className="text-xs text-[#a8b6c9] font-mono">{item.published}</span>
                  </div>
                  <h3 className="font-bold text-white text-base leading-snug">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#83caff] transition-colors inline-flex items-center gap-1.5"
                    >
                      {item.title}
                      <ExternalLink className="w-3.5 h-3.5 text-[#a8b6c9]" />
                    </a>
                  </h3>
                </div>

                <button
                  onClick={() => onToggleBookmark(item.id)}
                  title={item.bookmarked ? 'Remove bookmark' : 'Save bookmark'}
                  className="p-1.5 rounded-lg bg-[#1b283a] text-[#83caff] hover:bg-[#1f344c] shrink-0"
                >
                  {item.bookmarked ? (
                    <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Bookmark className="w-4 h-4 text-[#a8b6c9]" />
                  )}
                </button>
              </div>

              <p className="text-xs text-[#a8b6c9] leading-relaxed">{item.summary}</p>

              <div className="pt-2 border-t border-[#1b283a] flex items-center justify-between text-[11px] text-[#a8b6c9]">
                <span>Source: {item.source}</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#83caff] hover:underline"
                >
                  Read original disclosure ↗
                </a>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

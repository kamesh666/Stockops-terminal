import React from 'react';

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLiveTicking: boolean;
  onToggleLiveTicking: () => void;
  paperPortfolioCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  isLiveTicking,
  onToggleLiveTicking,
  paperPortfolioCount,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            onTabChange('scanner');
          }}
          className="text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="text-emerald-500 font-black text-xl">₹</span>
          <span>StockOps Terminal</span>
        </a>
      </div>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          onClick={() => onTabChange('scanner')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'scanner' ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400' : ''
          }`}
        >
          Auto Scanner
        </button>
        <button
          onClick={() => onTabChange('charts')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'charts' ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400' : ''
          }`}
        >
          Interactive Charts
        </button>
        <button
          onClick={() => onTabChange('option-chain')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'option-chain' ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400' : ''
          }`}
        >
          Option Chain & Greeks
        </button>
        <button
          onClick={() => onTabChange('strategy-builder')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'strategy-builder' ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400' : ''
          }`}
        >
          Strategy Payoff Builder
        </button>
        <button
          onClick={() => onTabChange('playbook')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'playbook' ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400' : ''
          }`}
        >
          90-Day Playbook {paperPortfolioCount > 0 ? `(${paperPortfolioCount})` : ''}
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleLiveTicking}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 border ${
            isLiveTicking
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Toggle live price ticks"
        >
          {isLiveTicking ? 'Live NSE Feed: Active' : 'Live NSE Feed: Paused'}
        </button>
      </div>
    </header>
  );
};

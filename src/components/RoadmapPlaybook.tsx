import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { TradePlaybookEntry } from '../types/market';

interface RoadmapPlaybookProps {
  entries: TradePlaybookEntry[];
  onCloseTrade: (id: string, resultPnL: number) => void;
  onAddManualEntry: (entry: Omit<TradePlaybookEntry, 'id'>) => void;
}

export const RoadmapPlaybook: React.FC<RoadmapPlaybookProps> = ({
  entries,
  onCloseTrade,
  onAddManualEntry,
}) => {
  const [activeSection, setActiveSection] = useState<'journal' | 'roadmap'>('journal');
  const [selectedWeek, setSelectedWeek] = useState<number>(12);

  // New manual entry modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [symbol, setSymbol] = useState('NIFTY 50');
  const [strategyName, setStrategyName] = useState('Bull Call Spread');
  const [timeframe, setTimeframe] = useState('15m Swing');
  const [entryPrice, setEntryPrice] = useState(25140);
  const [stopLoss, setStopLoss] = useState(25020);
  const [target, setTarget] = useState(25380);
  const [positionSize, setPositionSize] = useState('2 Lots (50 Qty)');
  const [capitalDeployed, setCapitalDeployed] = useState(35000);
  const [riskAmount, setRiskAmount] = useState(6000);
  const [emotion, setEmotion] = useState<'Disciplined' | 'Cautious' | 'Aggressive' | 'Neutral'>('Disciplined');
  const [lesson, setLesson] = useState('Followed 20 EMA bounce and confirmed with positive PCR.');

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    onAddManualEntry({
      symbol,
      strategyName,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe,
      entryPrice,
      stopLoss,
      target,
      positionSize,
      capitalDeployed,
      riskAmount,
      status: 'OPEN',
      currentPnL: 0,
      emotion,
      lesson,
    });
    setIsModalOpen(false);
  };

  const handleDownloadCSV = () => {
    // Export user's completed trade journal entries for external analysis
    const completedTrades = entries.filter((t) => t.status !== 'OPEN');
    const targetTrades = completedTrades.length > 0 ? completedTrades : entries;

    if (targetTrades.length === 0) {
      return;
    }

    const headers = [
      'Trade ID',
      'Symbol',
      'Strategy',
      'Entry Date',
      'Timeframe',
      'Entry Price (INR)',
      'Stop Loss (INR)',
      'Target Price (INR)',
      'Position Size',
      'Capital Deployed (INR)',
      'Risk Amount (INR)',
      'Status',
      'Realized/Current PnL (INR)',
      'Emotional State',
      'Key Lesson & Notes',
    ];

    const csvRows = [
      headers.join(','),
      ...targetTrades.map((t) =>
        [
          `"${t.id}"`,
          `"${t.symbol}"`,
          `"${t.strategyName}"`,
          `"${t.entryDate}"`,
          `"${t.timeframe}"`,
          t.entryPrice,
          t.stopLoss,
          t.target,
          `"${t.positionSize}"`,
          t.capitalDeployed,
          t.riskAmount,
          `"${t.status}"`,
          t.currentPnL,
          `"${t.emotion}"`,
          `"${(t.lesson || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stockops_trade_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ROADMAP_WEEKS = [
    {
      week: 1,
      month: 'Month 1: Foundation',
      title: 'Stock Market Basics',
      topics: ['NSE & BSE Architecture', 'NIFTY & SENSEX', 'Market participants', 'Order types (Market, Limit, SL, GTT)', 'Market timings (9:15 - 3:30 IST)'],
      practical: 'Open and understand a trading platform, practice simulated paper orders.',
      outcome: 'Understand why 95% lose money and master the 3 structural solutions.',
    },
    {
      week: 2,
      month: 'Month 1: Foundation',
      title: 'Investing & Trading Fundamentals',
      topics: ['Investing vs Swing vs Intraday', 'Market capitalization (Large, Mid, Small)', 'Liquidity & Volume', 'Volatility & Risk-Reward calculation'],
      practical: 'Take 5 companies and analyze market cap, sector, and risk dynamics.',
      outcome: 'Define clear market participant persona and strategy lane.',
    },
    {
      week: 3,
      month: 'Month 1: Foundation',
      title: 'Fundamental Analysis',
      topics: ['Revenue, Profit, EBITDA, EPS', 'P/E, P/B, ROE, ROCE ratios', 'Debt-to-equity & Cash flows', 'Promoter and Institutional holdings'],
      practical: 'Build fundamental analysis score sheet for top Nifty company.',
      outcome: 'Know what you actually own before trading derivatives.',
    },
    {
      week: 4,
      month: 'Month 1: Foundation',
      title: 'Technical Analysis Foundation',
      topics: ['Candlestick anatomy & psychology', 'Timeframes (Multi-timeframe sync)', 'Trends: Higher Highs / Lower Lows', 'Support & Resistance zones', 'Breakouts & Breakdowns'],
      practical: 'Identify trends, key levels, and volume confirmations across 20 charts.',
      outcome: 'Read naked price charts without reliance on external tipsters.',
    },
    {
      week: 5,
      month: 'Month 2: Become a Trader',
      title: 'Price Action & Market Structure',
      topics: ['Market Structure & BOS (Break of Structure)', 'Demand & Supply zones', 'Consolidation & Range expansion', 'Retest & Rejection triggers', 'Price + Volume relationships'],
      practical: 'Identify: Trend → Structure → Key Level → Trigger → Invalidity.',
      outcome: 'Understand why price is moving rather than watching flickering candles.',
    },
    {
      week: 6,
      month: 'Month 2: Become a Trader',
      title: 'Build a Swing Trading System',
      topics: ['Stock scanning workflow', 'Setup identification', 'Precision Entry & Invalidation Stop', 'Target & Risk/Reward formula', 'Position sizing & Exit rules'],
      practical: 'Formulate system: SETUP → ENTRY → STOP → TARGET → SIZE → EXIT.',
      outcome: 'Master one repeatable systematic setup over ten random guesses.',
    },
    {
      week: 7,
      month: 'Month 2: Become a Trader',
      title: 'Risk Management & Trading Psychology',
      topics: ['1-2% Risk per trade rule', 'Max daily & weekly loss ceilings', 'Capital preservation principle', 'FOMO, Revenge trading, Loss aversion', 'Trade Journaling protocol'],
      practical: 'Log every trade: Setup → Entry → Risk → Exit → Result → Emotion → Lesson.',
      outcome: 'Recognize that a disciplined process triumphs over any single trade.',
    },
    {
      week: 8,
      month: 'Month 2: Become a Trader',
      title: 'Advanced Technical Analysis',
      topics: ['Top-down multi-timeframe analysis (Daily → 15m → 5m)', '20 EMA, 50 SMA, 200 SMA confluence', 'RSI Divergences & Oversold bounce', 'VWAP Institutional reference', 'ATR Trailing stops'],
      practical: 'Conduct comprehensive multi-timeframe confluence analysis.',
      outcome: 'Develop an institutional-grade top-down decision matrix.',
    },
    {
      week: 9,
      month: 'Month 3: Advanced Options',
      title: 'Futures Trading Foundation',
      topics: ['Futures contracts & Lot sizes', 'Expiry cycles & Rollover', 'Margin & Leverage dynamics', 'Mark-to-market mechanics', 'Hedging portfolio risk'],
      practical: 'Calculate risk and P&L under different spot moves and lot sizes.',
      outcome: 'Understand how leverage multiplies both reward and risk.',
    },
    {
      week: 10,
      month: 'Month 3: Advanced Options',
      title: 'Options Foundation & Greeks',
      topics: ['Call & Put mechanics', 'Strike selection (ATM, ITM, OTM)', 'Intrinsic vs Extrinsic value', 'Delta, Gamma, Theta (Time Decay), Vega (Volatility)'],
      practical: 'Inspect option chain: Strikes, Premiums, Greeks, OI and Volume.',
      outcome: 'Understand what options actually represent before risking capital.',
    },
    {
      week: 11,
      month: 'Month 3: Advanced Options',
      title: 'Advanced Options Trading Framework',
      topics: ['Option Chain OI & Change in OI', 'PCR (Put Call Ratio) interpretation', 'IV Rank & IV Percentile', 'Decision Framework: Market View → Volatility → Time → Strategy', 'Risk-defined multi-leg spreads'],
      practical: 'Construct non-directional and directional risk-defined spreads.',
      outcome: 'Cease naive "Market going up = Buy Call" gambling.',
    },
    {
      week: 12,
      month: 'Month 3: Advanced Options',
      title: 'Build YOUR Trading Playbook',
      topics: ['Market Selection criteria', 'Setup trigger & Invalidation condition', 'Capital allocation & Position sizing', 'Target profit execution & Scale-out', 'Post-trade review & Psychology audit'],
      practical: 'Combine everything into your personal codified trading system.',
      outcome: 'Become a completely independent, process-driven trader.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              StockOps 90-Day System & Trading Playbook
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              &quot;Don&apos;t collect strategies. Build a system.&quot; · &quot;Don&apos;t chase trades. Build a process.&quot;
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveSection('journal')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSection === 'journal'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Playbook Journal ({entries.length})
            </button>
            <button
              onClick={() => setActiveSection('roadmap')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSection === 'roadmap'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              12-Week Roadmap
            </button>
          </div>
        </div>

        {/* Daily Routine Reminder (from StockOps PDF page 17) */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/70">
            <span className="text-emerald-400 font-bold block">30 MIN · LEARN</span>
            <span className="text-slate-400 text-[11px]">Study one concept deeply</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/70">
            <span className="text-cyan-400 font-bold block">30 MIN · CHART</span>
            <span className="text-slate-400 text-[11px]">Analyse historical charts</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/70">
            <span className="text-purple-400 font-bold block">15 MIN · JOURNAL</span>
            <span className="text-slate-400 text-[11px]">Record entries & feelings</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/70">
            <span className="text-amber-400 font-bold block">15 MIN · REVIEW</span>
            <span className="text-slate-400 text-[11px]">Audit process & lessons</span>
          </div>
        </div>
      </div>

      {activeSection === 'journal' ? (
        /* Journal & Paper Trades View */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-white">
              Codified Trades: Setup → Entry → Stop → Target → Emotion → Lesson
            </h3>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDownloadCSV}
                disabled={entries.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Download completed trade journal entries as CSV for external analysis"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download CSV</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
              >
                + Log New Trade
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-slate-400 text-xs">
                No simulated trades in your playbook journal yet.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Use the &quot;Simulate Trade&quot; button from the Auto Scanner or click &quot;+ Log New Trade&quot; above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {entries.map((trade) => {
                const isOpen = trade.status === 'OPEN';
                const isProfit = trade.currentPnL >= 0;

                return (
                  <div
                    key={trade.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-base font-bold text-white">{trade.symbol}</span>
                          <span className="text-xs font-semibold text-emerald-400">{trade.strategyName}</span>
                          <span className="text-xs text-slate-400">· {trade.timeframe}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Entered: {trade.entryDate} · Sizing: {trade.positionSize}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                        <div>
                          <span className="text-[10px] font-sans text-slate-500 block">CURRENT P&L</span>
                          <span className={`text-base font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isProfit ? '+' : ''}₹{trade.currentPnL.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-sans text-slate-500 block">STATUS</span>
                          <span
                            className={`font-sans font-bold text-xs ${
                              isOpen ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            {trade.status}
                          </span>
                        </div>

                        {isOpen && (
                          <button
                            onClick={() => onCloseTrade(trade.id, trade.currentPnL)}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans font-semibold border border-slate-700"
                          >
                            Close Position
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Parameters Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-3 text-xs font-mono tabular-nums bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">ENTRY</span>
                        <span className="text-cyan-400 font-bold">₹{trade.entryPrice.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">STOP LOSS</span>
                        <span className="text-rose-400 font-bold">₹{trade.stopLoss.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">TARGET</span>
                        <span className="text-emerald-400 font-bold">₹{trade.target.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">CAPITAL DEPLOYED</span>
                        <span className="text-white font-bold">₹{trade.capitalDeployed.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans text-slate-500 block">RISK AT STAKE</span>
                        <span className="text-amber-400 font-bold">₹{trade.riskAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Psychology & Lesson Strip (from PDF Week 8) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">State of Mind:</span>
                        <span className="text-slate-200 font-semibold">{trade.emotion}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500 font-medium">Key Lesson:</span>
                        <span className="text-slate-300 italic">{trade.lesson}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 12-Week Roadmap Interactive Guide (from PDF) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Week Selector Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              StockOps 12-Week Progression
            </h3>
            {ROADMAP_WEEKS.map((w) => (
              <button
                key={w.week}
                onClick={() => setSelectedWeek(w.week)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                  selectedWeek === w.week
                    ? 'bg-slate-800 text-white font-bold border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
                }`}
              >
                <div>
                  <span className="text-emerald-400 font-mono mr-1.5">W{w.week}</span>
                  <span>{w.title}</span>
                </div>
                <span className="text-[10px] text-slate-500">{w.month.split(':')[0]}</span>
              </button>
            ))}
          </div>

          {/* Selected Week Deep-Dive Card */}
          {(() => {
            const currentWeekData = ROADMAP_WEEKS.find((w) => w.week === selectedWeek) || ROADMAP_WEEKS[0];
            return (
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    {currentWeekData.month} · Week {currentWeekData.week}
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {currentWeekData.title}
                  </h3>

                  <div className="mt-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Core Concepts & Framework:
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {currentWeekData.topics.map((t, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                        Practical Exercise:
                      </span>
                      <p className="text-xs text-slate-300">{currentWeekData.practical}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                        Expected Outcome:
                      </span>
                      <p className="text-xs text-slate-300">{currentWeekData.outcome}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>StockOps Philosophy: &quot;Don&apos;t depend on calls. Build your own decision-making.&quot;</span>
                  <button
                    onClick={() => setSelectedWeek(selectedWeek < 12 ? selectedWeek + 1 : 1)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
                  >
                    Next Week →
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Log Trade in Playbook Journal</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Instrument</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Strategy</label>
                  <input
                    type="text"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Entry Price (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Stop Loss (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Target (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Capital (₹)</label>
                  <input
                    type="number"
                    value={capitalDeployed}
                    onChange={(e) => setCapitalDeployed(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Risk Amount (₹)</label>
                  <input
                    type="number"
                    value={riskAmount}
                    onChange={(e) => setRiskAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Emotional State</label>
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                >
                  <option value="Disciplined">Disciplined (Rules strictly adhered)</option>
                  <option value="Cautious">Cautious (Reduced position size)</option>
                  <option value="Aggressive">Aggressive (High conviction)</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Key Lesson</label>
                <textarea
                  rows={2}
                  value={lesson}
                  onChange={(e) => setLesson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

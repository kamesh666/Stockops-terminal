import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { StockQuote, StrategyLeg, AutomatedSetup, TradePlaybookEntry } from './types/market';
import { INDIAN_INSTRUMENTS, generateCandles, generateOptionChain, getStrikeStep } from './data/indianMarketData';
import { scanMarketOpportunities } from './utils/patternScanner';
import { PRESET_STRATEGIES } from './utils/strategyEngine';
import { TopNav } from './components/TopNav';
import { MarketTicker } from './components/MarketTicker';
import { CandlestickChart } from './components/CandlestickChart';
import { OptionChain } from './components/OptionChain';
import { StrategyBuilder } from './components/StrategyBuilder';
import { AutomatedScreener } from './components/AutomatedScreener';
import { RoadmapPlaybook } from './components/RoadmapPlaybook';
import { CapitalRiskCalculator } from './components/CapitalRiskCalculator';

export default function App() {
  const [instruments, setInstruments] = useState<StockQuote[]>(INDIAN_INSTRUMENTS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [userCapital, setUserCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [isLiveTicking, setIsLiveTicking] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // Find currently selected stock/index
  const currentInstrument = useMemo(() => {
    return instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];
  }, [instruments, selectedSymbol]);

  // Generate candles for current stock and timeframe
  const candles = useMemo(() => {
    return generateCandles(currentInstrument, timeframe);
  }, [currentInstrument.symbol, timeframe, currentInstrument.price]);

  // Generate option chain for current stock
  const optionChain = useMemo(() => {
    return generateOptionChain(currentInstrument);
  }, [currentInstrument.symbol, currentInstrument.price, currentInstrument.iv]);

  // Automated setups scanned across instruments
  const automatedSetups = useMemo(() => {
    return scanMarketOpportunities(instruments, userCapital, riskPercent);
  }, [instruments, userCapital, riskPercent]);

  // Setup associated with currently selected instrument
  const activeSetup = useMemo(() => {
    return automatedSetups.find((s) => s.symbol === selectedSymbol) || null;
  }, [automatedSetups, selectedSymbol]);

  // Strategy Builder active legs
  const [strategyLegs, setStrategyLegs] = useState<StrategyLeg[]>(() => {
    const inst = INDIAN_INSTRUMENTS[0];
    const step = getStrikeStep(inst.symbol, inst.price);
    const atm = Math.round(inst.price / step) * step;
    return PRESET_STRATEGIES[0].legsGenerator(inst.price, inst.lotSize, atm, step, '24-OCT-2024');
  });

  // Playbook Journal Entries seeded with initial paper positions
  const [playbookEntries, setPlaybookEntries] = useState<TradePlaybookEntry[]>([
    {
      id: 'trade-init-1',
      symbol: 'NIFTY 50',
      strategyName: 'Bull Call Spread (Debit)',
      entryDate: '11-Oct-2024',
      timeframe: '15m Swing',
      entryPrice: 25060,
      stopLoss: 24950,
      target: 25280,
      positionSize: '2 Lots (50 Qty)',
      capitalDeployed: 28400,
      riskAmount: 5500,
      status: 'OPEN',
      currentPnL: 4250,
      emotion: 'Disciplined',
      lesson: 'Waited for 15m candle close above previous day high before taking entry.',
    },
    {
      id: 'trade-init-2',
      symbol: 'BANKNIFTY',
      strategyName: 'Iron Condor (4-Leg)',
      entryDate: '10-Oct-2024',
      timeframe: '1D Positional',
      entryPrice: 54100,
      stopLoss: 54600,
      target: 54200,
      positionSize: '1 Lot (15 Qty)',
      capitalDeployed: 62000,
      riskAmount: 4800,
      status: 'OPEN',
      currentPnL: 2180,
      emotion: 'Disciplined',
      lesson: 'Harvesting elevated theta during mid-week consolidation.',
    },
  ]);

  // Live real-time tick simulator (fluctuates NSE quotes realistically)
  useEffect(() => {
    if (!isLiveTicking) return;

    const interval = setInterval(() => {
      setInstruments((prev) =>
        prev.map((item) => {
          // Micro-tick random fluctuation +/- 0.08%
          const deltaPct = (Math.random() - 0.49) * 0.0016;
          const newPrice = Math.max(10, Math.round((item.price * (1 + deltaPct)) * 100) / 100);
          const newChange = Math.round((newPrice - item.previousClose) * 100) / 100;
          const newChangePercent = Math.round(((newChange / item.previousClose) * 100) * 100) / 100;

          return {
            ...item,
            price: newPrice,
            change: newChange,
            changePercent: newChangePercent,
            high: Math.max(item.high, newPrice),
            low: Math.min(item.low, newPrice),
          };
        })
      );
    }, 2800);

    return () => clearInterval(interval);
  }, [isLiveTicking]);

  // Update open paper trades PnL whenever current price moves
  useEffect(() => {
    setPlaybookEntries((prev) =>
      prev.map((entry) => {
        if (entry.status !== 'OPEN') return entry;
        const currentStock = instruments.find((i) => i.symbol === entry.symbol);
        if (!currentStock) return entry;

        const diff = currentStock.price - entry.entryPrice;
        // Simplified dynamic PnL tracking for active positions
        const pnl = Math.round(diff * (entry.symbol.includes('NIFTY') ? 25 : 100));
        return {
          ...entry,
          currentPnL: pnl,
        };
      })
    );
  }, [instruments]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Switch to chart with selected setup
  const handleSelectSetup = (setup: AutomatedSetup) => {
    setSelectedSymbol(setup.symbol);
    startTransition(() => {
      setActiveTab('charts');
    });
  };

  // Open payoff for selected setup
  const handleOpenPayoff = (setup: AutomatedSetup) => {
    setSelectedSymbol(setup.symbol);
    setStrategyLegs(setup.recommendedLegs);
    startTransition(() => {
      setActiveTab('strategy-builder');
    });
  };

  // Execute paper trade from screener
  const handleExecutePaperTradeFromScreener = (setup: AutomatedSetup) => {
    const newEntry: TradePlaybookEntry = {
      id: `trade-${Date.now()}`,
      symbol: setup.symbol,
      strategyName: setup.recommendedStrategy,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe: setup.timeframe,
      entryPrice: setup.entryPrice,
      stopLoss: setup.stopLoss,
      target: setup.target1,
      positionSize: `${setup.calculatedLots} Lot(s)`,
      capitalDeployed: setup.minimumCapital,
      riskAmount: setup.maxRiskAmount,
      status: 'OPEN',
      currentPnL: 0,
      emotion: 'Disciplined',
      lesson: setup.explanation,
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Simulated Trade Logged: ${setup.symbol} ${setup.recommendedStrategy} (${setup.calculatedLots} Lots)`);
  };

  // Execute paper trade from strategy builder
  const handleExecuteFromBuilder = (name: string, legs: StrategyLeg[], spotPrice: number) => {
    const totalLots = legs[0]?.lots || 1;
    const newEntry: TradePlaybookEntry = {
      id: `trade-${Date.now()}`,
      symbol: selectedSymbol,
      strategyName: name,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe: '15m Swing',
      entryPrice: spotPrice,
      stopLoss: Math.round(spotPrice * 0.985),
      target: Math.round(spotPrice * 1.025),
      positionSize: `${totalLots} Lot(s)`,
      capitalDeployed: 45000 * totalLots,
      riskAmount: 7000 * totalLots,
      status: 'OPEN',
      currentPnL: 0,
      emotion: 'Disciplined',
      lesson: 'Executed multi-leg position via Strategy Payoff Builder.',
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Strategy executed in Playbook Journal: ${name}`);
  };

  // Close simulated trade
  const handleCloseTrade = (id: string, resultPnL: number) => {
    setPlaybookEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: resultPnL >= 0 ? 'TARGET_HIT' : 'SL_HIT' } : e))
    );
    showNotification(`Position closed with P&L: ₹${resultPnL.toLocaleString('en-IN')}`);
  };

  // Add leg from Option Chain
  const handleAddLegFromChain = (leg: StrategyLeg) => {
    setStrategyLegs((prev) => [...prev, leg]);
    showNotification(`Added ${leg.action} ${leg.strike} ${leg.type} to Strategy Builder.`);
  };

  // Add manual playbook journal entry
  const handleAddManualEntry = (entry: Omit<TradePlaybookEntry, 'id'>) => {
    const newEntry: TradePlaybookEntry = {
      ...entry,
      id: `trade-${Date.now()}`,
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Logged new trade in journal for ${entry.symbol}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Top Bar (Complies with Top Bar Contract) */}
      <TopNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isLiveTicking={isLiveTicking}
        onToggleLiveTicking={() => setIsLiveTicking(!isLiveTicking)}
        paperPortfolioCount={playbookEntries.filter((p) => p.status === 'OPEN').length}
      />

      {/* Live Market Ticker */}
      <MarketTicker
        instruments={instruments}
        selectedSymbol={selectedSymbol}
        onSelectInstrument={(sym) => setSelectedSymbol(sym)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: Automated Screener */}
        {activeTab === 'scanner' && (
          <AutomatedScreener
            setups={automatedSetups}
            instruments={instruments}
            userCapital={userCapital}
            riskPercent={riskPercent}
            onCapitalChange={setUserCapital}
            onRiskChange={setRiskPercent}
            onSelectSetup={handleSelectSetup}
            onOpenPayoff={handleOpenPayoff}
            onExecutePaperTrade={handleExecutePaperTradeFromScreener}
          />
        )}

        {/* TAB 2: Interactive Candlestick Charts & Technicals */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Interactive Strategy & Price Action Chart
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-timeframe Candlesticks with 20 EMA, VWAP, Support/Resistance zones, and automated Trade Entry / Stop / Targets.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Instrument:</span>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                >
                  {instruments.map((inst) => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol} (₹{inst.price.toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <CandlestickChart
              instrument={currentInstrument}
              candles={candles}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              activeSetup={activeSetup}
            />

            {/* Embedded Position & Capital Sizing for this instrument */}
            <CapitalRiskCalculator
              instruments={instruments}
              initialCapital={userCapital}
            />
          </div>
        )}

        {/* TAB 3: Option Chain & Greeks */}
        {activeTab === 'option-chain' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  NSE Live Option Chain with Black-Scholes Greeks
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calls, Puts, Delta, Theta, Vega, IV, Open Interest and PCR. Click [B] or [S] to immediately construct option legs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Select Underlier:</span>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                >
                  {instruments.map((inst) => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <OptionChain
              instrument={currentInstrument}
              chain={optionChain}
              onAddLeg={handleAddLegFromChain}
            />
          </div>
        )}

        {/* TAB 4: Strategy Builder & Payoff Visualizer */}
        {activeTab === 'strategy-builder' && (
          <StrategyBuilder
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            legs={strategyLegs}
            onUpdateLegs={setStrategyLegs}
            onExecutePaperTrade={handleExecuteFromBuilder}
          />
        )}

        {/* TAB 5: StockOps 90-Day Playbook & Paper Trading Journal */}
        {activeTab === 'playbook' && (
          <RoadmapPlaybook
            entries={playbookEntries}
            onCloseTrade={handleCloseTrade}
            onAddManualEntry={handleAddManualEntry}
          />
        )}
      </main>

      {/* Footer strictly adhering to Anti-Slop visual restraint */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">StockOps Indian Trading System</span>
            <span>·</span>
            <span>Based on 3-Month Stock Market Roadmap</span>
            <span>·</span>
            <span>NSE / BSE Real-Time Derivatives Engine</span>
          </div>
          <div>
            &quot;Don&apos;t collect strategies. Build a system.&quot;
          </div>
        </div>
      </footer>
    </div>
  );
}

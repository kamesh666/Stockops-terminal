import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { StockQuote, StrategyLeg, AutomatedSetup, TradePlaybookEntry, AlgoSignal, MasterAlgoSignal } from './types/market';
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
import { BacktestTab } from './components/BacktestTab';
import { AlgoSignalsTab } from './components/AlgoSignalsTab';
import { MasterAlgoTab } from './components/MasterAlgoTab';
import { DeepAnalysisTab } from './components/DeepAnalysisTab';
import { HistoricalBacktest } from './components/HistoricalBacktest';
import { Analysis, DataSource, SOURCE_LABEL, api, mergeQuotes, toAppCandles } from './api/stockopsApi';
import { Candle } from './types/market';

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

  // ---- Python analysis engine (backend/) connection ----
  const [backend, setBackend] = useState<{ online: boolean; source: DataSource | null }>({ online: false, source: null });
  const [realCandles, setRealCandles] = useState<Candle[] | null>(null);
  const backendRef = React.useRef(false);
  backendRef.current = backend.online;

  // Health check: retry every 15s while offline, every 60s while online
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const h = await api.health();
        if (!cancelled) setBackend({ online: true, source: h.liveSource });
      } catch {
        if (!cancelled) setBackend({ online: false, source: null });
      }
      if (!cancelled) timer = setTimeout(check, backendRef.current ? 60000 : 15000);
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Real quotes + indicators from the engine (refresh every 60s when auto-refresh is on)
  useEffect(() => {
    if (!backend.online) return;
    let cancelled = false;
    const load = async () => {
      try {
        const q = await api.quotes();
        if (!cancelled && q.length) setInstruments((prev) => mergeQuotes(prev, q));
      } catch {
        /* keep last values */
      }
    };
    load();
    if (!isLiveTicking) return () => { cancelled = true; };
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [backend.online, isLiveTicking]);

  // Real candles for the chart tab
  useEffect(() => {
    if (!backend.online) {
      setRealCandles(null);
      return;
    }
    let cancelled = false;
    api
      .history(selectedSymbol, timeframe, 60)
      .then((h) => !cancelled && setRealCandles(toAppCandles(h.candles, timeframe)))
      .catch(() => !cancelled && setRealCandles(null));
    return () => {
      cancelled = true;
    };
  }, [backend.online, selectedSymbol, timeframe]);

  // Find currently selected stock/index
  const currentInstrument = useMemo(() => {
    return instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];
  }, [instruments, selectedSymbol]);

  // Generate candles for current stock and timeframe
  const simulatedCandles = useMemo(() => {
    return generateCandles(currentInstrument, timeframe);
  }, [currentInstrument.symbol, timeframe, currentInstrument.price]);
  const candles = realCandles && realCandles.length ? realCandles : simulatedCandles;

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
      tags: ['Breakout', 'EMA Bounce', 'Momentum'],
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
      tags: ['Theta Decay', 'Rangebound'],
    },
    {
      id: 'trade-init-3',
      symbol: 'RELIANCE',
      strategyName: 'Bull Call Spread (Debit)',
      entryDate: '08-Oct-2024',
      timeframe: '15m Swing',
      entryPrice: 2940,
      stopLoss: 2915,
      target: 2995,
      positionSize: '1 Lot (250 Qty)',
      capitalDeployed: 32500,
      riskAmount: 6250,
      status: 'TARGET_HIT',
      currentPnL: 13750,
      emotion: 'Disciplined',
      lesson: 'Target 1 hit at resistance 2995. Trailed stop loss to protect accumulated gains.',
      tags: ['Breakout', 'Support Retest'],
    },
    {
      id: 'trade-init-4',
      symbol: 'TCS',
      strategyName: 'Bull Put Spread (Credit)',
      entryDate: '04-Oct-2024',
      timeframe: '1D Positional',
      entryPrice: 4180,
      stopLoss: 4120,
      target: 4260,
      positionSize: '1 Lot (175 Qty)',
      capitalDeployed: 48000,
      riskAmount: 5200,
      status: 'CLOSED',
      currentPnL: 8400,
      emotion: 'Cautious',
      lesson: 'Closed early ahead of quarterly earnings report to eliminate binary event risk.',
      tags: ['Earnings', 'Reversal'],
    },
  ]);

  // Live real-time tick simulator (fluctuates NSE quotes realistically)
  useEffect(() => {
    // Random micro-ticks only when the real-data engine is offline
    if (!isLiveTicking || backend.online) return;

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
  }, [isLiveTicking, backend.online]);

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

  // Open backtest for selected setup
  const handleBacktestSetup = (setup: AutomatedSetup) => {
    setSelectedSymbol(setup.symbol);
    startTransition(() => {
      setActiveTab('backtest');
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
      tags: [setup.pattern.includes('Breakout') ? 'Breakout' : setup.pattern.includes('Bottom') ? 'Reversal' : 'Momentum', setup.marketView],
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
      tags: ['Options Spread', 'Payoff Strategy'],
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Strategy executed in Playbook Journal: ${name}`);
  };

  // Select signal to view on chart
  const handleSelectSignalForChart = (signal: AlgoSignal) => {
    setSelectedSymbol(signal.symbol);
    startTransition(() => {
      setActiveTab('charts');
    });
  };

  // Execute algo trade directly into playbook journal
  const handleExecuteAlgoTrade = (signal: AlgoSignal) => {
    const newEntry: TradePlaybookEntry = {
      id: `algo-trade-${Date.now()}`,
      symbol: signal.symbol,
      strategyName: `${signal.actionLabel} (${signal.algoConfidenceScore}% Algo)`,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe: signal.timeframe,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLossPrice,
      target: signal.target1,
      positionSize: `${signal.recommendedLots} Lot(s)`,
      capitalDeployed: signal.capitalRequired,
      riskAmount: signal.maxRiskAmount,
      status: 'OPEN',
      currentPnL: 0,
      emotion: 'Disciplined',
      lesson: `Algo 80%+ Confirmed: ${signal.patternName}. Invalidation: ${signal.invalidationTrigger}`,
      tags: ['Algo Radar', signal.patternName.includes('Breakdown') ? 'Reversal' : 'Breakout', signal.contractCallOrPut === 'CE' ? 'Call Momentum' : 'Put Breakdown'],
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Algo Trade Executed: ${signal.actionLabel} (${signal.recommendedLots} Lots)`);
  };

  // Backtest signal across 30 days
  const handleBacktestSignal = (signal: AlgoSignal) => {
    setSelectedSymbol(signal.symbol);
    startTransition(() => {
      setActiveTab('backtest');
    });
  };

  // Select Master signal to view on chart
  const handleSelectMasterSignalForChart = (signal: MasterAlgoSignal) => {
    setSelectedSymbol(signal.symbol);
    startTransition(() => {
      setActiveTab('charts');
    });
  };

  // Execute Master Algo trade into playbook journal
  const handleExecuteMasterTrade = (signal: MasterAlgoSignal) => {
    const newEntry: TradePlaybookEntry = {
      id: `master-trade-${Date.now()}`,
      symbol: signal.symbol,
      strategyName: `${signal.tradeAction} (Master Algo ${signal.masterConfidenceScore}%)`,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe: signal.timeframe,
      entryPrice: signal.entryPrice,
      stopLoss: signal.hardStopLoss,
      target: signal.target1,
      positionSize: `${signal.capitalSizing.recommendedLots} Lot(s) (${signal.capitalSizing.shares} Qty)`,
      capitalDeployed: signal.capitalSizing.capitalRequired,
      riskAmount: signal.capitalSizing.maxRiskAmount,
      status: 'OPEN',
      currentPnL: 0,
      emotion: 'Disciplined',
      lesson: `6-Pillar Confluence (TrendSpider AVWAP + Squeeze, CMC Ichimoku + Fib, TradingComputers POC, Investopedia Greeks). ${signal.invalidationLevel}`,
      tags: ['Master Algo', signal.squeezeStatus.includes('FIRING') ? 'Squeeze Fired' : 'AVWAP Defense', 'Institutional'],
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Master Algo Executed: ${signal.tradeAction} (${signal.capitalSizing.recommendedLots} Lots)`);
  };

  // Backtest Master signal
  const handleBacktestMasterSignal = (signal: MasterAlgoSignal) => {
    setSelectedSymbol(signal.symbol);
    startTransition(() => {
      setActiveTab('backtest');
    });
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

  // Log a Deep Analysis trade plan into the playbook journal
  const handleLogAnalysisPlan = (a: Analysis) => {
    const p = a.tradePlan;
    if (p.direction === 'none' || p.entry == null || p.stop == null || !p.targets) return;
    const newEntry: TradePlaybookEntry = {
      id: `analysis-${Date.now()}`,
      symbol: a.symbol,
      strategyName: `${p.direction === 'long' ? 'Long' : 'Short'} · ${a.confluence.verdict} (${a.confluence.score.toFixed(0)})`,
      entryDate: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframe: a.interval === '1D' ? '1D Positional' : `${a.interval} Swing`,
      entryPrice: p.entry,
      stopLoss: p.stop,
      target: p.targets[0],
      positionSize: p.lots ? `${p.lots} Lot(s) (${p.quantity} Qty)` : `${p.quantity} Qty`,
      capitalDeployed: Math.round(p.notional ?? 0),
      riskAmount: Math.round((p.riskPerShare ?? 0) * (p.quantity ?? 0)),
      status: 'OPEN',
      currentPnL: 0,
      emotion: 'Disciplined',
      lesson: `Grade ${p.grade}, checklist ${p.checklistPassed}/${p.checklist.length}. ${a.regime.title}; ${a.stage.stage} stage. ${p.entryTrigger ?? ''}`,
      tags: ['Deep Analysis', ...a.setups.filter((s) => s.active && s.bias !== 'neutral').map((s) => s.name).slice(0, 2)],
    };
    setPlaybookEntries((prev) => [newEntry, ...prev]);
    showNotification(`Trade plan logged: ${a.symbol} ${p.direction.toUpperCase()} (grade ${p.grade})`);
  };

  // Open an engine-recommended option strategy in the payoff builder
  const handleOpenStrategy = (strategyId: string, symbol: string) => {
    const preset = PRESET_STRATEGIES.find((p) => p.id === strategyId);
    const inst = instruments.find((i) => i.symbol === symbol);
    if (!preset || !inst) {
      showNotification('That strategy is not available in the payoff builder.');
      return;
    }
    const step = getStrikeStep(inst.symbol, inst.price);
    const atm = Math.round(inst.price / step) * step;
    setSelectedSymbol(symbol);
    setStrategyLegs(preset.legsGenerator(inst.price, inst.lotSize, atm, step, 'NEXT-EXPIRY'));
    startTransition(() => setActiveTab('strategy-builder'));
    window.scrollTo({ top: 0 });
    showNotification(`Loaded ${preset.name} for ${symbol}`);
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

  // Update custom tags on an existing playbook entry for post-trade analysis
  const handleUpdateEntryTags = (id: string, tags: string[]) => {
    setPlaybookEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, tags } : e))
    );
    showNotification('Journal entry tags updated.');
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
        dataStatus={{
          online: backend.online,
          label: backend.online && backend.source ? `Data: ${SOURCE_LABEL[backend.source]}` : 'Data: Simulated',
        }}
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
            onBacktestSetup={handleBacktestSetup}
          />
        )}

        {/* Deep Analysis: Python engine on real history */}
        {activeTab === 'deep-analysis' && (
          <DeepAnalysisTab
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            userCapital={userCapital}
            riskPercent={riskPercent}
            backendOnline={backend.online}
            onLogPlan={handleLogAnalysisPlan}
            onOpenStrategy={handleOpenStrategy}
          />
        )}

        {/* TAB 2: Master Algo (6-Pillar Institutional Confluence) */}
        {activeTab === 'master-algo' && (
          <MasterAlgoTab
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            userCapital={userCapital}
            onSelectSignalForChart={handleSelectMasterSignalForChart}
            onExecuteMasterTrade={handleExecuteMasterTrade}
            onBacktestSignal={handleBacktestMasterSignal}
          />
        )}

        {/* TAB 3: Algo Radar (80%+ Strong Technique Scanner) */}
        {activeTab === 'algo-signals' && (
          <AlgoSignalsTab
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            userCapital={userCapital}
            onSelectSignalForChart={handleSelectSignalForChart}
            onExecuteAlgoTrade={handleExecuteAlgoTrade}
            onBacktestSignal={handleBacktestSignal}
          />
        )}

        {/* TAB 3: Interactive Candlestick Charts & Technicals */}
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

        {/* TAB 5: 30-Day Historical Volatility Backtest */}
        {activeTab === 'backtest' && backend.online && (
          <HistoricalBacktest
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            userCapital={userCapital}
          />
        )}
        {activeTab === 'backtest' && !backend.online && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200">
            Historical backtests on real NSE data need the Python engine. Run <code className="text-white">npm run api</code> in a second terminal.
            The simulated options backtest below still works offline.
          </div>
        )}
        {activeTab === 'backtest' && (
          <BacktestTab
            instruments={instruments}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            userCapital={userCapital}
          />
        )}

        {/* TAB 6: StockOps 90-Day Playbook & Paper Trading Journal */}
        {activeTab === 'playbook' && (
          <RoadmapPlaybook
            entries={playbookEntries}
            onCloseTrade={handleCloseTrade}
            onAddManualEntry={handleAddManualEntry}
            onUpdateTags={handleUpdateEntryTags}
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
            <span>{backend.online ? `Python engine · ${backend.source ? SOURCE_LABEL[backend.source] : ''}` : 'Simulated feed (start the Python engine for real data)'}</span>
          </div>
          <div>
            &quot;Don&apos;t collect strategies. Build a system.&quot;
          </div>
        </div>
      </footer>
    </div>
  );
}

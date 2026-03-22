import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').email || null; }
  catch { return null; }
};

/* ─── Constants ──────────────────────────────────────────────── */
const COINS = [
  { symbol: 'BTCUSDT',  short: 'BTC',  color: '#f7931a', name: 'Bitcoin' },
  { symbol: 'ETHUSDT',  short: 'ETH',  color: '#627eea', name: 'Ethereum' },
  { symbol: 'SOLUSDT',  short: 'SOL',  color: '#9945ff', name: 'Solana' },
  { symbol: 'BNBUSDT',  short: 'BNB',  color: '#f3ba2f', name: 'BNB' },
  { symbol: 'XRPUSDT',  short: 'XRP',  color: '#00aae4', name: 'XRP' },
  { symbol: 'DOGEUSDT', short: 'DOGE', color: '#c2a633', name: 'Dogecoin' },
  { symbol: 'ADAUSDT',  short: 'ADA',  color: '#3cc8c8', name: 'Cardano' },
  { symbol: 'AVAXUSDT', short: 'AVAX', color: '#e84142', name: 'Avalanche' },
];

const STRATEGIES = [
  {
    id: 'sma_cross',
    name: 'SMA Crossover',
    desc: 'Buy when 20-period MA crosses above 50-period MA. Sell on reverse cross.',
    icon: '📈',
    color: '#6366f1',
  },
  {
    id: 'rsi',
    name: 'RSI Strategy',
    desc: 'Buy when RSI < 30 (oversold). Sell when RSI > 70 (overbought).',
    icon: '📊',
    color: '#22c55e',
  },
  {
    id: 'macd',
    name: 'MACD Signal',
    desc: 'Buy when MACD line crosses above signal line. Sell on reverse.',
    icon: '🔀',
    color: '#f59e0b',
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    desc: 'Buy when price touches lower band. Sell when price touches upper band.',
    icon: '📉',
    color: '#ec4899',
  },
  {
    id: 'ema_rsi',
    name: 'EMA + RSI Combo',
    desc: 'Buy when price > EMA-20 AND RSI < 40. Sell when RSI > 65.',
    icon: '🤖',
    color: '#8b5cf6',
  },
];

const INTERVALS = [
  { label: '1 Month',  value: '1m',  interval: '4h',  limit: 180 },
  { label: '3 Months', value: '3m',  interval: '1d',  limit: 90  },
  { label: '6 Months', value: '6m',  interval: '1d',  limit: 180 },
  { label: '1 Year',   value: '1y',  interval: '1d',  limit: 365 },
];

/* ─── Technical Indicator Calculations ───────────────────────── */
const calcSMA = (prices, period) => {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
};

const calcEMA = (prices, period) => {
  const k = 2 / (period + 1);
  const ema = [];
  let prev = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { ema.push(null); continue; }
    if (prev === null) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      ema.push(prev); continue;
    }
    prev = prices[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
};

const calcRSI = (prices, period = 14) => {
  const rsi = new Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
};

const calcMACD = (prices) => {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = prices.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null
  );
  const macdVals = macdLine.filter(v => v !== null);
  const signalRaw = calcEMA(macdVals, 9);
  const signal = new Array(macdLine.length).fill(null);
  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) { signal[i] = signalRaw[si++]; }
  }
  return { macdLine, signal };
};

const calcBB = (prices, period = 20, mult = 2) => {
  const mid = calcSMA(prices, period);
  return prices.map((_, i) => {
    if (mid[i] === null) return { upper: null, mid: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const std = Math.sqrt(slice.reduce((s, v) => s + Math.pow(v - mid[i], 2), 0) / period);
    return { upper: mid[i] + mult * std, mid: mid[i], lower: mid[i] - mult * std };
  });
};

/* ─── Strategy Runners ───────────────────────────────────────── */
const runStrategy = (stratId, candles, initCapital = 10000) => {
  const closes = candles.map(c => c.close);
  const trades = [];
  let capital = initCapital;
  let position = null; // { entryPrice, entryIdx, qty }

  const open  = (i, price, reason) => { position = { entryPrice: price, entryIdx: i, qty: capital / price, reason }; };
  const close = (i, price, reason) => {
    if (!position) return;
    const pnl    = (price - position.entryPrice) * position.qty;
    const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
    capital += pnl;
    trades.push({
      entryIdx:   position.entryIdx,
      exitIdx:    i,
      entryPrice: position.entryPrice,
      exitPrice:  price,
      qty:        position.qty,
      pnl,
      pnlPct,
      entryDate:  candles[position.entryIdx]?.time,
      exitDate:   candles[i]?.time,
      entryReason: position.reason,
      exitReason:  reason,
      win:        pnl > 0,
    });
    position = null;
  };

  if (stratId === 'sma_cross') {
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    for (let i = 51; i < closes.length; i++) {
      if (!sma20[i] || !sma50[i] || !sma20[i-1] || !sma50[i-1]) continue;
      if (!position && sma20[i-1] <= sma50[i-1] && sma20[i] > sma50[i])
        open(i, closes[i], 'SMA20 crossed above SMA50');
      else if (position && sma20[i-1] >= sma50[i-1] && sma20[i] < sma50[i])
        close(i, closes[i], 'SMA20 crossed below SMA50');
    }
  } else if (stratId === 'rsi') {
    const rsi = calcRSI(closes);
    for (let i = 15; i < closes.length; i++) {
      if (rsi[i] === null) continue;
      if (!position && rsi[i] < 30)  open(i,  closes[i], `RSI oversold (${rsi[i].toFixed(1)})`);
      else if (position && rsi[i] > 70) close(i, closes[i], `RSI overbought (${rsi[i].toFixed(1)})`);
    }
  } else if (stratId === 'macd') {
    const { macdLine, signal } = calcMACD(closes);
    for (let i = 1; i < closes.length; i++) {
      if (macdLine[i] === null || signal[i] === null) continue;
      if (!position && macdLine[i-1] <= signal[i-1] && macdLine[i] > signal[i])
        open(i, closes[i], 'MACD crossed above signal');
      else if (position && macdLine[i-1] >= signal[i-1] && macdLine[i] < signal[i])
        close(i, closes[i], 'MACD crossed below signal');
    }
  } else if (stratId === 'bb') {
    const bb = calcBB(closes);
    for (let i = 20; i < closes.length; i++) {
      if (!bb[i].lower) continue;
      if (!position && closes[i] <= bb[i].lower)
        open(i, closes[i], 'Price touched lower Bollinger Band');
      else if (position && closes[i] >= bb[i].upper)
        close(i, closes[i], 'Price touched upper Bollinger Band');
    }
  } else if (stratId === 'ema_rsi') {
    const ema20 = calcEMA(closes, 20);
    const rsi   = calcRSI(closes);
    for (let i = 20; i < closes.length; i++) {
      if (!ema20[i] || rsi[i] === null) continue;
      if (!position && closes[i] > ema20[i] && rsi[i] < 40)
        open(i, closes[i], `Price > EMA20 & RSI=${rsi[i].toFixed(1)}`);
      else if (position && rsi[i] > 65)
        close(i, closes[i], `RSI overbought (${rsi[i].toFixed(1)})`);
    }
  }

  // Close any open position at last candle
  if (position) close(closes.length - 1, closes[closes.length - 1], 'End of period');

  // Build equity curve
  let eq = initCapital;
  const equity = candles.map((c, i) => {
    const closedHere = trades.filter(t => t.exitIdx === i);
    closedHere.forEach(t => { eq += t.pnl; });
    return { time: c.time, value: eq };
  });

  const wins       = trades.filter(t => t.win);
  const losses     = trades.filter(t => !t.win);
  const totalReturn = ((capital - initCapital) / initCapital) * 100;
  const winRate     = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin      = wins.length ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss     = losses.length ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const profitFactor = losses.length
    ? Math.abs(wins.reduce((s,t)=>s+t.pnl,0) / losses.reduce((s,t)=>s+t.pnl,0))
    : wins.length ? Infinity : 0;

  // Max drawdown
  let peak = initCapital, maxDD = 0;
  equity.forEach(e => {
    if (e.value > peak) peak = e.value;
    const dd = (peak - e.value) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    trades, equity, capital,
    totalReturn, winRate, avgWin, avgLoss,
    profitFactor: isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞',
    maxDrawdown: maxDD,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
  };
};

/* ─── Mini SVG Line Chart ─────────────────────────────────────── */
const EquityChart = ({ equity, color = '#6366f1' }) => {
  if (!equity || equity.length < 2) return null;
  const W = 700, H = 180, PL = 60, PR = 20, PT = 16, PB = 32;
  const vals  = equity.map(e => e.value);
  const minV  = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const toX = i => PL + (i / (vals.length - 1)) * (W - PL - PR);
  const toY = v => PT + ((maxV - v) / range) * (H - PT - PB);

  const pts = vals.map((v, i) => ({ x: toX(i), y: toY(v) }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i-1].x + pts[i].x) / 2;
    d += ` C ${mx} ${pts[i-1].y}, ${mx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${d} L ${pts[pts.length-1].x} ${H - PB} L ${pts[0].x} ${H - PB} Z`;

  const yLabels = [minV, (minV+maxV)/2, maxV];
  const xLabels = [0, Math.floor(vals.length/4), Math.floor(vals.length/2), Math.floor(vals.length*3/4), vals.length-1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={PL-6} y={y+4} textAnchor="end" fontSize="9" fill="#94a3b8">
              ${v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={area} fill="url(#eqGrad)"/>
      {/* Line */}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      {/* X labels */}
      {xLabels.map(i => (
        equity[i] && (
          <text key={i} x={toX(i)} y={H-PB+14} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {new Date(equity[i].time).toLocaleDateString([],{month:'short',day:'numeric'})}
          </text>
        )
      ))}
      {/* Start / End dots */}
      <circle cx={pts[0].x} cy={pts[0].y} r="3" fill={color} opacity="0.6"/>
      <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="4" fill={color}/>
    </svg>
  );
};

/* ─── Stat Card ──────────────────────────────────────────────── */
const Stat = ({ label, value, sub, color = '#0f172a', icon, delay = 0 }) => (
  <div style={{ background:'white', borderRadius:14, padding:'16px 18px', border:'1px solid #f1f5f9',
    boxShadow:'0 1px 6px rgba(0,0,0,0.05)', animation:`btFadeUp .35s ease ${delay}s both` }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', fontWeight:600 }}>{label}</div>
      <span style={{ fontSize:18 }}>{icon}</span>
    </div>
    <div style={{ fontSize:22, fontWeight:700, color, fontFamily:"'Sora',sans-serif", lineHeight:1, marginBottom:4 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:'#94a3b8' }}>{sub}</div>}
  </div>
);

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
const Backtesting = () => {
  const [coin,        setCoin]        = useState(COINS[0]);
  const [strategy,    setStrategy]    = useState(STRATEGIES[0]);
  const [interval,    setInterval]    = useState(INTERVALS[1]); // 3 months default
  const [capital,     setCapital]     = useState(10000);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('summary'); // summary | trades | indicators
  const [candles,     setCandles]     = useState([]);
  const abortRef = useRef(null);

  const runBacktest = useCallback(async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setCandles([]);

    try {
      // Fetch historical klines from Binance
      const url = `https://api.binance.com/api/v3/klines?symbol=${coin.symbol}&interval=${interval.interval}&limit=${interval.limit}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch data from Binance');
      const raw  = await res.json();
      if (!Array.isArray(raw) || raw.length < 50)
        throw new Error('Not enough historical data for this period');

      const klines = raw.map(k => ({
        time:   k[0],
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      setCandles(klines);
      const res2 = runStrategy(strategy.id, klines, capital);
      setResult(res2);
      setActiveTab('summary');

      // Save result to MongoDB
      const userEmail = getUserEmail();
      if (userEmail) {
        fetch(`${API_BASE}/api/backtest/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail,
            coin:         coin.short,
            strategy:     strategy.name,
            period:       interval.label,
            capital,
            finalCapital: res2.capital,
            totalReturn:  res2.totalReturn,
            winRate:      res2.winRate,
            totalTrades:  res2.totalTrades,
            wins:         res2.wins,
            losses:       res2.losses,
            maxDrawdown:  res2.maxDrawdown,
            profitFactor: res2.profitFactor,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [coin, strategy, interval, capital]);

  const fmt  = (n, d = 2) => n == null ? '—' : n.toFixed(d);
  const fmtC = (n) => n == null ? '—' : `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .bt-root { min-height:100%; background:#f8fafc; font-family:'DM Sans',sans-serif; color:#0f172a; padding-bottom:48px; }
        @keyframes btFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes btSpin   { to{transform:rotate(360deg)} }

        /* Config cards */
        .bt-config-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:20px; }
        .bt-config-card { background:white; border-radius:14px; padding:16px; border:1px solid #f1f5f9; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .bt-config-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; }
        .bt-select {
          width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #e2e8f0;
          background:white; font-family:'DM Sans',sans-serif; font-size:13px; color:#0f172a;
          outline:none; cursor:pointer; transition:border-color .15s; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center;
          padding-right:30px;
        }
        .bt-select:focus { border-color:#6366f1; }

        /* Strategy cards */
        .bt-strat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:20px; }
        .bt-strat-card {
          padding:14px 16px; border-radius:12px; border:2px solid #e2e8f0;
          background:white; cursor:pointer; transition:all .15s; text-align:left;
        }
        .bt-strat-card:hover  { border-color:#6366f1; background:#f8f4ff; }
        .bt-strat-card.active { border-color:#6366f1; background:rgba(99,102,241,0.06); }

        /* Run button */
        .bt-run-btn {
          padding:13px 32px; border-radius:12px; border:none;
          background:linear-gradient(135deg,#6366f1,#818cf8); color:white;
          font-size:15px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif;
          box-shadow:0 4px 16px rgba(99,102,241,0.3); transition:all .15s;
          display:flex; align-items:center; gap:10px;
        }
        .bt-run-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(99,102,241,0.35); }
        .bt-run-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }

        /* Results */
        .bt-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }
        .bt-card { background:white; border-radius:14px; padding:20px; border:1px solid #f1f5f9; box-shadow:0 1px 6px rgba(0,0,0,0.05); margin-bottom:16px; }

        /* Tabs */
        .bt-tabs { display:flex; gap:4px; background:white; border-radius:12px; padding:4px; border:1px solid #f1f5f9; width:fit-content; margin-bottom:20px; overflow-x:auto; scrollbar-width:none; }
        .bt-tabs::-webkit-scrollbar { display:none; }
        .bt-tab { padding:8px 16px; border-radius:9px; border:none; cursor:pointer; font-size:13px; font-weight:500; font-family:'DM Sans',sans-serif; transition:all .15s; color:#64748b; background:transparent; white-space:nowrap; }
        .bt-tab.active { background:#6366f1; color:white; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
        .bt-tab:hover:not(.active) { background:#f1f5f9; }

        /* Trade log */
        .bt-trade-row { display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:1px solid #f8fafc; font-size:12.5px; }
        .bt-trade-row:last-child { border-bottom:none; }
        .bt-trade-row:hover { background:#f8fafc; }

        /* Capital input */
        .bt-capital-input {
          width:100%; padding:9px 12px; border-radius:10px; border:1.5px solid #e2e8f0;
          background:white; font-family:'Sora',sans-serif; font-size:14px; font-weight:700;
          color:#0f172a; outline:none; transition:border-color .15s;
        }
        .bt-capital-input:focus { border-color:#6366f1; }

        /* Responsive */
        @media(max-width:640px) {
          .bt-config-grid  { grid-template-columns:1fr 1fr; }
          .bt-strat-grid   { grid-template-columns:1fr 1fr; }
          .bt-stats-grid   { grid-template-columns:1fr 1fr; }
          .bt-run-btn      { width:100%; justify-content:center; }
        }
        @media(max-width:400px) {
          .bt-config-grid  { grid-template-columns:1fr; }
          .bt-strat-grid   { grid-template-columns:1fr; }
          .bt-stats-grid   { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="bt-root">

        {/* ── Header ── */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ fontSize:26, fontWeight:700, fontFamily:"'Sora',sans-serif", margin:0, letterSpacing:'-0.5px', display:'flex', alignItems:'center', gap:10 }}>
                Backtesting Engine

              </h1>
              <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0', lineHeight:1.5 }}>
                Simulate trading strategies on historical Binance data — no real money involved
              </p>
            </div>
            {result && (
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'white', border:'1px solid #f1f5f9', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#64748b' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: result.totalReturn >= 0 ? '#22c55e' : '#ef4444' }}/>
                Last run: {coin.short} · {strategy.name} · {interval.label}
              </div>
            )}
          </div>
        </div>

        {/* ── Configuration ── */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'20px', marginBottom:20, boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily:"'Sora',sans-serif", marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            ⚙️ Configuration
          </div>

          <div className="bt-config-grid">
            {/* Coin */}
            <div className="bt-config-card">
              <div className="bt-config-label">Cryptocurrency</div>
              <select className="bt-select" value={coin.symbol} onChange={e => setCoin(COINS.find(c => c.symbol === e.target.value))}>
                {COINS.map(c => <option key={c.symbol} value={c.symbol}>{c.short} — {c.name}</option>)}
              </select>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:coin.color }}/>
                <span style={{ fontSize:11, color:'#64748b' }}>{coin.name}</span>
              </div>
            </div>

            {/* Period */}
            <div className="bt-config-card">
              <div className="bt-config-label">Time Period</div>
              <select className="bt-select" value={interval.value} onChange={e => setInterval(INTERVALS.find(i => i.value === e.target.value))}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <div style={{ fontSize:11, color:'#64748b', marginTop:8 }}>
                ~{interval.limit} candles · {interval.interval} interval
              </div>
            </div>

            {/* Capital */}
            <div className="bt-config-card">
              <div className="bt-config-label">Starting Capital (USDT)</div>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, fontWeight:700, color:'#94a3b8', fontFamily:"'Sora',sans-serif" }}>$</span>
                <input
                  type="number" min="100" max="1000000" step="100"
                  value={capital}
                  onChange={e => setCapital(Math.max(100, parseInt(e.target.value) || 100))}
                  className="bt-capital-input"
                  style={{ paddingLeft:28 }}
                />
              </div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:8 }}>Simulated capital only</div>
            </div>
          </div>

          {/* Strategy selection */}
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>
            Select Strategy
          </div>
          <div className="bt-strat-grid">
            {STRATEGIES.map(s => (
              <button key={s.id}
                className={`bt-strat-card${strategy.id === s.id ? ' active' : ''}`}
                onClick={() => setStrategy(s)}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:20 }}>{s.icon}</span>
                  <span style={{ fontSize:13, fontWeight:700, color: strategy.id === s.id ? '#6366f1' : '#0f172a', fontFamily:"'Sora',sans-serif" }}>{s.name}</span>
                </div>
                <div style={{ fontSize:11, color:'#64748b', lineHeight:1.5 }}>{s.desc}</div>
              </button>
            ))}
          </div>

          {/* Run button */}
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <button className="bt-run-btn" onClick={runBacktest} disabled={loading}>
              {loading
                ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'white', borderRadius:'50%', animation:'btSpin .7s linear infinite', display:'inline-block' }}/> Running…</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Backtest</>
              }
            </button>
            {loading && (
              <div style={{ fontSize:12, color:'#94a3b8' }}>
                Fetching {interval.limit} candles for {coin.short} from Binance…
              </div>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background:'#fef2f2', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'14px 16px', marginBottom:20, color:'#dc2626', fontSize:13, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>⚠️</span> {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div style={{ animation:'btFadeUp .35s ease both' }}>

            {/* Return banner */}
            <div style={{
              background: result.totalReturn >= 0
                ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                : 'linear-gradient(135deg,#dc2626,#ef4444)',
              borderRadius:16, padding:'20px 24px', marginBottom:20, color:'white',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
            }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, opacity:.8, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>
                  {strategy.name} · {coin.short}/USDT · {interval.label}
                </div>
                <div style={{ fontSize:36, fontWeight:700, fontFamily:"'Sora',sans-serif", letterSpacing:'-1px', lineHeight:1 }}>
                  {result.totalReturn >= 0 ? '+' : ''}{fmt(result.totalReturn)}%
                </div>
                <div style={{ fontSize:13, opacity:.85, marginTop:4 }}>
                  ${capital.toLocaleString()} → {fmtC(result.capital)} · P&L: {result.capital - capital >= 0 ? '+' : ''}{fmtC(result.capital - capital)}
                </div>
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>{fmt(result.winRate)}%</div>
                  <div style={{ fontSize:11, opacity:.8 }}>Win Rate</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>{result.totalTrades}</div>
                  <div style={{ fontSize:11, opacity:.8 }}>Trades</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>{fmt(result.maxDrawdown)}%</div>
                  <div style={{ fontSize:11, opacity:.8 }}>Max DD</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bt-tabs">
              {['summary','equity','trades'].map(t => (
                <button key={t} className={`bt-tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>
                  {t === 'summary' ? '📊 Summary' : t === 'equity' ? '📈 Equity Curve' : '📋 Trade Log'}
                </button>
              ))}
            </div>

            {/* ── SUMMARY TAB ── */}
            {activeTab === 'summary' && (
              <>
                <div className="bt-stats-grid">
                  <Stat label="Total Return"    value={`${result.totalReturn>=0?'+':''}${fmt(result.totalReturn)}%`} color={result.totalReturn>=0?'#16a34a':'#dc2626'} icon="💰" sub={`Started $${capital.toLocaleString()}`} delay={0}/>
                  <Stat label="Win Rate"        value={`${fmt(result.winRate)}%`}           color="#6366f1"  icon="🏆" sub={`${result.wins}W / ${result.losses}L`}    delay={0.04}/>
                  <Stat label="Total Trades"    value={result.totalTrades}                  color="#0f172a"  icon="📊" sub={`${interval.label} period`}               delay={0.08}/>
                  <Stat label="Profit Factor"   value={result.profitFactor}                 color={parseFloat(result.profitFactor)>=1?'#16a34a':'#dc2626'} icon="⚡" sub=">1 means profitable" delay={0.12}/>
                  <Stat label="Max Drawdown"    value={`${fmt(result.maxDrawdown)}%`}       color="#f59e0b"  icon="📉" sub="Peak-to-trough drop"                      delay={0.16}/>
                  <Stat label="Avg Win"         value={`+${fmt(result.avgWin)}%`}           color="#16a34a"  icon="✅" sub="Per winning trade"                        delay={0.20}/>
                  <Stat label="Avg Loss"        value={`${fmt(result.avgLoss)}%`}           color="#dc2626"  icon="❌" sub="Per losing trade"                         delay={0.24}/>
                  <Stat label="Final Capital"   value={fmtC(result.capital)}                color="#0f172a"  icon="💼" sub={`Net ${result.capital>=capital?'+':''}${fmtC(result.capital-capital)}`} delay={0.28}/>
                </div>

                {/* Strategy Info */}
                <div className="bt-card">
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Sora',sans-serif", marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20 }}>{strategy.icon}</span> {strategy.name} — How it works
                  </div>
                  <p style={{ fontSize:13, color:'#475569', lineHeight:1.7, margin:0 }}>{strategy.desc}</p>
                  <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap' }}>
                    {[
                      { label:'Coin',     val:`${coin.short}/USDT` },
                      { label:'Period',   val:interval.label },
                      { label:'Interval', val:interval.interval },
                      { label:'Candles',  val:candles.length },
                      { label:'Capital',  val:`$${capital.toLocaleString()}` },
                    ].map(b => (
                      <div key={b.label} style={{ padding:'5px 10px', borderRadius:8, background:'#f8fafc', border:'1px solid #f1f5f9', fontSize:12 }}>
                        <span style={{ color:'#94a3b8' }}>{b.label}: </span>
                        <span style={{ fontWeight:600, color:'#0f172a' }}>{b.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buy & Hold comparison */}
                {candles.length > 0 && (() => {
                  const bh = ((candles[candles.length-1].close - candles[0].close) / candles[0].close) * 100;
                  const outperform = result.totalReturn - bh;
                  return (
                    <div className="bt-card">
                      <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Sora',sans-serif", marginBottom:14 }}>
                        📊 vs Buy &amp; Hold Benchmark
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        {[
                          { label:'Strategy Return', val:`${result.totalReturn>=0?'+':''}${fmt(result.totalReturn)}%`, color: result.totalReturn>=0?'#16a34a':'#dc2626' },
                          { label:'Buy & Hold',      val:`${bh>=0?'+':''}${fmt(bh)}%`,              color: bh>=0?'#16a34a':'#dc2626' },
                          { label:'Outperformance',  val:`${outperform>=0?'+':''}${fmt(outperform)}%`, color: outperform>=0?'#16a34a':'#dc2626' },
                        ].map(b => (
                          <div key={b.label} style={{ textAlign:'center', background:'#f8fafc', borderRadius:10, padding:'14px 8px', border:'1px solid #f1f5f9' }}>
                            <div style={{ fontSize:18, fontWeight:700, color:b.color, fontFamily:"'Sora',sans-serif" }}>{b.val}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{b.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── EQUITY CURVE TAB ── */}
            {activeTab === 'equity' && (
              <div className="bt-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>Portfolio Equity Curve</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Cumulative portfolio value over the backtest period</div>
                  </div>
                  <div style={{ display:'flex', gap:16 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>Start</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily:"'Sora',sans-serif" }}>${capital.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>End</div>
                      <div style={{ fontSize:13, fontWeight:700, color:result.totalReturn>=0?'#16a34a':'#dc2626', fontFamily:"'Sora',sans-serif" }}>{fmtC(result.capital)}</div>
                    </div>
                  </div>
                </div>
                <EquityChart equity={result.equity} color={result.totalReturn >= 0 ? '#6366f1' : '#ef4444'}/>
                {/* Trade markers below chart */}
                <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e' }}/>
                    <span style={{ fontSize:11, color:'#64748b' }}>Winning trades ({result.wins})</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444' }}/>
                    <span style={{ fontSize:11, color:'#64748b' }}>Losing trades ({result.losses})</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:2, background:'#6366f1', borderRadius:1 }}/>
                    <span style={{ fontSize:11, color:'#64748b' }}>Strategy equity</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TRADE LOG TAB ── */}
            {activeTab === 'trades' && (
              <div className="bt-card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ padding:'16px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Sora',sans-serif" }}>Trade Log</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{result.totalTrades} trades · {result.wins} wins · {result.losses} losses</div>
                </div>
                {/* Header row */}
                <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 1fr 1fr 1fr 1fr', gap:8, padding:'8px 14px', background:'#f8fafc', borderBottom:'1px solid #f1f5f9', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.4px' }}>
                  <div>#</div><div>Entry</div><div>Exit</div><div>Entry $</div><div>Exit $</div><div style={{textAlign:'right'}}>P&L</div>
                </div>
                {result.trades.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'#94a3b8', fontSize:13 }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
                    No trades generated — strategy conditions were not met in this period.<br/>
                    Try a different strategy or longer time range.
                  </div>
                ) : (
                  <div style={{ maxHeight:420, overflowY:'auto' }}>
                    {result.trades.map((t, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'32px 1fr 1fr 1fr 1fr 1fr',
                        gap:8, padding:'10px 14px', borderBottom:'1px solid #f8fafc',
                        background: t.win ? 'rgba(22,163,74,0.02)' : 'rgba(220,38,38,0.02)',
                        fontSize:12, alignItems:'center',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = t.win ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = t.win ? 'rgba(22,163,74,0.02)' : 'rgba(220,38,38,0.02)'}
                      >
                        <div style={{ width:22, height:22, borderRadius:6, background: t.win ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color: t.win ? '#16a34a' : '#dc2626' }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'#0f172a' }}>{new Date(t.entryDate).toLocaleDateString([],{month:'short',day:'numeric'})}</div>
                          <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{t.entryReason}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'#0f172a' }}>{new Date(t.exitDate).toLocaleDateString([],{month:'short',day:'numeric'})}</div>
                          <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{t.exitReason}</div>
                        </div>
                        <div style={{ fontWeight:600, color:'#0f172a', fontFamily:"'Sora',sans-serif" }}>
                          ${t.entryPrice >= 1000 ? t.entryPrice.toLocaleString(undefined,{maximumFractionDigits:2}) : t.entryPrice.toFixed(4)}
                        </div>
                        <div style={{ fontWeight:600, color:'#0f172a', fontFamily:"'Sora',sans-serif" }}>
                          ${t.exitPrice >= 1000 ? t.exitPrice.toLocaleString(undefined,{maximumFractionDigits:2}) : t.exitPrice.toFixed(4)}
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontWeight:700, color: t.win ? '#16a34a' : '#dc2626', fontFamily:"'Sora',sans-serif" }}>
                            {t.pnlPct >= 0 ? '+' : ''}{fmt(t.pnlPct)}%
                          </div>
                          <div style={{ fontSize:10, color: t.win ? '#16a34a' : '#dc2626', marginTop:1 }}>
                            {t.pnl >= 0 ? '+' : ''}{fmtC(t.pnl)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── Empty state ── */}
        {!result && !loading && !error && (
          <div style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'60px 24px', textAlign:'center', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>🔬</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#0f172a', fontFamily:"'Sora',sans-serif", marginBottom:8 }}>
              Configure &amp; Run Your Backtest
            </div>
            <div style={{ fontSize:13, color:'#64748b', maxWidth:420, margin:'0 auto', lineHeight:1.6 }}>
              Select a cryptocurrency, choose a strategy, set your starting capital and time period —
              then click <strong>Run Backtest</strong> to simulate how the strategy would have performed on real Binance data.
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:8, flexWrap:'wrap', marginTop:20 }}>
              {STRATEGIES.map(s => (
                <div key={s.id} style={{ padding:'6px 12px', borderRadius:8, background:'#f8fafc', border:'1px solid #f1f5f9', fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:5 }}>
                  <span>{s.icon}</span> {s.name}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Backtesting;
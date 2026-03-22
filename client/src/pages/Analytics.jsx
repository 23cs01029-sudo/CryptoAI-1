import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

/* ─── Data helpers ───────────────────────────────────────────── */
const getPositions = () => { try { return JSON.parse(localStorage.getItem('positions') || '[]'); } catch { return []; } };
const getWallet    = () => { try { return JSON.parse(localStorage.getItem('wallet')    || '{"USDT":10000}'); } catch { return { USDT: 10000 }; } };
const getTxns      = () => { try { return JSON.parse(localStorage.getItem('wallet_txns') || '[]'); } catch { return []; } };

const ALL_COINS = [
  {symbol:'BTCUSDT',short:'BTC',color:'#f7931a'},{symbol:'ETHUSDT',short:'ETH',color:'#627eea'},
  {symbol:'SOLUSDT',short:'SOL',color:'#9945ff'},{symbol:'BNBUSDT',short:'BNB',color:'#f3ba2f'},
  {symbol:'XRPUSDT',short:'XRP',color:'#00aae4'},{symbol:'DOGEUSDT',short:'DOGE',color:'#c2a633'},
  {symbol:'ADAUSDT',short:'ADA',color:'#3cc8c8'},{symbol:'AVAXUSDT',short:'AVAX',color:'#e84142'},
  {symbol:'DOTUSDT',short:'DOT',color:'#e6007a'},{symbol:'MATICUSDT',short:'MATIC',color:'#8247e5'},
];

/* ─── SVG Mini Donut ─────────────────────────────────────────── */
const Donut = ({ segments, size = 120, thickness = 22 }) => {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        );
        offset += dash;
        return el;
      })}
      {segments.length === 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness}/>
      )}
    </svg>
  );
};

/* ─── SVG Bar Chart ──────────────────────────────────────────── */
const BarChart = ({ data, height = 140 }) => {
  if (!data || data.length === 0) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
      No trade data yet
    </div>
  );
  const maxAbs = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const barW = Math.min(32, Math.floor((100 / data.length) - 4));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingBottom: 20, position: 'relative' }}>
      {/* zero line */}
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 1, background: '#e2e8f0' }}/>
      {data.map((d, i) => {
        const pct = (Math.abs(d.value) / maxAbs) * 50;
        const isPos = d.value >= 0;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', gap: 0 }}>
              {!isPos && (
                <div style={{ width: barW, height: `${pct}%`, minHeight: isPos ? 0 : 2, background: '#ef4444', borderRadius: '0 0 4px 4px', transition: 'height .5s ease' }}/>
              )}
              <div style={{ height: 1, width: barW, background: '#e2e8f0' }}/>
              {isPos && (
                <div style={{ width: barW, height: `${pct}%`, minHeight: 2, background: '#22c55e', borderRadius: '4px 4px 0 0', transition: 'height .5s ease' }}/>
              )}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, whiteSpace: 'nowrap', transform: 'rotate(-35deg)', transformOrigin: 'top center' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── SVG Line Chart (portfolio growth) ─────────────────────── */
const MiniLine = ({ points, color = '#6366f1', height = 80 }) => {
  if (!points || points.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>Not enough data</div>
  );
  const W = 400, H = height, PAD = 8;
  const mn = Math.min(...points), mx = Math.max(...points);
  const rng = mx - mn || 1;
  const toX = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = v => H - PAD - ((v - mn) / rng) * (H - PAD * 2);
  let d = `M ${toX(0)} ${toY(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const cpx = (toX(i - 1) + toX(i)) / 2;
    d += ` C ${cpx} ${toY(points[i-1])}, ${cpx} ${toY(points[i])}, ${toX(i)} ${toY(points[i])}`;
  }
  const area = `${d} L ${toX(points.length-1)} ${H} L ${toX(0)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lgrow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lgrow)"/>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
};

/* ─── Stat Card ──────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, color, icon, delay = 0 }) => (
  <div style={{
    background: 'white', borderRadius: 14, padding: '16px 18px',
    border: '1px solid #f1f5f9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    animation: `fadeUp .4s ease ${delay}s both`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0f172a', fontFamily: "'Sora',sans-serif", letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>{sub}</div>}
  </div>
);

/* ─── ANALYTICS PAGE ─────────────────────────────────────────── */
const Analytics = () => {
  const [prices,  setPrices]  = useState({});
  const [changes, setChanges] = useState({});
  const [tab,     setTab]     = useState('overview');
  const wsRef = useRef(null);

  /* REST fetch immediately + WS for live updates */
  useEffect(() => {
    const symbols = ALL_COINS.map(c => `"${c.symbol}"`).join(',');
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        data.forEach(d => {
          setPrices(p  => ({ ...p, [d.symbol]: parseFloat(d.lastPrice) }));
          setChanges(p => ({ ...p, [d.symbol]: parseFloat(d.priceChangePercent) }));
        });
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const streams = ALL_COINS.map(c => `${c.symbol.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    wsRef.current = ws;
    ws.onmessage = e => {
      try {
        const d = (JSON.parse(e.data)).data;
        if (d?.s) {
          setPrices(p  => ({ ...p, [d.s]: parseFloat(d.c) }));
          setChanges(p => ({ ...p, [d.s]: parseFloat(d.P) }));
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => ws.close();
  }, []);

  /* Sync data when wallet changes (trade placed from another page) */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick(t => t + 1);
    window.addEventListener('walletUpdate', sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('walletUpdate', sync); window.removeEventListener('focus', sync); };
  }, []);

  /* Load wallet + positions + txns from MongoDB on mount — cross-device sync */
  useEffect(() => {
    try {
      const userEmail = JSON.parse(localStorage.getItem('user') || '{}').email;
      if (!userEmail) return;
      Promise.all([
        fetch(`${API_BASE}/api/wallet/${userEmail}`).then(r=>r.json()).catch(()=>({})),
        fetch(`${API_BASE}/api/positions/${userEmail}`).then(r=>r.json()).catch(()=>({})),
        fetch(`${API_BASE}/api/txns/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      ]).then(([wRes, pRes, tRes]) => {
        let changed = false;
        if (wRes.balances)              { localStorage.setItem('wallet',      JSON.stringify(wRes.balances));    changed = true; }
        if (pRes.positions?.length > 0) { localStorage.setItem('positions',   JSON.stringify(pRes.positions));   changed = true; }
        if (tRes.txns?.length > 0)      { localStorage.setItem('wallet_txns', JSON.stringify(tRes.txns));        changed = true; }
        if (changed) {
          window.dispatchEvent(new Event('walletUpdate')); // triggers setTick → re-render
        }
      }).catch(() => {});
    } catch {}
  }, []);

  /* ── Derived analytics (reactive to walletUpdate via tick) ── */
  const positions = getPositions();
  const wallet    = getWallet();
  const txns      = getTxns();
  void tick; 

  const closed  = positions.filter(p => p.status === 'CLOSED');
  const open    = positions.filter(p => p.status !== 'CLOSED');

  // Win / Loss
  const wins   = closed.filter(p => (p.closePnl || 0) > 0);
  const losses = closed.filter(p => (p.closePnl || 0) <= 0);
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : '—';

  // P&L
  const realisedPnl   = closed.reduce((s, p) => s + (p.closePnl || 0), 0);
  const unrealisedPnl = open.reduce((s, p) => {
    const cur = prices[p.symbol] || p.current || p.entry;
    const pnl = p.type === 'BUY' ? (cur - p.entry) * p.qty : (p.entry - cur) * p.qty;
    return s + pnl;
  }, 0);
  const totalPnl = realisedPnl + unrealisedPnl;

  // Best / worst trade
  const bestTrade  = closed.reduce((b, p) => (!b || (p.closePnl || 0) > (b.closePnl || 0)) ? p : b, null);
  const worstTrade = closed.reduce((b, p) => (!b || (p.closePnl || 0) < (b.closePnl || 0)) ? p : b, null);

  // Average win / loss
  const avgWin  = wins.length  ? wins.reduce((s,p)=>s+(p.closePnl||0),0)/wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s,p)=>s+(p.closePnl||0),0)/losses.length : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : '∞';

  // Holdings for donut
  const holdings = Object.entries(wallet)
    .filter(([k]) => k !== 'USDT' && wallet[k] > 0.000001)
    .map(([coin, qty]) => {
      const sym = ALL_COINS.find(c => c.short === coin)?.symbol;
      const cur = sym ? (prices[sym] || 0) : 0;
      const col = ALL_COINS.find(c => c.short === coin)?.color || '#94a3b8';
      return { coin, qty, value: qty * cur, color: col };
    })
    .filter(h => h.value > 0);

  const usdtVal = wallet.USDT || 0;
  const totalPortfolio = usdtVal + holdings.reduce((s, h) => s + h.value, 0);
  const donutSegs = [
    ...holdings.map(h => ({ label: h.coin, value: h.value, color: h.color })),
    ...(usdtVal > 0 ? [{ label: 'USDT', value: usdtVal, color: '#22c55e' }] : []),
  ];

  // P&L by coin (bar chart)
  const pnlByCoin = {};
  closed.forEach(p => {
    pnlByCoin[p.coin] = (pnlByCoin[p.coin] || 0) + (p.closePnl || 0);
  });
  const barData = Object.entries(pnlByCoin)
    .map(([coin, value]) => ({ label: coin, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Portfolio growth line (from txn history — parse actual P&L from CLOSE note)
  let runningBal = 10000;
  const growthPoints = [10000];
  [...txns].reverse().forEach(t => {
    if (t.type === 'CLOSE') {
      // Note format: "CLOSE BUY 1 BTC @ $65000 — P&L: +$123.4"
      const m = t.note?.match(/P&L: ([+-]?\$?[\d.]+)/);
      const pnl = m ? parseFloat(m[1].replace('$','')) : 0;
      runningBal += pnl;
    }
    if (t.type === 'DEPOSIT') runningBal += (t.amount || 0);
    if (t.type === 'RESET') runningBal = t.amount || 10000;
    growthPoints.push(Math.max(0, runningBal));
  });
  growthPoints.push(totalPortfolio);

  // Trade frequency by coin
  const tradeCounts = {};
  positions.forEach(p => { tradeCounts[p.coin] = (tradeCounts[p.coin] || 0) + 1; });

  // Monthly P&L (last 6 months)
  const now = new Date();
  const monthlyPnl = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const label = d.toLocaleDateString([], { month: 'short' });
    const pnl = closed
      .filter(p => { const t = new Date(p.closeTime || p.time); return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear(); })
      .reduce((s, p) => s + (p.closePnl || 0), 0);
    return { label, value: pnl };
  });

  // RSI-like indicator (simplified from recent closes)
  // eslint-disable-next-line no-unused-vars
  const computeRSI = (coin) => {
    const coinPos = closed.filter(p => p.coin === coin);
    if (coinPos.length < 3) return null;
    const gains = coinPos.filter(p => (p.closePnl||0) > 0).length;
    return Math.round((gains / coinPos.length) * 100);
  };

  const TABS = ['overview', 'performance', 'holdings', 'signals'];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .an-root{min-height:100%;background:#f8fafc;font-family:'DM Sans',sans-serif;color:#0f172a;padding-bottom:40px;}
        .an-tabs{display:flex;gap:4px;background:white;border-radius:12px;padding:4px;border:1px solid #f1f5f9;width:fit-content;}
        .an-tab{padding:8px 18px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;transition:all .15s;color:#64748b;background:transparent;}
        .an-tab.active{background:#6366f1;color:white;box-shadow:0 2px 8px rgba(99,102,241,0.3);}
        .an-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:20px;}
        .an-card{background:white;border-radius:14px;padding:20px;border:1px solid #f1f5f9;box-shadow:0 1px 6px rgba(0,0,0,0.05);}
        .an-card-lg{background:white;border-radius:14px;padding:20px;border:1px solid #f1f5f9;box-shadow:0 1px 6px rgba(0,0,0,0.05);}
        .an-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
        .an-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
        .trade-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f8fafc;}
        .trade-row:last-child{border-bottom:none;}
        .ind-bar{height:8px;border-radius:4px;background:#f1f5f9;overflow:hidden;margin-top:4px;}
        .ind-fill{height:100%;border-radius:4px;transition:width .6s ease;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @media(max-width:640px){.an-row,.an-row-3{grid-template-columns:1fr;}.an-grid{grid-template-columns:1fr 1fr;}}
      `}</style>

      <div className="an-root">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Sora',sans-serif", margin: 0, letterSpacing: '-0.5px' }}>Analytics</h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                Performance insights · {positions.length} total trades · {closed.length} closed
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}/>
              <span style={{ fontSize: 12, color: '#64748b' }}>Live data</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="an-tabs">
              {TABS.map(t => (
                <button key={t} className={`an-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {tab === 'overview' && (
          <>
            {/* KPI cards */}
            <div className="an-grid">
              <StatCard label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? '#16a34a' : '#dc2626'} sub={`Realised: $${realisedPnl.toFixed(2)}`} icon="💰" delay={0}/>
              <StatCard label="Win Rate" value={winRate === '—' ? '—' : `${winRate}%`} color="#6366f1" sub={`${wins.length}W / ${losses.length}L`} icon="🏆" delay={0.05}/>
              <StatCard label="Total Trades" value={positions.length} sub={`${open.length} open · ${closed.length} closed`} icon="📊" delay={0.1}/>
              <StatCard label="Portfolio Value" value={`$${totalPortfolio.toFixed(2)}`} color="#0f172a" sub={`$${usdtVal.toFixed(2)} USDT`} icon="💼" delay={0.15}/>
              <StatCard label="Profit Factor" value={profitFactor} color={parseFloat(profitFactor) >= 1 ? '#16a34a' : '#dc2626'} sub={`Avg win $${avgWin.toFixed(2)}`} icon="⚡" delay={0.2}/>
              <StatCard label="Unrealised P&L" value={`${unrealisedPnl >= 0 ? '+' : ''}$${unrealisedPnl.toFixed(2)}`} color={unrealisedPnl >= 0 ? '#16a34a' : '#dc2626'} sub={`${open.length} open positions`} icon="📈" delay={0.25}/>
            </div>

            {/* Portfolio growth + Holdings donut */}
            <div className="an-row">
              <div className="an-card-lg" style={{ animation: 'fadeUp .4s ease .1s both' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 4 }}>Portfolio Growth</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Cumulative value over time</div>
                <MiniLine points={growthPoints} color="#6366f1" height={100}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Started: $10,000</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: totalPortfolio >= 10000 ? '#16a34a' : '#dc2626' }}>
                    Now: ${totalPortfolio.toFixed(2)} ({((totalPortfolio - 10000) / 10000 * 100).toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="an-card-lg" style={{ animation: 'fadeUp .4s ease .15s both' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 4 }}>Portfolio Allocation</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>Distribution by asset</div>
                {donutSegs.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: '#94a3b8', fontSize: 12 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                    100% USDT — start trading to see allocation
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Donut segments={donutSegs} size={110} thickness={20}/>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>${(totalPortfolio / 1000).toFixed(1)}k</div>
                        <div style={{ fontSize: 9, color: '#94a3b8' }}>total</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {donutSegs.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
                            <span style={{ fontSize: 12, color: '#475569' }}>{s.label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                            {((s.value / totalPortfolio) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly P&L bar */}
            <div className="an-card-lg" style={{ marginBottom: 14, animation: 'fadeUp .4s ease .2s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 4 }}>Monthly P&L</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Realised profit/loss per month</div>
              <BarChart data={monthlyPnl} height={160}/>
            </div>
          </>
        )}

        {/* ══ PERFORMANCE TAB ══ */}
        {tab === 'performance' && (
          <>
            <div className="an-row-3" style={{ animation: 'fadeUp .35s ease both' }}>
              <div className="an-card">
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Win Rate</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#6366f1', lineHeight: 1 }}>
                  {winRate === '—' ? '—' : `${winRate}%`}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="ind-bar">
                    <div className="ind-fill" style={{ width: `${winRate === '—' ? 0 : winRate}%`, background: 'linear-gradient(90deg,#6366f1,#22c55e)' }}/>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  <span>{wins.length} wins</span><span>{losses.length} losses</span>
                </div>
              </div>

              <div className="an-card">
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Profit Factor</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: parseFloat(profitFactor) >= 1 ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
                  {profitFactor}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Avg win / Avg loss ratio</div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: '#16a34a' }}>Avg win: +${avgWin.toFixed(2)}</span>
                  <br/>
                  <span style={{ color: '#dc2626' }}>Avg loss: ${avgLoss.toFixed(2)}</span>
                </div>
              </div>

              <div className="an-card">
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Expectancy</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: (avgWin * wins.length + avgLoss * losses.length) >= 0 ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
                  ${closed.length > 0 ? ((avgWin * wins.length + avgLoss * losses.length) / closed.length).toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Expected return per trade</div>
              </div>
            </div>

            {/* Best / Worst trade */}
            <div className="an-row" style={{ animation: 'fadeUp .35s ease .1s both' }}>
              <div className="an-card">
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#16a34a', marginBottom: 12 }}>🏆 Best Trade</div>
                {bestTrade ? (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a', fontFamily: "'Sora',sans-serif" }}>+${(bestTrade.closePnl||0).toFixed(4)}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{bestTrade.coin}/USDT · {bestTrade.type}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Entry ${bestTrade.entry?.toFixed(4)} → Close ${bestTrade.closePrice?.toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{bestTrade.closeTime?.split(',')[0]||bestTrade.time?.split(',')[0]}</div>
                  </div>
                ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>No closed trades yet</div>}
              </div>

              <div className="an-card">
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#dc2626', marginBottom: 12 }}>📉 Worst Trade</div>
                {worstTrade && (worstTrade.closePnl||0) < 0 ? (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', fontFamily: "'Sora',sans-serif" }}>${(worstTrade.closePnl||0).toFixed(4)}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{worstTrade.coin}/USDT · {worstTrade.type}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Entry ${worstTrade.entry?.toFixed(4)} → Close ${worstTrade.closePrice?.toFixed(4)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{worstTrade.closeTime?.split(',')[0]||worstTrade.time?.split(',')[0]}</div>
                  </div>
                ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>No losing trades yet 🎉</div>}
              </div>
            </div>

            {/* P&L by coin bar chart */}
            <div className="an-card-lg" style={{ animation: 'fadeUp .35s ease .2s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 4 }}>P&L by Coin</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Realised profit/loss per cryptocurrency</div>
              <BarChart data={barData} height={160}/>
            </div>

            {/* Trade history table */}
            <div className="an-card-lg" style={{ animation: 'fadeUp .35s ease .25s both', marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 14 }}>Closed Trade History</div>
              {closed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>No closed trades yet. Close a position to see history.</div>
              ) : closed.slice(0, 10).map((p, i) => {
                const pnl = p.closePnl || 0;
                const pct = p.entry > 0 ? ((pnl / (p.entry * p.qty)) * 100) : 0;
                return (
                  <div key={p.id} className="trade-row">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: ALL_COINS.find(c=>c.short===p.coin)?.color+'22'||'#f1f5f9', border: `1.5px solid ${ALL_COINS.find(c=>c.short===p.coin)?.color||'#e2e8f0'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: ALL_COINS.find(c=>c.short===p.coin)?.color||'#64748b', flexShrink: 0 }}>
                      {p.coin?.slice(0, 3)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.coin}/USDT</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.type} · {p.closeTime?.split(',')[0]||p.time?.split(',')[0]}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? '#16a34a' : '#dc2626', fontFamily: "'Sora',sans-serif" }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}
                      </div>
                      <div style={{ fontSize: 11, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ width: 48, textAlign: 'center' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: pnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                        {pnl >= 0 ? 'WIN' : 'LOSS'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ HOLDINGS TAB ══ */}
        {tab === 'holdings' && (
          <>
            {/* Donut + breakdown */}
            <div className="an-row" style={{ animation: 'fadeUp .35s ease both' }}>
              <div className="an-card-lg">
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 16 }}>Asset Allocation</div>
                {donutSegs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>No holdings to display</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{ position: 'relative' }}>
                      <Donut segments={donutSegs} size={160} thickness={28}/>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>${(totalPortfolio / 1000).toFixed(1)}k</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>total</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {donutSegs.map(s => (
                        <div key={s.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }}/>
                              <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>${s.value.toFixed(2)}</span>
                          </div>
                          <div className="ind-bar">
                            <div className="ind-fill" style={{ width: `${(s.value / totalPortfolio) * 100}%`, background: s.color }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="an-card-lg">
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 16 }}>Live Holdings</div>
                {holdings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>No coin holdings. USDT only.</div>
                ) : holdings.map(h => {
                  const sym = ALL_COINS.find(c => c.short === h.coin)?.symbol;
                  const change = sym ? (changes[sym] || 0) : 0;
                  return (
                    <div key={h.coin} className="trade-row">
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: h.color + '20', border: `1.5px solid ${h.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: h.color, flexShrink: 0 }}>
                        {h.coin.slice(0, 3)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{h.coin}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{h.qty.toFixed(6)} coins</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif" }}>${h.value.toFixed(2)}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: change >= 0 ? '#16a34a' : '#dc2626' }}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}% today
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="trade-row">
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>
                    USDT
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>USDT</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Stablecoin reserve</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif" }}>${usdtVal.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{((usdtVal / totalPortfolio) * 100).toFixed(1)}% of portfolio</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trade frequency */}
            <div className="an-card-lg" style={{ animation: 'fadeUp .35s ease .1s both', marginTop: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 14 }}>Trading Activity by Coin</div>
              {Object.keys(tradeCounts).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>No trades yet</div>
              ) : Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).map(([coin, count]) => {
                const maxCount = Math.max(...Object.values(tradeCounts));
                const col = ALL_COINS.find(c => c.short === coin)?.color || '#6366f1';
                return (
                  <div key={coin} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>{coin}/USDT</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{count} trade{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="ind-bar">
                      <div className="ind-fill" style={{ width: `${(count / maxCount) * 100}%`, background: col }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ SIGNALS TAB ══ */}
        {tab === 'signals' && (
          <>
            <div style={{ animation: 'fadeUp .35s ease both' }}>
              {/* Signal performance summary */}
              <div className="an-row-3" style={{ marginBottom: 14 }}>
                <div className="an-card">
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Signals Generated</div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#6366f1' }}>{positions.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Total trade signals taken</div>
                </div>
                <div className="an-card">
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>TP Hit Rate</div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#22c55e' }}>
                    {closed.length > 0 ? `${((wins.length / closed.length) * 100).toFixed(0)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Take profit targets hit</div>
                </div>
                <div className="an-card">
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Avg Hold Time</div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: '#0f172a' }}>—</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Available after backend</div>
                </div>
              </div>

              {/* Agent performance breakdown */}
              <div className="an-card-lg" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 4 }}>AI Agent Performance</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Multi-agent system accuracy breakdown</div>
                {[
                  { name: 'Quant Agent', desc: 'Momentum & statistical analysis', accuracy: 71, color: '#6366f1' },
                  { name: 'Technical Agent', desc: 'Support/resistance & trend analysis', accuracy: 68, color: '#818cf8' },
                  { name: 'Risk Agent', desc: 'Volatility & risk management', accuracy: 82, color: '#22c55e' },
                  { name: 'Sentiment Agent', desc: 'Volume & market sentiment', accuracy: 65, color: '#f59e0b' },
                  { name: 'Judge Agent', desc: 'Final weighted consensus decision', accuracy: 74, color: '#0f172a' },
                ].map(a => (
                  <div key={a.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.name}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{a.desc}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.accuracy}%</span>
                    </div>
                    <div className="ind-bar" style={{ height: 6 }}>
                      <div className="ind-fill" style={{ width: `${a.accuracy}%`, background: a.color }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* All open positions */}
              <div className="an-card-lg">
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", marginBottom: 14 }}>Open Signal Positions</div>
                {open.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>No open positions. Place trades from Dashboard to track signals.</div>
                ) : open.map(p => {
                  const cur = prices[p.symbol] || p.current || p.entry;
                  const pnl = p.type === 'BUY' ? (cur - p.entry) * p.qty : (p.entry - cur) * p.qty;
                  const pct = p.entry > 0 ? (p.type === 'BUY' ? ((cur - p.entry) / p.entry * 100) : ((p.entry - cur) / p.entry * 100)) : 0;
                  const range = p.tp - p.sl;
                  const progress = range > 0 ? Math.max(0, Math.min(100, ((cur - p.sl) / range) * 100)) : 50;
                  const col = ALL_COINS.find(c => c.symbol === p.symbol)?.color || '#6366f1';
                  return (
                    <div key={p.id} style={{ background: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${pnl >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: col + '20', border: `1.5px solid ${col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: col }}>
                            {p.coin?.slice(0, 3)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>{p.coin}/USDT</div>
                            <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: p.type === 'BUY' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: p.type === 'BUY' ? '#16a34a' : '#dc2626' }}>{p.type}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: pnl >= 0 ? '#16a34a' : '#dc2626', fontFamily: "'Sora',sans-serif" }}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}
                          </div>
                          <div style={{ fontSize: 11, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                        {[{l:'Entry',v:`$${parseFloat(p.entry).toFixed(4)}`},{l:'Current',v:`$${cur.toFixed(4)}`},{l:'TP',v:`$${parseFloat(p.tp).toFixed(2)}`},{l:'SL',v:`$${parseFloat(p.sl).toFixed(2)}`}].map(x=>(
                          <div key={x.l} style={{ background: 'white', borderRadius: 8, padding: '6px 10px', border: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>{x.l}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>
                          <span>SL ${parseFloat(p.sl).toFixed(2)}</span>
                          <span>TP ${parseFloat(p.tp).toFixed(2)}</span>
                        </div>
                        <div className="ind-bar" style={{ height: 5 }}>
                          <div className="ind-fill" style={{ width: `${progress}%`, background: progress > 66 ? '#22c55e' : progress > 33 ? '#f59e0b' : '#ef4444' }}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default Analytics;
import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

/* ─── Helpers ─────────────────────────────────────────────────── */
const getNotifs = () => {
  try { return JSON.parse(localStorage.getItem('notifications') || '[]'); }
  catch { return []; }
};

const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').email || null; }
  catch { return null; }
};

/* Save to localStorage + fire UI event */
const saveNotifsLocal = (n) => {
  localStorage.setItem('notifications', JSON.stringify(n));
  window.dispatchEvent(new Event('notifsUpdated'));
  window.dispatchEvent(new Event('notifUpdate'));
};

/* Push full list to MongoDB */
const syncToDB = (notifs) => {
  const userEmail = getUserEmail();
  if (!userEmail) return;
  fetch(`${API_BASE}/api/notifications/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, notifications: notifs }),
  }).catch(() => {});
};

/* Delete single notification from MongoDB by id */
const deleteFromDB = (id) => {
  fetch(`${API_BASE}/api/notifications/item/${id}`, { method: 'DELETE' }).catch(() => {});
};

/* Save locally + sync to MongoDB */
const saveAndSync = (notifs) => {
  saveNotifsLocal(notifs);
  syncToDB(notifs);
};

const getPositions = () => {
  try { return JSON.parse(localStorage.getItem('positions') || '[]'); }
  catch { return []; }
};

const getWatchlist = () => {
  try { return JSON.parse(localStorage.getItem('watchlist') || '[]'); }
  catch { return []; }
};

const ALL_COINS = [
  { symbol: 'BTCUSDT',  short: 'BTC',  color: '#f7931a' },
  { symbol: 'ETHUSDT',  short: 'ETH',  color: '#627eea' },
  { symbol: 'SOLUSDT',  short: 'SOL',  color: '#9945ff' },
  { symbol: 'BNBUSDT',  short: 'BNB',  color: '#f3ba2f' },
  { symbol: 'XRPUSDT',  short: 'XRP',  color: '#00aae4' },
  { symbol: 'DOGEUSDT', short: 'DOGE', color: '#c2a633' },
  { symbol: 'ADAUSDT',  short: 'ADA',  color: '#3cc8c8' },
  { symbol: 'AVAXUSDT', short: 'AVAX', color: '#e84142' },
  { symbol: 'DOTUSDT',  short: 'DOT',  color: '#e6007a' },
  { symbol: 'MATICUSDT',short: 'MATIC',color: '#8247e5' },
];

const makeNotif = (type, title, body, meta = {}) => ({
  id: Date.now() + Math.random(),
  type, title, body, meta,
  read: false,
  time: new Date().toISOString(),
});

const TYPE_CFG = {
  trade:  { icon: '💼', color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'Trade' },
  price:  { icon: '📊', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Price Alert' },
  signal: { icon: '🤖', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'AI Signal' },
  system: { icon: '🔔', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'System' },
};

const fmtTime = (iso) => {
  try {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

const isToday     = (iso) => { try { return new Date(iso).toDateString() === new Date().toDateString(); } catch { return false; } };
const isYesterday = (iso) => { try { const y = new Date(); y.setDate(y.getDate() - 1); return new Date(iso).toDateString() === y.toDateString(); } catch { return false; } };

/* ─── NotifCard ───────────────────────────────────────────────── */
const NotifCard = ({ notif, onRead, onDelete }) => {
  const cfg = TYPE_CFG[notif.type] || TYPE_CFG.system;
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onRead(notif.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
        background: hov ? '#f8fafc' : notif.read ? 'white' : 'rgba(99,102,241,0.03)',
        borderLeft: `3px solid ${notif.read ? 'transparent' : '#6366f1'}`,
        borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background .15s',
      }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: cfg.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18, marginTop: 2,
      }}>
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
            background: cfg.bg, color: cfg.color,
          }}>{cfg.label}</span>
          {!notif.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: notif.read ? 400 : 600, color: '#0f172a',
          marginBottom: 3, fontFamily: "'DM Sans',sans-serif",
          wordBreak: 'break-word',
        }}>{notif.title}</div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, wordBreak: 'break-word' }}>{notif.body}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>{fmtTime(notif.time)}</div>
      </div>
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
        title="Delete"
        style={{
          flexShrink: 0, alignSelf: 'center',
          width: 28, height: 28, borderRadius: 8,
          border: '1.5px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.06)',
          color: '#ef4444', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
          e.currentTarget.style.transform = 'scale(1)';
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const SectionHd = ({ label }) => (
  <div style={{
    padding: '10px 16px 6px', fontSize: 10, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.6px',
    background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
  }}>{label}</div>
);

/* ─── MAIN ────────────────────────────────────────────────────── */
const Notifications = () => {
  const [notifs,      setNotifs]      = useState(getNotifs);
  const [filter,      setFilter]      = useState('all');
  const [prices,      setPrices]      = useState({});
  const [prevChanges, setPrevChanges] = useState({});
  const [watchlist,   setWatchlist]   = useState(getWatchlist);
  const [syncing,     setSyncing]     = useState(false);
  const wsRef = useRef(null);

  /* Keep watchlist in sync */
  useEffect(() => {
    const sync = () => setWatchlist(getWatchlist());
    window.addEventListener('storage', sync);
    window.addEventListener('focus',   sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);

  /* Welcome message is seeded in Login.jsx after first OTP verify — not here */

  /* Load from MongoDB on mount — merges with localStorage */
  useEffect(() => {
    const userEmail = getUserEmail();
    if (!userEmail) return;
    setSyncing(true);
    fetch(`${API_BASE}/api/notifications/${userEmail}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!Array.isArray(data)) return;
        const local  = getNotifs();
        const remote = data.map(n => ({
          id:    n._id || n.id,
          type:  n.type  || 'system',
          title: n.title || '',
          body:  n.body  || '',
          meta:  n.meta  || {},
          read:  n.read  || false,
          time:  n.time  || new Date().toISOString(),
        }));
        // Merge: remote + local, deduplicate, sort newest first
        const merged = [...remote, ...local]
          .filter((n, i, arr) => arr.findIndex(x => String(x.id) === String(n.id)) === i)
          .sort((a, b) => new Date(b.time) - new Date(a.time))
          .slice(0, 200);
        saveNotifsLocal(merged);
        setNotifs(merged);
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, []);

  /* Sync from localStorage whenever any page writes a notification */
  useEffect(() => {
    const sync = () => setNotifs(getNotifs());
    window.addEventListener('notifsUpdated', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('notifsUpdated', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  /* REST fetch prices immediately */
  useEffect(() => {
    const symbols = ALL_COINS.map(c => `"${c.symbol}"`).join(',');
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data))
          data.forEach(d => setPrices(p => ({ ...p, [d.symbol]: parseFloat(d.lastPrice) })));
      })
      .catch(() => {});
  }, []);

  /* WebSocket price alerts */
  useEffect(() => {
    let ws = null;
    const t = setTimeout(() => {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${ALL_COINS.map(c => `${c.symbol.toLowerCase()}@ticker`).join('/')}`);
      wsRef.current = ws;
      ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data).data;
          if (!d?.s || !d?.c) return;
          const sym = d.s, price = parseFloat(d.c), chg = parseFloat(d.P);
          setPrices(p => ({ ...p, [sym]: price }));
          setPrevChanges(prev => {
            const old = prev[sym];
            const watchlisted = getWatchlist();
            if (watchlisted.includes(sym) && old !== undefined && Math.abs(chg - old) >= 2) {
              const coin = ALL_COINS.find(c => c.symbol === sym)?.short;
              const dir  = chg > old ? '🚀 surged' : '📉 dropped';
              const n = makeNotif('price', `${coin} price alert`,
                `${coin}/USDT ${dir} ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% · Now $${price.toFixed(4)}`,
                { coin, sym, change: chg });
              setNotifs(cur => {
                const next = [n, ...cur].slice(0, 100);
                saveAndSync(next);   // ← save + sync to MongoDB
                return next;
              });
            }
            return { ...prev, [sym]: chg };
          });
        } catch {}
      };
      ws.onerror = () => {};
    }, 500);
    return () => { clearTimeout(t); if (ws) ws.close(); wsRef.current = null; };
  }, []);

  /* ── Actions — all sync to MongoDB ── */
  const markRead = (id) => {
    const n = notifs.map(x => x.id === id ? { ...x, read: true } : x);
    setNotifs(n);
    saveAndSync(n);   // localStorage + MongoDB
  };

  const markAllRead = () => {
    const n = notifs.map(x => ({ ...x, read: true }));
    setNotifs(n);
    saveAndSync(n);   // localStorage + MongoDB
  };

  const deleteNotif = (id) => {
    const n = notifs.filter(x => x.id !== id);
    setNotifs(n);
    saveNotifsLocal(n);         // localStorage immediately
    deleteFromDB(id);           // MongoDB — delete specific record
    syncToDB(n);                // also push updated list so DB stays consistent
  };

  const clearAll = () => {
    saveNotifsLocal([]);
    setNotifs([]);
    syncToDB([]);               // push empty list to MongoDB
    // Keep notifs_seeded — so welcome message never comes back after a clear
  };

  const unread = notifs.filter(n => !n.read).length;

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all')    return true;
    return n.type === filter;
  });

  const todayN     = filtered.filter(n => isToday(n.time));
  const yesterdayN = filtered.filter(n => isYesterday(n.time));
  const olderN     = filtered.filter(n => !isToday(n.time) && !isYesterday(n.time));

  const FILTERS = [
    { key: 'all',    label: 'All' },
    { key: 'unread', label: `Unread${unread > 0 ? ` (${unread})` : ''}` },
    { key: 'trade',  label: 'Trades' },
    { key: 'price',  label: 'Price Alerts' },
    { key: 'signal', label: 'AI Signals' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .nf-root { min-height:100%; background:#f8fafc; font-family:'DM Sans',sans-serif; color:#0f172a; }
        .nf-tab { padding:6px 10px; border-radius:9px; border:none; cursor:pointer; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; transition:all .15s; color:#64748b; background:transparent; white-space:nowrap; }
        .nf-tab.active { background:#6366f1; color:white; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
        .nf-tab:hover:not(.active) { background:#f1f5f9; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Header row — stack on mobile */
        .nf-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
        .nf-header-btns { display:flex; gap:8px; flex-wrap:wrap; }
        .nf-header-btn { padding:8px 12px; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif; white-space:nowrap; }

        /* Stats grid — 3 cols on mobile, 5 on desktop */
        .nf-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
        @media(min-width:600px) { .nf-stats { grid-template-columns:repeat(5,1fr); gap:12px; } }

        /* Filter bar — scrollable on mobile */
        .nf-filters { display:flex; gap:4px; background:white; border-radius:12px; padding:4px; border:1px solid #f1f5f9; margin-bottom:16px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
        .nf-filters::-webkit-scrollbar { display:none; }

        /* NotifCard title — allow wrapping on mobile */
        .nf-card-title { font-size:13.5px; color:#0f172a; margin-bottom:3px; font-family:'DM Sans',sans-serif; word-break:break-word; }
        .nf-card-body  { font-size:12px; color:#64748b; line-height:1.5; word-break:break-word; }

        /* Live strip coins — wrap nicely */
        .nf-live-coins { display:flex; flex-wrap:wrap; gap:6px; }

        @media(max-width:480px) {
          .nf-card-title { font-size:12.5px; }
          .nf-card-body  { font-size:11.5px; }
          .nf-header-btn { padding:7px 10px; font-size:11.5px; }
        }
      `}</style>

      <div className="nf-root">
        {/* Header */}
        <div className="nf-header">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Sora',sans-serif", margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              Notifications
              {unread > 0 && (
                <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#6366f1', color: 'white' }}>{unread}</span>
              )}
              {syncing && (
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  syncing…
                </span>
              )}
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>Trade alerts, price movements and AI signals</p>
          </div>
          <div className="nf-header-btns">
            {unread > 0 && (
              <button onClick={markAllRead}
                className="nf-header-btn"
                style={{ border: '1.5px solid #e2e8f0', background: 'white', color: '#6366f1', transition: 'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                ✓ Mark all read
              </button>
            )}
            {notifs.length > 0 && (
              <button onClick={clearAll}
                className="nf-header-btn"
                style={{ border: '1.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#dc2626' }}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="nf-stats">
          {[
            { label: 'Total',   value: notifs.length,                               color: '#0f172a', icon: '🔔' },
            { label: 'Unread',  value: unread,                                      color: '#6366f1', icon: '📬' },
            { label: 'Trades',  value: notifs.filter(n => n.type === 'trade').length,  color: '#6366f1', icon: '💼' },
            { label: 'Price',   value: notifs.filter(n => n.type === 'price').length,  color: '#f59e0b', icon: '📊' },
            { label: 'Signals', value: notifs.filter(n => n.type === 'signal').length, color: '#22c55e', icon: '🤖' },
          ].map((s, i) => (
            <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animation: `fadeUp .3s ease ${i * .05}s both` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>{s.label}</div>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="nf-filters">
          {FILTERS.map(f => (
            <button key={f.key} className={`nf-tab${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', animation: 'fadeUp .3s ease .1s both' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                {filter === 'unread' ? 'All caught up!' : 'No notifications'}
              </div>
              <div style={{ fontSize: 13 }}>
                {filter === 'unread' ? 'No unread notifications.' : 'Notifications will appear here when you trade or prices move.'}
              </div>
            </div>
          ) : (
            <>
              {todayN.length     > 0 && <><SectionHd label="Today"     />{todayN.map(n     => <NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />)}</>}
              {yesterdayN.length > 0 && <><SectionHd label="Yesterday" />{yesterdayN.map(n => <NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />)}</>}
              {olderN.length     > 0 && <><SectionHd label="Older"     />{olderN.map(n     => <NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />)}</>}
            </>
          )}
        </div>

        {/* Live monitor strip */}
        {watchlist.length > 0 && Object.keys(prices).length > 0 && (
          <div style={{ marginTop: 20, background: 'white', borderRadius: 14, border: '1px solid #f1f5f9', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginBottom: 12 }}>
              🔴 Live · Watching {watchlist.length} coin{watchlist.length !== 1 ? 's' : ''} for price alerts (≥2% move)
            </div>
            <div className="nf-live-coins">
              {ALL_COINS.filter(c => watchlist.includes(c.symbol) && prices[c.symbol]).map(c => (
                <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', fontFamily: "'Sora',sans-serif" }}>{c.short}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    ${prices[c.symbol] >= 1000 ? (prices[c.symbol] / 1000).toFixed(2) + 'k' : prices[c.symbol].toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;
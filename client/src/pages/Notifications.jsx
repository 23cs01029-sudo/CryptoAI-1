import { useState, useEffect, useRef } from 'react';

/* ─── Helpers ─────────────────────────────────────────────────── */
const getNotifs = () => {
  try { return JSON.parse(localStorage.getItem('notifications') || '[]'); }
  catch { return []; }
};
const saveNotifs = (n) => {
  localStorage.setItem('notifications', JSON.stringify(n));
  window.dispatchEvent(new Event('notifUpdate'));
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
  {symbol:'BTCUSDT',short:'BTC',color:'#f7931a'},{symbol:'ETHUSDT',short:'ETH',color:'#627eea'},
  {symbol:'SOLUSDT',short:'SOL',color:'#9945ff'},{symbol:'BNBUSDT',short:'BNB',color:'#f3ba2f'},
  {symbol:'XRPUSDT',short:'XRP',color:'#00aae4'},{symbol:'DOGEUSDT',short:'DOGE',color:'#c2a633'},
  {symbol:'ADAUSDT',short:'ADA',color:'#3cc8c8'},{symbol:'AVAXUSDT',short:'AVAX',color:'#e84142'},
  {symbol:'DOTUSDT',short:'DOT',color:'#e6007a'},{symbol:'MATICUSDT',short:'MATIC',color:'#8247e5'},
];

const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user')||'{}').email || null; }
  catch { return null; }
};

const syncNotifsDB = (notifs) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/notifications/sync', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, notifications: notifs }),
  }).catch(()=>{});
};

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
const isYesterday = (iso) => { try { const y = new Date(); y.setDate(y.getDate()-1); return new Date(iso).toDateString() === y.toDateString(); } catch { return false; } };

/* ─── Card ────────────────────────────────────────────────────── */
const NotifCard = ({ notif, onRead, onDelete }) => {
  const cfg = TYPE_CFG[notif.type] || TYPE_CFG.system;
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => onRead(notif.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px',
        background: hov ? '#f8fafc' : notif.read ? 'white' : 'rgba(99,102,241,0.03)',
        borderLeft: `3px solid ${notif.read ? 'transparent' : '#6366f1'}`,
        borderBottom:'1px solid #f1f5f9', cursor:'pointer', transition:'background .15s',
      }}>
      <div style={{ width:40,height:40,borderRadius:12,flexShrink:0,background:cfg.bg,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginTop:2 }}>
        {cfg.icon}
      </div>
      <div style={{ flex:1,minWidth:0,paddingRight:6 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
          <span style={{ padding:'1px 7px',borderRadius:5,fontSize:10,fontWeight:700,
            background:cfg.bg,color:cfg.color }}>{cfg.label}</span>
          {!notif.read && <div style={{ width:6,height:6,borderRadius:'50%',background:'#6366f1',flexShrink:0 }}/>}
        </div>
        <div style={{ fontSize:13.5,fontWeight:notif.read?400:600,color:'#0f172a',
          marginBottom:3,fontFamily:"'DM Sans',sans-serif" }}>{notif.title}</div>
        <div style={{ fontSize:12,color:'#64748b',lineHeight:1.5 }}>{notif.body}</div>
        <div style={{ fontSize:11,color:'#94a3b8',marginTop:5 }}>{fmtTime(notif.time)}</div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
        title="Delete"
        style={{
          flexShrink:0, alignSelf:'center',
          width:28, height:28, borderRadius:8,
          border:'1.5px solid rgba(239,68,68,0.25)',
          background:'rgba(239,68,68,0.06)',
          color:'#ef4444', fontSize:13, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background='rgba(239,68,68,0.15)';
          e.currentTarget.style.borderColor='rgba(239,68,68,0.5)';
          e.currentTarget.style.transform='scale(1.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background='rgba(239,68,68,0.06)';
          e.currentTarget.style.borderColor='rgba(239,68,68,0.25)';
          e.currentTarget.style.transform='scale(1)';
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
};

const SectionHd = ({ label }) => (
  <div style={{ padding:'10px 16px 6px',fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.6px',background:'#f8fafc',borderBottom:'1px solid #f1f5f9' }}>{label}</div>
);

/* ─── MAIN ────────────────────────────────────────────────────── */
const Notifications = () => {
  const [notifs,     setNotifs]     = useState(getNotifs);
  const [filter,     setFilter]     = useState('all');
  const [prices,     setPrices]     = useState({});
  // eslint-disable-next-line no-unused-vars
  const [prevChanges,setPrevChanges]= useState({});
  const [watchlist,  setWatchlist]  = useState(getWatchlist);
  const wsRef = useRef(null);

  /* Keep watchlist in sync when user adds/removes coins */
  useEffect(() => {
    const sync = () => setWatchlist(getWatchlist());
    window.addEventListener('storage', sync);
    window.addEventListener('focus',   sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);

  /* Seed only once ever — just the welcome message on first account creation */
  useEffect(() => {
    const hasSeeded = localStorage.getItem('notifs_seeded');
    if (!hasSeeded) {
      const welcome = makeNotif('system',
        'Welcome to CryptoAI! 🎉',
        'Your account is ready. Explore the Dashboard and place your first trade to get started.'
      );
      saveNotifs([welcome]); setNotifs([welcome]);
      localStorage.setItem('notifs_seeded', '1');
    }
  }, []);

  /* Sync from localStorage whenever any page writes a notification */
  useEffect(() => {
    const sync = () => {
      setNotifs(getNotifs());
    };
    window.addEventListener('notifsUpdated', sync);
    window.addEventListener('focus', sync); // also sync when tab gets focus
    return () => {
      window.removeEventListener('notifsUpdated', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  /* REST fetch prices immediately so live monitor strip shows on load */
  useEffect(() => {
    const symbols = ALL_COINS.map(c => `"${c.symbol}"`).join(',');
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) data.forEach(d => setPrices(p => ({ ...p, [d.symbol]: parseFloat(d.lastPrice) }))); })
      .catch(() => {});
  }, []);

  /* WebSocket price alerts */
  useEffect(() => {
    let ws = null;
    const t = setTimeout(() => {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${ALL_COINS.map(c=>`${c.symbol.toLowerCase()}@ticker`).join('/')}`);
      wsRef.current = ws;
      ws.onmessage = e => {
        try {
          const d = (JSON.parse(e.data)).data;
          if (!d?.s||!d?.c) return;
          const sym=d.s, price=parseFloat(d.c), chg=parseFloat(d.P);
          setPrices(p=>({...p,[sym]:price}));
          setPrevChanges(prev => {
            const old = prev[sym];
            // Only fire alert if coin is in user's watchlist
            const watchlisted = getWatchlist();
            const isWatched = watchlisted.includes(sym);
            if (isWatched && old !== undefined && Math.abs(chg - old) >= 2) {
              const coin = ALL_COINS.find(c=>c.symbol===sym)?.short;
              const dir  = chg > old ? '🚀 surged' : '📉 dropped';
              const n = makeNotif('price',`${coin} price alert`,
                `${coin}/USDT ${dir} ${chg>=0?'+':''}${chg.toFixed(2)}% · Now $${price.toFixed(4)}`,
                {coin,sym,change:chg});
              setNotifs(cur=>{ const next=[n,...cur].slice(0,100); saveNotifs(next); return next; });
            }
            return {...prev,[sym]:chg};
          });
        } catch {}
      };
      ws.onerror = () => {};
    }, 500);
    return () => { clearTimeout(t); if(ws) ws.close(); wsRef.current = null; };
  }, []);

  const markRead    = id  => { const n=notifs.map(x=>x.id===id?{...x,read:true}:x); setNotifs(n); saveNotifs(n); };
  const markAllRead = () => {
    const n = notifs.map(x => ({...x, read:true}));
    setNotifs(n); saveNotifs(n); syncNotifsDB(n);
  };
  const deleteNotif = id => {
    const n = notifs.filter(x => x.id !== id);
    setNotifs(n); saveNotifs(n);
    const userEmail = getUserEmail();
    if (userEmail) fetch(`/api/notifications/item/${id}`, { method:'DELETE' }).catch(()=>{});
  };
  const clearAll = () => {
    saveNotifs([]); setNotifs([]);
    // Keep notifs_seeded flag — so clearing does NOT bring back the seed notifications
    // notifs_seeded stays as '1' → page will never re-seed after a clear
  };

  const unread = notifs.filter(n=>!n.read).length;

  const filtered = notifs.filter(n => {
    if (filter==='unread') return !n.read;
    if (filter==='all')    return true;
    return n.type===filter;
  });

  const todayN     = filtered.filter(n=>isToday(n.time));
  const yesterdayN = filtered.filter(n=>isYesterday(n.time));
  const olderN     = filtered.filter(n=>!isToday(n.time)&&!isYesterday(n.time));

  const FILTERS = [
    {key:'all',    label:'All'},
    {key:'unread', label:`Unread${unread>0?` (${unread})`:''}`},
    {key:'trade',  label:'Trades'},
    {key:'price',  label:'Price Alerts'},
    {key:'signal', label:'AI Signals'},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .nf-root{min-height:100%;background:#f8fafc;font-family:'DM Sans',sans-serif;color:#0f172a;}
        .nf-tab{padding:6px 12px;border-radius:9px;border:none;cursor:pointer;font-size:12.5px;font-weight:500;font-family:'DM Sans',sans-serif;transition:all .15s;color:#64748b;background:transparent;white-space:nowrap;}
        .nf-tab.active{background:#6366f1;color:white;box-shadow:0 2px 8px rgba(99,102,241,0.3);}
        .nf-tab:hover:not(.active){background:#f1f5f9;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      `}</style>

      <div className="nf-root">
        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:26,fontWeight:700,fontFamily:"'Sora',sans-serif",margin:0,letterSpacing:'-0.5px',display:'flex',alignItems:'center',gap:10 }}>
              Notifications
              {unread>0&&<span style={{ padding:'2px 10px',borderRadius:20,fontSize:13,fontWeight:700,background:'#6366f1',color:'white' }}>{unread}</span>}
            </h1>
            <p style={{ fontSize:13,color:'#64748b',margin:'4px 0 0' }}>Trade alerts, price movements and AI signals</p>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            {unread>0&&(
              <button onClick={markAllRead}
                style={{ padding:'8px 14px',borderRadius:10,border:'1.5px solid #e2e8f0',background:'white',color:'#6366f1',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#6366f1'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
                ✓ Mark all read
              </button>
            )}
            {notifs.length>0&&(
              <button onClick={clearAll}
                style={{ padding:'8px 14px',borderRadius:10,border:'1.5px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.05)',color:'#dc2626',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12,marginBottom:20 }}>
          {[
            {label:'Total',     value:notifs.length,                              color:'#0f172a',icon:'🔔'},
            {label:'Unread',    value:unread,                                     color:'#6366f1',icon:'📬'},
            {label:'Trades',    value:notifs.filter(n=>n.type==='trade').length,  color:'#6366f1',icon:'💼'},
            {label:'Price',     value:notifs.filter(n=>n.type==='price').length,  color:'#f59e0b',icon:'📊'},
            {label:'Signals',   value:notifs.filter(n=>n.type==='signal').length, color:'#22c55e',icon:'🤖'},
          ].map((s,i)=>(
            <div key={s.label} style={{ background:'white',borderRadius:12,padding:'14px 16px',border:'1px solid #f1f5f9',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',animation:`fadeUp .3s ease ${i*.05}s both` }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                <div style={{ fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600 }}>{s.label}</div>
                <span style={{ fontSize:16 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize:24,fontWeight:700,color:s.color,fontFamily:"'Sora',sans-serif",lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display:'flex',gap:4,background:'white',borderRadius:12,padding:4,border:'1px solid #f1f5f9',width:'fit-content',marginBottom:16,flexWrap:'wrap' }}>
          {FILTERS.map(f=>(
            <button key={f.key} className={`nf-tab${filter===f.key?' active':''}`} onClick={()=>setFilter(f.key)}>{f.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ background:'white',borderRadius:14,border:'1px solid #f1f5f9',overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,0.05)',animation:'fadeUp .3s ease .1s both' }}>
          {filtered.length===0 ? (
            <div style={{ textAlign:'center',padding:'60px 20px',color:'#94a3b8' }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🔔</div>
              <div style={{ fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6 }}>{filter==='unread'?'All caught up!':'No notifications'}</div>
              <div style={{ fontSize:13 }}>{filter==='unread'?'No unread notifications.':'Notifications will appear here when you trade or prices move.'}</div>
            </div>
          ):(
            <>
              {todayN.length>0&&<><SectionHd label="Today"/>{todayN.map(n=><NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif}/>)}</>}
              {yesterdayN.length>0&&<><SectionHd label="Yesterday"/>{yesterdayN.map(n=><NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif}/>)}</>}
              {olderN.length>0&&<><SectionHd label="Older"/>{olderN.map(n=><NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif}/>)}</>}
            </>
          )}
        </div>

        {/* Live monitor strip — only watchlisted coins */}
        {watchlist.length>0&&Object.keys(prices).length>0&&(
          <div style={{ marginTop:20,background:'white',borderRadius:14,border:'1px solid #f1f5f9',padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,marginBottom:12 }}>
              🔴 Live · Watching {watchlist.length} coin{watchlist.length!==1?'s':''} for price alerts (≥2% move)
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
              {ALL_COINS.filter(c=>watchlist.includes(c.symbol)&&prices[c.symbol]).map(c=>(
                <div key={c.symbol} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,background:'#f8fafc',border:'1px solid #f1f5f9' }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:c.color }}/>
                  <span style={{ fontSize:11,fontWeight:600,color:'#0f172a',fontFamily:"'Sora',sans-serif" }}>{c.short}</span>
                  <span style={{ fontSize:11,color:'#64748b' }}>${prices[c.symbol]>=1000?(prices[c.symbol]/1000).toFixed(2)+'k':prices[c.symbol].toFixed(4)}</span>
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
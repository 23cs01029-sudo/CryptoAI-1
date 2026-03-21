import { useState, useEffect, useRef } from 'react';

/* ─── Helpers ─────────────────────────────────────────────────── */
const getNotifs = () => {
  try { return JSON.parse(localStorage.getItem('notifications') || '[]'); }
  catch { return []; }
};
const saveNotifs = (n) => localStorage.setItem('notifications', JSON.stringify(n));

const getPositions = () => {
  try { return JSON.parse(localStorage.getItem('positions') || '[]'); }
  catch { return []; }
};

const ALL_COINS = [
  {symbol:'BTCUSDT',short:'BTC',color:'#f7931a'},{symbol:'ETHUSDT',short:'ETH',color:'#627eea'},
  {symbol:'SOLUSDT',short:'SOL',color:'#9945ff'},{symbol:'BNBUSDT',short:'BNB',color:'#f3ba2f'},
  {symbol:'XRPUSDT',short:'XRP',color:'#00aae4'},{symbol:'DOGEUSDT',short:'DOGE',color:'#c2a633'},
  {symbol:'ADAUSDT',short:'ADA',color:'#3cc8c8'},{symbol:'AVAXUSDT',short:'AVAX',color:'#e84142'},
  {symbol:'DOTUSDT',short:'DOT',color:'#e6007a'},{symbol:'MATICUSDT',short:'MATIC',color:'#8247e5'},
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
const isYesterday = (iso) => { try { const y = new Date(); y.setDate(y.getDate()-1); return new Date(iso).toDateString() === y.toDateString(); } catch { return false; } };

/* ─── Card ────────────────────────────────────────────────────── */
const NotifCard = ({ notif, onRead, onDelete }) => {
  const cfg = TYPE_CFG[notif.type] || TYPE_CFG.system;
  return (
    <div onClick={() => onRead(notif.id)}
      style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px',
        background: notif.read ? 'white' : 'rgba(99,102,241,0.03)',
        borderLeft: `3px solid ${notif.read ? 'transparent' : '#6366f1'}`,
        borderBottom:'1px solid #f1f5f9', cursor:'pointer', transition:'background .15s' }}
      onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background=notif.read?'white':'rgba(99,102,241,0.03)'}>
      <div style={{ width:40,height:40,borderRadius:12,flexShrink:0,background:cfg.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginTop:2 }}>{cfg.icon}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
          <span style={{ padding:'1px 7px',borderRadius:5,fontSize:10,fontWeight:700,background:cfg.bg,color:cfg.color }}>{cfg.label}</span>
          {!notif.read && <div style={{ width:6,height:6,borderRadius:'50%',background:'#6366f1',flexShrink:0 }}/>}
        </div>
        <div style={{ fontSize:13.5,fontWeight:notif.read?400:600,color:'#0f172a',marginBottom:3,fontFamily:"'DM Sans',sans-serif" }}>{notif.title}</div>
        <div style={{ fontSize:12,color:'#64748b',lineHeight:1.5 }}>{notif.body}</div>
        <div style={{ fontSize:11,color:'#94a3b8',marginTop:5 }}>{fmtTime(notif.time)}</div>
      </div>
      <button onClick={e=>{e.stopPropagation();onDelete(notif.id);}}
        style={{ background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',fontSize:14,padding:'2px 4px',borderRadius:4,flexShrink:0,opacity:0,transition:'opacity .15s' }}
        onMouseEnter={e=>{e.currentTarget.style.opacity=1;e.currentTarget.style.color='#ef4444';}}
        onMouseLeave={e=>{e.currentTarget.style.opacity=0;e.currentTarget.style.color='#cbd5e1';}}>✕</button>
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
  const [prevChanges,setPrevChanges]= useState({});
  const wsRef = useRef(null);

  /* Seed if empty */
  useEffect(() => {
    if (getNotifs().length === 0) {
      const seed = [
        makeNotif('system','Welcome to CryptoAI! 🎉','Your account is ready. Start by exploring the Dashboard and placing your first trade.'),
        makeNotif('signal','AI Signal: BTC BUY','Quant Agent detected bullish momentum. Entry $84,200 · TP $88,800 · SL $81,500 · Confidence 76%',{coin:'BTC',action:'BUY'}),
        makeNotif('price','SOL price alert 🚀','SOL/USDT moved +2.3% in the last hour. Current price: $147.80',{coin:'SOL',change:2.3}),
        makeNotif('trade','Trade executed: BUY SOL','Bought 1.000000 SOL @ $145.00 · TP: $152.25 · SL: $140.65',{coin:'SOL',type:'BUY'}),
      ];
      seed.forEach((n,i)=>{ n.time=new Date(Date.now()-i*7200000).toISOString(); });
      saveNotifs(seed); setNotifs(seed);
    }
  }, []);

  /* Listen for trade events */
  useEffect(() => {
    const onTrade = () => {
      const pos = getPositions();
      const latest = pos[0]; if (!latest) return;
      const existing = getNotifs();
      if (existing.some(n => n.meta?.posId === latest.id)) return;
      const n = makeNotif('trade',
        `Trade: ${latest.type} ${latest.coin}/USDT`,
        `${latest.type==='BUY'?'Bought':'Sold'} ${latest.qty} ${latest.coin} @ $${parseFloat(latest.entry).toFixed(2)} · TP $${parseFloat(latest.tp).toFixed(2)} · SL $${parseFloat(latest.sl).toFixed(2)}`,
        { coin:latest.coin, type:latest.type, posId:latest.id }
      );
      const next = [n,...existing]; saveNotifs(next); setNotifs(next);
    };
    window.addEventListener('walletUpdate', onTrade);
    return () => window.removeEventListener('walletUpdate', onTrade);
  }, []);

  /* WebSocket price alerts */
  useEffect(() => {
    const t = setTimeout(() => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${ALL_COINS.map(c=>`${c.symbol.toLowerCase()}@ticker`).join('/')}`);
      wsRef.current = ws;
      ws.onmessage = e => {
        try {
          const d = (JSON.parse(e.data)).data;
          if (!d?.s||!d?.c) return;
          const sym=d.s, price=parseFloat(d.c), chg=parseFloat(d.P);
          setPrices(p=>({...p,[sym]:price}));
          setPrevChanges(prev => {
            const old = prev[sym];
            if (old !== undefined && Math.abs(chg - old) >= 2) {
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
    }, 200);
    return () => { clearTimeout(t); wsRef.current?.close(); };
  }, []);

  const markRead    = id  => { const n=notifs.map(x=>x.id===id?{...x,read:true}:x); setNotifs(n); saveNotifs(n); };
  const markAllRead = ()  => { const n=notifs.map(x=>({...x,read:true})); setNotifs(n); saveNotifs(n); };
  const deleteNotif = id  => { const n=notifs.filter(x=>x.id!==id); setNotifs(n); saveNotifs(n); };
  const clearAll    = ()  => { saveNotifs([]); setNotifs([]); };

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

        {/* Live monitor strip */}
        {Object.keys(prices).length>0&&(
          <div style={{ marginTop:20,background:'white',borderRadius:14,border:'1px solid #f1f5f9',padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,marginBottom:12 }}>
              🔴 Live · Monitoring for price alerts (≥2% move triggers notification)
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
              {ALL_COINS.filter(c=>prices[c.symbol]).map(c=>(
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
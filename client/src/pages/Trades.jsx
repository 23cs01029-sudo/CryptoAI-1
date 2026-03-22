import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

/* ─── Helpers ────────────────────────────────────────────────── */
const getWallet = () => {
  try { return JSON.parse(localStorage.getItem('wallet') || '{"USDT":10000}'); }
  catch { return { USDT: 10000 }; }
};
const saveWallet = (w) => {
  localStorage.setItem('wallet', JSON.stringify(w));
  window.dispatchEvent(new Event('walletUpdate'));
  syncWallet(w);
};
const getPositions = () => {
  try { return JSON.parse(localStorage.getItem('positions') || '[]'); }
  catch { return []; }
};
const getTxns = () => {
  try { return JSON.parse(localStorage.getItem('wallet_txns') || '[]'); }
  catch { return []; }
};

/* ─── Backend sync helpers ───────────────────────────────────── */
const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user')||'{}').email || null; }
  catch { return null; }
};

const syncWallet = (wallet) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/wallet`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, balances: wallet }),
  }).catch(()=>{});
};

const syncPositions = (positions) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/positions`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, positions }),
  }).catch(()=>{});
};

const syncTxns = (txns) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/txns`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, txns }),
  }).catch(()=>{});
};

const syncTrade = (type, coin, symbol, qty, price, pnl=0) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/trades`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, type, coin, symbol, qty, price, pnl }),
  }).catch(()=>{});
};

const syncWatchlist = (watchlist) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/watchlist`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, symbols: watchlist }),
  }).catch(()=>{});
};

/* ─── Notification helper ────────────────────────────────────── */
const EMAILJS_SERVICE_ID     = "service_7eo8n3g";
const EMAILJS_TEMPLATE_NOTIF = "template_xpa7txr";
const EMAILJS_PUBLIC_KEY     = "RJjsxL_MNFrrHk61S";

const pushNotif = (type, title, body, meta={}) => {
  try {
    const existing = JSON.parse(localStorage.getItem('notifications')||'[]');
    // Deduplicate — skip if same title+body added in last 10 seconds
    const now = Date.now();
    const isDuplicate = existing.some(x =>
      x.title === title && x.body === body &&
      now - new Date(x.time).getTime() < 10000
    );
    if (isDuplicate) return;
    const n = { id:now+Math.random(), type, title, body, meta, read:false, time:new Date().toISOString() };
    localStorage.setItem('notifications', JSON.stringify([n,...existing].slice(0,100)));
    window.dispatchEvent(new Event('notifsUpdated'));
    if (type === 'trade' || type === 'signal') {
      const userEmail = getUserEmail();
      if (userEmail) {
        if (window.emailjs) {
          window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_NOTIF,
            { to_email:userEmail, title, body, type, app_name:'CryptoAI' },
            EMAILJS_PUBLIC_KEY).catch(()=>{});
        }
        fetch(`${API_BASE}/api/notifications`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ userEmail, type, title, body, meta }),
        }).catch(()=>{});
      }
    }
  } catch {}
};

const ALL_COINS = [
  {symbol:'BTCUSDT', name:'Bitcoin',   short:'BTC',  color:'#f7931a',bg:'rgba(247,147,26,0.12)'},
  {symbol:'ETHUSDT', name:'Ethereum',  short:'ETH',  color:'#627eea',bg:'rgba(98,126,234,0.12)'},
  {symbol:'SOLUSDT', name:'Solana',    short:'SOL',  color:'#9945ff',bg:'rgba(153,69,255,0.12)'},
  {symbol:'BNBUSDT', name:'BNB',       short:'BNB',  color:'#f3ba2f',bg:'rgba(243,186,47,0.12)'},
  {symbol:'XRPUSDT', name:'XRP',       short:'XRP',  color:'#00aae4',bg:'rgba(0,170,228,0.12)'},
  {symbol:'DOGEUSDT',name:'Dogecoin',  short:'DOGE', color:'#c2a633',bg:'rgba(194,166,51,0.12)'},
  {symbol:'ADAUSDT', name:'Cardano',   short:'ADA',  color:'#3cc8c8',bg:'rgba(60,200,200,0.12)'},
  {symbol:'AVAXUSDT',name:'Avalanche', short:'AVAX', color:'#e84142',bg:'rgba(232,65,66,0.12)'},
  {symbol:'DOTUSDT', name:'Polkadot',  short:'DOT',  color:'#e6007a',bg:'rgba(230,0,122,0.12)'},
  {symbol:'MATICUSDT',name:'Polygon',  short:'MATIC',color:'#8247e5',bg:'rgba(130,71,229,0.12)'},
];
const coinInfo = (short) => ALL_COINS.find(c=>c.short===short) || ALL_COINS.find(c=>c.symbol===short) || {color:'#6366f1',bg:'rgba(99,102,241,0.12)',short,name:short,symbol:short+'USDT'};
const TIME_FILTERS = ['1H','1D','1W','1M','1Y'];

/* ─── Chart helpers ──────────────────────────────────────────── */
const fmtXLabel = (label, tf) => {
  try {
    const d = new Date(label);
    if (isNaN(d)) return label;
    if (tf==='1H') return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (tf==='1D') return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (tf==='1W') return d.toLocaleDateString([],{weekday:'short'})+' '+d.toLocaleTimeString([],{hour:'2-digit',hour12:false});
    if (tf==='1M') return d.toLocaleDateString([],{month:'short',day:'numeric'});
    if (tf==='1Y') return d.toLocaleDateString([],{month:'short',year:'2-digit'});
    return label;
  } catch { return label; }
};

const PX_PER_PT = { '1H':18, '1D':12, '1W':16, '1M':14, '1Y':18 };
const X_TICKS   = { '1H':6,  '1D':6,  '1W':7,  '1M':10, '1Y':12 };
const Y_W = 58;

/* ─── Line Chart ─────────────────────────────────────────────── */
const LineChart = ({ data, color, timeFilter='1D' }) => {
  const wrapRef   = useRef(null);
  const scrollRef = useRef(null);
  const [hov, setHov]     = useState(null);
  const [zoom, setZoom]   = useState(1);
  const [contW, setContW] = useState(360);
  const lastDist = useRef(null);

  useEffect(()=>{
    const ro = new ResizeObserver(e=>setContW(e[0].contentRect.width||360));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return ()=>ro.disconnect();
  },[]);

  // Scroll to right (latest data) whenever data or zoom changes
  useEffect(()=>{
    if(scrollRef.current){
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  },[data, zoom]);

  if (!data||data.length<2) return (
    <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:13}}>Loading…</div>
  );

  const pxPer   = (PX_PER_PT[timeFilter]||12) * zoom;
  const CHART_W = Math.max(contW - Y_W, data.length * pxPer);
  const H=210, PT=14, PB=36, CH=H-PT-PB;

  const mn=Math.min(...data.map(d=>d.price)), mx=Math.max(...data.map(d=>d.price));
  const rng=mx-mn||mn*.01||1, pad=rng*.1, yMin=mn-pad, yMax=mx+pad, yRng=yMax-yMin;
  const toX = i => (i/(data.length-1))*CHART_W;
  const toY = v => PT+(1-(v-yMin)/yRng)*CH;
  const pts  = data.map((d,i)=>({x:toX(i),y:toY(d.price),...d}));

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){
    const p=pts[i-1],c=pts[i],cpx=(p.x+c.x)/2;
    pathD+=` C ${cpx} ${p.y}, ${cpx} ${c.y}, ${c.x} ${c.y}`;
  }
  const areaD = `${pathD} L ${pts[pts.length-1].x} ${PT+CH} L ${pts[0].x} ${PT+CH} Z`;
  const yTicks = Array.from({length:5},(_,i)=>yMin+(yRng/4)*i).reverse();
  const gid = `lc${color.replace('#','')}`;
  const nTicks = X_TICKS[timeFilter]||6;
  const xTickIdxs = Array.from({length:nTicks},(_,i)=>Math.round(i*(data.length-1)/(nTicks-1)));

  const onTouchMove = e => {
    if (e.touches.length===2) {
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (lastDist.current) setZoom(z=>Math.max(0.4,Math.min(6,z*(dist/lastDist.current))));
      lastDist.current=dist;
    }
  };

  const onMouseMove = e => {
    const scroll=scrollRef.current?.scrollLeft||0;
    const rect=scrollRef.current?.getBoundingClientRect();
    if(!rect) return;
    const rawX = e.clientX - rect.left + scroll;
    const idx = Math.round(rawX/CHART_W*(data.length-1));
    setHov(pts[Math.max(0,Math.min(data.length-1,idx))]);
  };

  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',userSelect:'none'}}>
      {hov&&(
        <div style={{position:'absolute',zIndex:30,pointerEvents:'none',
          left:'50%',top:4,transform:'translateX(-50%)',
          background:'#1e293b',border:'1px solid #334155',borderRadius:8,padding:'6px 12px',
          fontSize:12,color:'white',whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(0,0,0,0.25)'}}>
          <div style={{fontWeight:700,fontSize:13}}>${hov.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})}</div>
          <div style={{color:'#94a3b8',fontSize:10,marginTop:1}}>{fmtXLabel(hov.label,timeFilter)}</div>
        </div>
      )}
      <div style={{display:'flex',width:'100%',alignItems:'flex-start'}}>
        <div ref={scrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden',
          WebkitOverflowScrolling:'touch',
          scrollbarWidth:'thin',scrollbarColor:'#e2e8f0 transparent',
          cursor:'crosshair',minWidth:0}}
          onMouseMove={onMouseMove} onMouseLeave={()=>setHov(null)}
          onTouchMove={onTouchMove} onTouchEnd={()=>{lastDist.current=null;}}
          onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(z=>Math.max(0.4,Math.min(6,z*(e.deltaY>0?0.9:1.1))));}}}>
          <svg width={CHART_W} height={H} style={{display:'block',minWidth:'100%'}}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
                <stop offset="85%" stopColor={color} stopOpacity="0.02"/>
              </linearGradient>
              <clipPath id={`clip${gid}`}><rect x="0" y="0" width={CHART_W} height={PT+CH}/></clipPath>
            </defs>
            {yTicks.map((v,i)=>(
              <line key={i} x1={0} y1={toY(v)} x2={CHART_W} y2={toY(v)} stroke="#f1f5f9" strokeWidth="1"/>
            ))}
            <g clipPath={`url(#clip${gid})`}>
              <path d={areaD} fill={`url(#${gid})`}/>
              <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
            </g>
            <line x1={0} y1={PT+CH} x2={CHART_W} y2={PT+CH} stroke="#e2e8f0" strokeWidth="1"/>
            {xTickIdxs.map(idx=>{
              const x=toX(idx);
              return(<g key={idx}>
                <line x1={x} y1={PT+CH} x2={x} y2={PT+CH+5} stroke="#cbd5e1" strokeWidth="1"/>
                <text x={x} y={H-8} fill="#475569" fontSize="11" fontFamily="'DM Sans',sans-serif"
                  textAnchor="middle" fontWeight="500">
                  {fmtXLabel(data[idx]?.label,timeFilter)}
                </text>
              </g>);
            })}
            {hov&&<>
              <line x1={hov.x} y1={PT} x2={hov.x} y2={PT+CH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" opacity=".7"/>
              <circle cx={hov.x} cy={hov.y} r="4" fill={color} stroke="white" strokeWidth="2"/>
            </>}
          </svg>
        </div>
        <div style={{width:Y_W,flexShrink:0,background:'white',borderLeft:'1px solid #f1f5f9',
          position:'sticky',right:0,zIndex:10}}>
          <svg width={Y_W} height={H} style={{display:'block'}}>
            {yTicks.map((v,i)=>{
              const y=toY(v);
              return(<g key={i}>
                <line x1={0} y1={y} x2={6} y2={y} stroke="#cbd5e1" strokeWidth="1"/>
                <text x={Y_W-5} y={y+4} fill="#334155" fontSize="11" fontFamily="'DM Sans',sans-serif"
                  textAnchor="end" fontWeight="600">
                  {v>=1000?(v/1000).toFixed(1)+'k':v>=1?v.toFixed(2):v.toFixed(4)}
                </text>
              </g>);
            })}
            {hov&&<>
              <rect x={1} y={toY(hov.price)-10} width={Y_W-2} height={20} rx="4" fill={color}/>
              <text x={Y_W-5} y={toY(hov.price)+5} fill="white" fontSize="11"
                textAnchor="end" fontFamily="'DM Sans',sans-serif" fontWeight="700">
                {hov.price>=1000?(hov.price/1000).toFixed(2)+'k':hov.price.toFixed(2)}
              </text>
            </>}
          </svg>
        </div>
      </div>
    </div>
  );
};

/* ─── Candlestick Chart ──────────────────────────────────────── */
const CandleChart = ({ candles, timeFilter='1D' }) => {
  const wrapRef   = useRef(null);
  const scrollRef = useRef(null);
  const [hov, setHov]     = useState(null);
  const [zoom, setZoom]   = useState(1);
  const [contW, setContW] = useState(360);
  const lastDist = useRef(null);

  useEffect(()=>{
    const ro = new ResizeObserver(e=>setContW(e[0].contentRect.width||360));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return ()=>ro.disconnect();
  },[]);

  // Scroll to right (latest data) whenever candles or zoom changes
  useEffect(()=>{
    if(scrollRef.current){
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  },[candles, zoom]);

  if (!candles||candles.length<2) return (
    <div style={{height:240,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:13}}>Loading candles…</div>
  );

  const data    = candles;
  const pxPer   = (PX_PER_PT[timeFilter]||12) * zoom;
  const CHART_W = Math.max(contW - Y_W, data.length * pxPer);
  const H=185, VOL_H=40, PT=10, PB=36, CH=H-PT;
  const TOTAL_H = H + VOL_H;

  const mn=Math.min(...data.map(c=>c.l)), mx=Math.max(...data.map(c=>c.h));
  const rng=mx-mn||1, pad=rng*.06, yMin=mn-pad, yMax=mx+pad, yRng=yMax-yMin;
  const toY = v => PT+(1-(v-yMin)/yRng)*CH;
  const maxVol = Math.max(...data.map(c=>c.v||0))||1;
  const totalW = CHART_W/data.length;
  const bodyW  = Math.max(2,Math.min(20,totalW*.65));
  const wickW  = Math.max(1,bodyW*.15);
  const yTicks = Array.from({length:5},(_,i)=>yMin+(yRng/4)*i).reverse();
  const nTicks = X_TICKS[timeFilter]||6;
  const xTickIdxs = Array.from({length:nTicks},(_,i)=>Math.round(i*(data.length-1)/(nTicks-1)));

  const onTouchMove = e => {
    if (e.touches.length===2) {
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if (lastDist.current) setZoom(z=>Math.max(0.3,Math.min(6,z*(dist/lastDist.current))));
      lastDist.current=dist;
    }
  };

  return (
    <div ref={wrapRef} style={{position:'relative',width:'100%',userSelect:'none'}}>
      {hov&&(
        <div style={{position:'absolute',zIndex:30,pointerEvents:'none',
          left:'50%',top:4,transform:'translateX(-50%)',
          background:'#1e293b',border:'1px solid #334155',borderRadius:8,padding:'8px 12px',
          fontSize:11,color:'white',whiteSpace:'nowrap',lineHeight:1.9,
          boxShadow:'0 4px 16px rgba(0,0,0,0.25)'}}>
          <div style={{display:'grid',gridTemplateColumns:'30px 1fr',gap:'0 4px'}}>
            <span style={{color:'#94a3b8',fontSize:9}}>Open</span><span style={{fontWeight:600}}>${hov.o?.toFixed(4)}</span>
            <span style={{color:'#94a3b8',fontSize:9}}>High</span><span style={{color:'#22c55e',fontWeight:600}}>${hov.h?.toFixed(4)}</span>
            <span style={{color:'#94a3b8',fontSize:9}}>Low</span><span style={{color:'#ef4444',fontWeight:600}}>${hov.l?.toFixed(4)}</span>
            <span style={{color:'#94a3b8',fontSize:9}}>Close</span><span style={{fontWeight:700,color:hov.c>=hov.o?'#22c55e':'#ef4444'}}>${hov.c?.toFixed(4)}</span>
          </div>
          <div style={{color:'#64748b',fontSize:9,marginTop:2,borderTop:'1px solid #334155',paddingTop:2}}>{fmtXLabel(hov.label,timeFilter)}</div>
        </div>
      )}
      <div style={{display:'flex',width:'100%',alignItems:'flex-start'}}>
        <div ref={scrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden',
          WebkitOverflowScrolling:'touch',
          scrollbarWidth:'thin',scrollbarColor:'#e2e8f0 transparent',
          cursor:'crosshair',minWidth:0}}
          onTouchMove={onTouchMove} onTouchEnd={()=>{lastDist.current=null;}}
          onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(z=>Math.max(0.3,Math.min(6,z*(e.deltaY>0?0.9:1.1))));}}}>
          <svg width={CHART_W} height={TOTAL_H+PB} style={{display:'block',minWidth:'100%'}}
            onMouseLeave={()=>setHov(null)}>
            <defs><clipPath id="cc"><rect x="0" y="0" width={CHART_W} height={TOTAL_H}/></clipPath></defs>
            {yTicks.map((v,i)=>(
              <line key={i} x1={0} y1={toY(v)} x2={CHART_W} y2={toY(v)} stroke="#f1f5f9" strokeWidth="1"/>
            ))}
            <line x1={0} y1={H+2} x2={CHART_W} y2={H+2} stroke="#e2e8f0" strokeWidth="1"/>
            <text x={4} y={H+15} fill="#94a3b8" fontSize="9" fontFamily="'DM Sans',sans-serif">Vol</text>
            <g clipPath="url(#cc)">
              {data.map((c,i)=>{
                const cx=(i+.5)*totalW, isUp=c.c>=c.o, col=isUp?'#22c55e':'#ef4444';
                const bTop=toY(Math.max(c.o,c.c)), bH=Math.max(1.5,Math.abs(toY(c.o)-toY(c.c)));
                const volH=((c.v||0)/maxVol)*(VOL_H-6), volY=H+2+(VOL_H-6-volH);
                return(<g key={i}>
                  <line x1={cx} y1={toY(c.h)} x2={cx} y2={bTop} stroke={col} strokeWidth={wickW}/>
                  <line x1={cx} y1={bTop+bH} x2={cx} y2={toY(c.l)} stroke={col} strokeWidth={wickW}/>
                  <rect x={cx-bodyW/2} y={bTop} width={bodyW} height={bH} fill={col} rx="1"/>
                  <rect x={cx-bodyW/2} y={volY} width={bodyW} height={Math.max(1,volH)} fill={col} opacity=".45" rx="1"/>
                  <rect x={cx-totalW/2} y={0} width={totalW} height={TOTAL_H} fill="transparent"
                    onMouseEnter={()=>setHov({...c,cx,label:c.label})}
                    onTouchStart={()=>setHov({...c,cx,label:c.label})}/>
                </g>);
              })}
            </g>
            <line x1={0} y1={TOTAL_H} x2={CHART_W} y2={TOTAL_H} stroke="#e2e8f0" strokeWidth="1"/>
            {xTickIdxs.map(idx=>{
              const cx=(idx+.5)*totalW;
              return(<g key={idx}>
                <line x1={cx} y1={TOTAL_H} x2={cx} y2={TOTAL_H+5} stroke="#cbd5e1" strokeWidth="1"/>
                <text x={cx} y={TOTAL_H+PB-8} fill="#475569" fontSize="11"
                  fontFamily="'DM Sans',sans-serif" textAnchor="middle" fontWeight="500">
                  {fmtXLabel(data[idx]?.label,timeFilter)}
                </text>
              </g>);
            })}
            {hov&&<line x1={hov.cx} y1={PT} x2={hov.cx} y2={TOTAL_H} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" opacity=".6"/>}
          </svg>
        </div>
        <div style={{width:Y_W,flexShrink:0,background:'white',borderLeft:'1px solid #f1f5f9',
          position:'sticky',right:0,zIndex:10}}>
          <svg width={Y_W} height={TOTAL_H+PB} style={{display:'block'}}>
            {yTicks.map((v,i)=>{
              const y=toY(v);
              return(<g key={i}>
                <line x1={0} y1={y} x2={6} y2={y} stroke="#cbd5e1" strokeWidth="1"/>
                <text x={Y_W-5} y={y+4} fill="#334155" fontSize="11" fontFamily="'DM Sans',sans-serif"
                  textAnchor="end" fontWeight="600">
                  {v>=1000?(v/1000).toFixed(1)+'k':v>=1?v.toFixed(2):v.toFixed(4)}
                </text>
              </g>);
            })}
            {hov&&<>
              <rect x={1} y={toY(hov.c)-10} width={Y_W-2} height={20} rx="4" fill={hov.c>=hov.o?'#22c55e':'#ef4444'}/>
              <text x={Y_W-5} y={toY(hov.c)+5} fill="white" fontSize="11"
                textAnchor="end" fontFamily="'DM Sans',sans-serif" fontWeight="700">
                {hov.c>=1000?(hov.c/1000).toFixed(1)+'k':hov.c?.toFixed(2)}
              </text>
            </>}
          </svg>
        </div>
      </div>
    </div>
  );
};


/* ─── Sort Modal ─────────────────────────────────────────────── */
const SortModal = ({ onClose, sortBy, setSortBy, sortDir, setSortDir, options }) => (
  <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
    onClick={onClose}>
    <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.4)',backdropFilter:'blur(4px)'}}/>
    <div onClick={e=>e.stopPropagation()}
      style={{position:'relative',zIndex:1,width:'100%',maxWidth:600,background:'white',
        borderRadius:'20px 20px 0 0',border:'1px solid #e2e8f0',padding:'24px 24px 36px',
        boxShadow:'0 -8px 32px rgba(0,0,0,0.1)',animation:'slideUp 0.22s cubic-bezier(.22,1,.36,1) both'}}>
      <div style={{width:36,height:4,borderRadius:2,background:'#e2e8f0',margin:'0 auto 20px'}}/>
      <div style={{fontSize:17,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",marginBottom:16}}>Sort by</div>
      {options.map(o=>(
        <div key={o.key} onClick={()=>setSortBy(o.key)}
          style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
          <div style={{width:20,height:20,borderRadius:'50%',
            border:`2px solid ${sortBy===o.key?'#22c55e':'#e2e8f0'}`,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            {sortBy===o.key&&<div style={{width:8,height:8,borderRadius:'50%',background:'#22c55e'}}/>}
          </div>
          <span style={{fontSize:14,fontWeight:500,color:sortBy===o.key?'#0f172a':'#64748b'}}>{o.label}</span>
        </div>
      ))}
      <div style={{display:'flex',gap:10,marginTop:16}}>
        {['desc','asc'].map(d=>(
          <button key={d} onClick={()=>setSortDir(d)}
            style={{flex:1,padding:'10px 0',borderRadius:10,cursor:'pointer',
              border:`1.5px solid ${sortDir===d?'#22c55e':'#e2e8f0'}`,
              background:sortDir===d?'rgba(34,197,94,0.07)':'transparent',
              color:sortDir===d?'#16a34a':'#64748b',
              fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
            {d==='desc'?'↓ High to low':'↑ Low to high'}
          </button>
        ))}
      </div>
      <button onClick={onClose}
        style={{width:'100%',padding:'14px',marginTop:14,background:'#22c55e',color:'white',
          border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif"}}>
        Apply
      </button>
    </div>
  </div>
);

/* ─── Toast ──────────────────────────────────────────────────── */
const Toast = ({msg}) => !msg ? null : (
  <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',
    padding:'12px 20px',borderRadius:12,fontSize:13,fontWeight:600,
    fontFamily:"'DM Sans',sans-serif",zIndex:500,whiteSpace:'nowrap',
    background:msg.ok?'#0f172a':'#dc2626',color:'white',
    boxShadow:'0 4px 20px rgba(0,0,0,0.18)',animation:'toastIn .25s ease'}}>
    {msg.ok?'✓ ':'✕ '}{msg.text}
  </div>
);

/* ─── TRADES PAGE ────────────────────────────────────────────── */
const Trades = () => {
  const [positions, setPositions] = useState(getPositions);
  const [wallet,    setWallet]    = useState(getWallet);
  const [txns,      setTxns]      = useState(getTxns);
  const [prices,    setPrices]    = useState({});
  const [changes,   setChanges]   = useState({});
  const [volumes,   setVolumes]   = useState({});
  const [toast,     setToast]     = useState(null);

  // tabs
  const [tab, setTab] = useState('open');

  // coin detail view (like Dashboard)
  const location = useLocation();

  const [selected,   setSelected]   = useState(null);
  const [chartData,  setChartData]  = useState([]);
  const [candles,    setCandles]    = useState([]);
  const [chartType,  setChartType]  = useState('candle');
  const [timeFilter, setTimeFilter] = useState('1D');
  const [chartLoad,  setChartLoad]  = useState(false);
  const [detailTab,  setDetailTab]  = useState('chart');
  const [tradeType,  setTradeType]  = useState('BUY');
  const [tradeAmt,   setTradeAmt]   = useState('');
  const [tradeQty,   setTradeQty]   = useState('');
  const [aiSignal,   setAiSignal]   = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);

  // search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ,    setSearchQ]    = useState('');
  const searchRef = useRef(null);

  // sort
  const [sortBy,   setSortBy]   = useState('value');
  const [sortDir,  setSortDir]  = useState('desc');
  const [showSort, setShowSort] = useState(false);

  const showToast = (text, ok=true) => {
    setToast({text,ok}); setTimeout(()=>setToast(null),3000);
  };

  /* Clear selected coin when navigating away */
  useEffect(()=>{
    setSelected(null);
  },[location.pathname]);

  /* Sync */
  useEffect(()=>{
    const sync = ()=>{
      setPositions(getPositions());
      setWallet(getWallet());
      setTxns(getTxns());
    };
    window.addEventListener('walletUpdate', sync);
    window.addEventListener('focus', sync);
    return()=>{ window.removeEventListener('walletUpdate',sync); window.removeEventListener('focus',sync); };
  },[]);

  /* Load ALL data from MongoDB on mount — cross-device sync */
  useEffect(()=>{
    const userEmail = getUserEmail(); if (!userEmail) return;
    Promise.all([
      fetch(`${API_BASE}/api/wallet/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/api/positions/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/api/txns/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API_BASE}/api/watchlist/${userEmail}`).then(r=>r.json()).catch(()=>({})),
    ]).then(([wRes, pRes, tRes, wlRes])=>{
      if (wRes.balances)              { localStorage.setItem('wallet', JSON.stringify(wRes.balances)); setWallet(wRes.balances); window.dispatchEvent(new Event('walletUpdate')); }
      if (pRes.positions?.length > 0) { localStorage.setItem('positions', JSON.stringify(pRes.positions)); setPositions(pRes.positions); }
      if (tRes.txns?.length > 0)      { localStorage.setItem('wallet_txns', JSON.stringify(tRes.txns)); setTxns(tRes.txns); }
      if (wlRes.symbols?.length > 0)  { localStorage.setItem('watchlist', JSON.stringify(wlRes.symbols)); setWatchlist(wlRes.symbols); }
    }).catch(()=>{});
  },[]);

  /* Fetch prices via REST immediately, then WebSocket keeps them live */
  useEffect(()=>{
    const symbols = ALL_COINS.map(c=>`"${c.symbol}"`).join(',');
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`)
      .then(r=>r.json())
      .then(data=>{
        if(!Array.isArray(data)) return;
        data.forEach(d=>{
          setPrices(p=>({...p,[d.symbol]:parseFloat(d.lastPrice)}));
          setChanges(p=>({...p,[d.symbol]:parseFloat(d.priceChangePercent)}));
          setVolumes(p=>({...p,[d.symbol]:parseFloat(d.quoteVolume)}));
        });
      })
      .catch(()=>{});
  },[]);

  /* WebSocket */
  useEffect(()=>{
    const streams = ALL_COINS.map(c=>`${c.symbol.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    ws.onmessage = e => {
      const {data:d} = JSON.parse(e.data); if(!d) return;
      setPrices(p=>({...p,[d.s]:parseFloat(d.c)}));
      setChanges(p=>({...p,[d.s]:parseFloat(d.P)}));
      setVolumes(p=>({...p,[d.s]:parseFloat(d.q)}));
    };
    ws.onerror = () => { /* connection error — prices will show once WS reconnects */ };
    return () => ws.close();
  },[]);

  /* Live P&L */
  useEffect(()=>{
    if (!Object.keys(prices).length) return;
    setPositions(prev=>{
      const next = prev.map(p=>{
        if (p.status==='CLOSED') return p;
        const cur = prices[p.symbol]; if(!cur) return p;
        const pnl = p.type==='BUY'?(cur-p.entry)*p.qty:(p.entry-cur)*p.qty;
        return {...p, pnl:parseFloat(pnl.toFixed(4)), current:cur};
      });
      localStorage.setItem('positions', JSON.stringify(next));
      return next;
    });
  },[prices]);

  /* Fetch chart */
  const fetchChart = useCallback(async(symbol,tf)=>{
    setChartLoad(true);
    const iMap={'1H':'1m','1D':'5m','1W':'1h','1M':'4h','1Y':'1d'};
    const lMap={'1H':60,'1D':288,'1W':168,'1M':180,'1Y':365};
    try{
      const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${iMap[tf]}&limit=${lMap[tf]}`);
      const j=await r.json();
      if(!Array.isArray(j)||j.length===0) throw new Error('Invalid response');
      setChartData(j.map(k=>({price:parseFloat(k[4]),label:new Date(k[0]).toISOString()})));
      setCandles(j.map(k=>({o:parseFloat(k[1]),h:parseFloat(k[2]),l:parseFloat(k[3]),c:parseFloat(k[4]),v:parseFloat(k[5]),label:new Date(k[0]).toISOString()})));
    }catch{
      const base=prices[symbol];
      if(base&&base>0){
        setChartData(Array.from({length:80},(_,i)=>({price:base*(1+Math.sin(i/8)*.06+(Math.random()-.5)*.015),label:new Date(Date.now()-((79-i)*5*60000)).toISOString()})));
        setCandles(Array.from({length:80},(_,i)=>{const o=base*(1+Math.sin(i/6)*.04),c=o*(1+(Math.random()-.5)*.022);return{o,c,h:Math.max(o,c)*1.005,l:Math.min(o,c)*.995,v:Math.random()*1e6,label:new Date(Date.now()-((79-i)*5*60000)).toISOString()};}));
      }
    }
    setChartLoad(false);
  },[prices]);

  useEffect(()=>{ if(selected) fetchChart(selected.symbol,timeFilter); },[timeFilter]); // eslint-disable-line

  /* Open coin detail */
  const openCoin = useCallback((coin, defaultTrade=null)=>{
    setSelected(coin);
    setChartData([]); setCandles([]);
    setTimeFilter('1D'); setChartType('candle');
    setTradeAmt(''); setTradeQty('');
    setAiSignal(null);
    const dt = defaultTrade || 'chart';
    setDetailTab(dt==='BUY'||dt==='SELL'?'trade':'chart');
    setTradeType(defaultTrade==='SELL'?'SELL':'BUY');
    fetchChart(coin.symbol,'1D');
  },[fetchChart]);

  /* Watchlist toggle */
  const [watchlist, setWatchlist] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('watchlist')||'[]');}catch{return[];}
  });
  const toggleWatchlist = (symbol) => {
    setWatchlist(prev=>{
      const next=prev.includes(symbol)?prev.filter(s=>s!==symbol):[...prev,symbol];
      localStorage.setItem('watchlist',JSON.stringify(next));
      syncWatchlist(next); // sync to MongoDB
      return next;
    });
  };

  /* Load watchlist from MongoDB on mount */
  useEffect(() => {
    const userEmail = getUserEmail(); if (!userEmail) return;
    fetch(`${API_BASE}/api/watchlist/${userEmail}`)
      .then(r => r.json())
      .then(data => {
        if (data.symbols?.length > 0) {
          setWatchlist(data.symbols);
          localStorage.setItem('watchlist', JSON.stringify(data.symbols));
        }
      })
      .catch(() => {});
  }, []);

  /* Amount <-> Qty */
  const selPrice = selected
    ? (prices[selected.symbol] || (candles.length ? candles[candles.length-1].c : 0))
    : 0;
  const onAmtChange = val => { setTradeAmt(val); if(selPrice&&val) setTradeQty((parseFloat(val)/selPrice).toFixed(6)); else setTradeQty(''); };
  const onQtyChange = val => { setTradeQty(val); if(selPrice&&val) setTradeAmt((parseFloat(val)*selPrice).toFixed(2)); else setTradeAmt(''); };

  /* Place trade */
  const placeTrade = () => {
    const qty=parseFloat(tradeQty), price=selPrice;
    if(!qty||qty<=0){showToast('Enter a valid quantity',false);return;}
    if(!price){showToast('Price not available',false);return;}
    const w=getWallet();
    if(tradeType==='BUY'){
      const cost=qty*price;
      if((w.USDT||0)<cost){showToast(`Not enough USDT. Need $${cost.toFixed(2)}`,false);return;}
      w.USDT=parseFloat(((w.USDT||0)-cost).toFixed(6));
      w[selected.short]=parseFloat(((w[selected.short]||0)+qty).toFixed(8));
      saveWallet(w); setWallet({...w});
      const t=getTxns(); t.unshift({id:Date.now(),type:'BUY',amount:cost,note:`BUY ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)}`,time:new Date().toLocaleString()});
      localStorage.setItem('wallet_txns',JSON.stringify(t)); setTxns(t);
      syncTxns(t);
      showToast(`Bought ${qty.toFixed(6)} ${selected.short} for $${cost.toFixed(2)}`);
      pushNotif('trade', `BUY ${selected.short}/USDT`, `Bought ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)} · Total $${cost.toFixed(2)}`, {coin:selected.short, type:'BUY'});
      syncTrade('BUY', selected.short, selected.symbol, qty, price);
    } else {
      const owned=w[selected.short]||0;
      if(owned<=0){showToast(`You don't own any ${selected.short}`,false);return;}
      if(qty>owned){showToast(`Not enough. Have ${owned.toFixed(6)}`,false);return;}
      const proceeds=qty*price;
      w[selected.short]=parseFloat((owned-qty).toFixed(8));
      if(w[selected.short]<0.000001) delete w[selected.short];
      w.USDT=parseFloat(((w.USDT||0)+proceeds).toFixed(6));
      saveWallet(w); setWallet({...w});
      const t=getTxns(); t.unshift({id:Date.now(),type:'SELL',amount:proceeds,note:`SELL ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)}`,time:new Date().toLocaleString()});
      localStorage.setItem('wallet_txns',JSON.stringify(t)); setTxns(t);
      syncTxns(t);
      showToast(`Sold ${qty.toFixed(6)} ${selected.short} for $${proceeds.toFixed(2)}`);
      pushNotif('trade', `SELL ${selected.short}/USDT`, `Sold ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)} · Received $${proceeds.toFixed(2)}`, {coin:selected.short, type:'SELL'});
      syncTrade('SELL', selected.short, selected.symbol, qty, price);
    }
    // Only create a position record for BUY trades
    // SELL is a spot disposal — wallet transaction only, not a tracked open position
    if (tradeType === 'BUY') {
      const pos={id:Date.now(),coin:selected.short,symbol:selected.symbol,
        type:'BUY',entry:price,qty,status:'OPEN',
        tp:price*1.05, sl:price*0.97,
        pnl:0,current:price,color:selected.color,time:new Date().toLocaleString()};
      const next=[pos,...positions];
      setPositions(next); localStorage.setItem('positions',JSON.stringify(next));
      syncPositions(next);
    }
    setTradeAmt(''); setTradeQty(''); setDetailTab('positions');
  };

  /* Close position */
  const closePosition = (pos) => {
    const cur=prices[pos.symbol]||pos.current||pos.entry;
    const pnl=pos.type==='BUY'?(cur-pos.entry)*pos.qty:(pos.entry-cur)*pos.qty;
    const w=getWallet();
    if (pos.type==='BUY') {
      // BUY close: return current market value to USDT
      w.USDT=parseFloat(((w.USDT||0)+pos.qty*cur).toFixed(6));
    } else {
      // SELL/short close: deduct buyback cost (proceeds already paid at open)
      w.USDT=parseFloat(((w.USDT||0)-pos.qty*cur).toFixed(6));
      // Give back coins since we're buying back to close
      w[pos.coin]=parseFloat(((w[pos.coin]||0)+pos.qty).toFixed(8));
    }
    saveWallet(w); setWallet({...w});
    const t=getTxns();
    t.unshift({id:Date.now(),type:'CLOSE',amount:Math.abs(pnl),
      note:`CLOSE ${pos.type} ${pos.qty} ${pos.coin} @ $${cur.toFixed(2)} — P&L: ${pnl>=0?'+':''}$${pnl.toFixed(4)}`,
      time:new Date().toLocaleString()});
    localStorage.setItem('wallet_txns',JSON.stringify(t)); setTxns(t);
    syncTxns(t);
    const next=positions.map(p=>p.id===pos.id
      ?{...p,status:'CLOSED',closePrice:cur,closePnl:parseFloat(pnl.toFixed(4)),closeTime:new Date().toLocaleString()}:p);
    setPositions(next); localStorage.setItem('positions',JSON.stringify(next));
    syncPositions(next);
    showToast(`Closed — P&L: ${pnl>=0?'+':''}$${pnl.toFixed(4)}`, pnl>=0);
    syncTrade('CLOSE', pos.coin, pos.symbol, pos.qty, cur, parseFloat(pnl.toFixed(4)));
  };

  /* AI Signal */
  const getAISignal = async () => {
    if(!selected) return;
    setAiLoading(true); setAiSignal(null);
    const price=selPrice, change=changes[selected.symbol]||0, vol=volumes[selected.symbol]||0;
    const recentPrices=chartData.slice(-20).map(d=>d.price);
    const high=candles.length?Math.max(...candles.slice(-20).map(c=>c.h)):price*1.02;
    const low =candles.length?Math.min(...candles.slice(-20).map(c=>c.l)):price*0.98;
    const prompt=`You are a crypto trading AI system with 4 specialist agents analyzing ${selected.short}/USDT.\n\nCurrent market data:\n- Price: $${price.toFixed(4)}\n- 24h Change: ${change.toFixed(2)}%\n- 24h Volume: $${(vol/1e6).toFixed(1)}M\n- Recent 20-candle High: $${high.toFixed(4)}\n- Recent 20-candle Low: $${low.toFixed(4)}\n- Recent prices (last 10): ${recentPrices.slice(-10).map(p=>p.toFixed(2)).join(', ')}\n\nYou must respond with ONLY valid JSON, no markdown:\n{"action":"BUY or SELL","confidence":number 40-95,"entry":"${price.toFixed(4)}","tp":"take profit 4 decimals","sl":"stop loss 4 decimals","reason":"one sentence","agents":[{"name":"Quant Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Technical Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Risk Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Sentiment Agent","verdict":"BUY or SELL or HOLD","score":number}]}`;
    try{
      const res=await fetch(`${API_BASE}/api/ai-signal`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
      const data=await res.json();
      const parsed=JSON.parse((data.content?.[0]?.text||'').replace(/```json|```/g,'').trim());
      setAiSignal(parsed);
      setDetailTab('chart');
      pushNotif('signal', `AI Signal: ${parsed.action} ${selected.short}/USDT`, `${parsed.action} signal · ${parsed.confidence}% confidence · Entry $${parsed.entry} · TP $${parsed.tp} · SL $${parsed.sl}`, {coin:selected.short, action:parsed.action});
    }catch{
      const isBull=change>=0;
      setAiSignal({action:isBull?'BUY':'SELL',confidence:Math.floor(Math.random()*25)+60,entry:price.toFixed(4),tp:(isBull?price*1.055:price*0.945).toFixed(4),sl:(isBull?price*0.972:price*1.028).toFixed(4),reason:isBull?`${selected.short} showing bullish momentum.`:`${selected.short} facing selling pressure.`,agents:[{name:'Quant Agent',verdict:isBull?'BUY':'SELL',score:Math.floor(Math.random()*20)+65},{name:'Technical Agent',verdict:isBull?'BUY':'HOLD',score:Math.floor(Math.random()*20)+55},{name:'Risk Agent',verdict:'HOLD',score:Math.floor(Math.random()*20)+50},{name:'Sentiment Agent',verdict:isBull?'BUY':'SELL',score:Math.floor(Math.random()*20)+60}]});
      setDetailTab('chart');
    }
    setAiLoading(false);
  };

  /* ── Derived data ── */
  const openPos   = positions.filter(p=>p.status!=='CLOSED');
  const closedPos = positions.filter(p=>p.status==='CLOSED');

  // Realised P&L = sum of all closed position P&Ls
  const totalRealised   = closedPos.reduce((s,p)=>s+(p.closePnl||0),0);
  // Unrealised P&L = live P&L across all open positions (BUY and SELL)
  const totalUnrealised = openPos.reduce((s,p)=>{
    const cur = prices[p.symbol] || p.current || p.entry;
    const pnl = p.type==='BUY'?(cur-p.entry)*p.qty:(p.entry-cur)*p.qty;
    return s + pnl;
  }, 0);
  // Invested = total USDT spent on open BUY positions (entry × qty)
  const totalInvested   = openPos.filter(p=>p.type==='BUY').reduce((s,p)=>s+(p.entry*p.qty),0);
  // Current value = live price × qty for open BUY positions
  const totalCurrent    = openPos.filter(p=>p.type==='BUY').reduce((s,p)=>{
    const cur = prices[p.symbol] || p.current || p.entry;
    return s + cur * p.qty;
  }, 0);
  // Portfolio overall % gain on open positions
  const totalOpenPct    = totalInvested>0?((totalCurrent-totalInvested)/totalInvested*100):0;
  // Overall P&L % including realised

  const holdings = Object.entries(wallet)
    .filter(([k])=>k!=='USDT'&&wallet[k]>0.000001)
    .map(([coin,qty])=>{
      const info=coinInfo(coin);
      const sym=ALL_COINS.find(c=>c.short===coin)?.symbol;
      const cur=sym?(prices[sym]||0):0;
      // Cost basis: total bought minus total sold proceeds for this coin
      // This gives the true average cost of what you currently hold
      const buyAmt  = txns.filter(t=>t.type==='BUY' &&(t.note?.includes(` ${coin} `)||t.note?.includes(` ${coin}@`))).reduce((s,t)=>s+(t.amount||0),0);
      const sellAmt = txns.filter(t=>t.type==='SELL'&&(t.note?.includes(` ${coin} `)||t.note?.includes(` ${coin}@`))).reduce((s,t)=>s+(t.amount||0),0);
      // Cost basis of remaining holdings = total spent - proceeds from partial sales
      const costBasis = Math.max(0, buyAmt - sellAmt);
      // Average buy price per coin
      const avgBuyPrice = qty>0&&buyAmt>0 ? buyAmt / (
        txns.filter(t=>t.type==='BUY'&&(t.note?.includes(` ${coin} `)||t.note?.includes(` ${coin}@`))).reduce((s,t)=>{
          const m=t.note?.match(/BUY ([\d.]+)/); return s+(m?parseFloat(m[1]):0);
        },0) || qty
      ) : cur;
      const currentVal=qty*cur;
      // P&L = current value minus cost basis of current holdings
      const invested=costBasis>0?costBasis:avgBuyPrice*qty;
      const pnl=currentVal-invested;
      const pnlPct=invested>0?(pnl/invested)*100:0;
      // 24h change for this coin
      const change24h=sym?(changes[sym]||0):0;
      const change24hVal=currentVal*(change24h/100); // today's gain/loss in $
      return {coin,qty,info,sym,currentVal,invested,pnl,pnlPct,cur,change24h,change24hVal,avgBuyPrice};
    });

  const pastCoins=[...new Set(
    txns.filter(t=>t.type==='SELL'||t.type==='CLOSE')
      .map(t=>{const m=t.note?.match(/(?:SELL|CLOSE \w+) [\d.]+ (\w+)/);return m?.[1];})
      .filter(Boolean)
  )].filter(c=>!(wallet[c]>0.000001));
  const pastHoldings=pastCoins.map(coin=>{
    const info=coinInfo(coin);
    const sellTxns=txns.filter(t=>(t.type==='SELL'||t.type==='CLOSE')&&t.note?.includes(coin));
    const totalSold=sellTxns.reduce((s,t)=>s+(t.amount||0),0);
    return {coin,info,totalSold,lastTxn:sellTxns[0]};
  });

  /* Search filter */
  const q = searchQ.toLowerCase();
  const filteredOpen    = openPos.filter(p=>!q||p.coin.toLowerCase().includes(q));
  const filteredClosed  = closedPos.filter(p=>!q||p.coin.toLowerCase().includes(q));
  const filteredHoldings= holdings.filter(h=>!q||h.coin.toLowerCase().includes(q));
  const filteredPast    = pastHoldings.filter(h=>!q||h.coin.toLowerCase().includes(q));
  const filteredTxns    = txns.filter(t=>!q||t.note?.toLowerCase().includes(q)||t.type?.toLowerCase().includes(q));

  /* Sort holdings */
  const sortedHoldings=[...filteredHoldings].sort((a,b)=>{
    const mul=sortDir==='desc'?-1:1;
    if(sortBy==='value')    return mul*(a.currentVal-b.currentVal);
    if(sortBy==='pnl')      return mul*(a.pnl-b.pnl);
    if(sortBy==='pnlpct')   return mul*(a.pnlPct-b.pnlPct);
    if(sortBy==='invested') return mul*(a.invested-b.invested);
    if(sortBy==='name')     return mul*a.coin.localeCompare(b.coin);
    return 0;
  });

  const bb=(active=false)=>({width:36,height:36,borderRadius:'50%',background:active?'rgba(99,102,241,0.1)':'#f1f5f9',border:`1.5px solid ${active?'rgba(99,102,241,0.35)':'#e2e8f0'}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'});

  const TABS=[{key:'open',label:`Open (${openPos.length})`},{key:'holdings',label:`Holdings (${holdings.length})`},{key:'past',label:'Past'},{key:'history',label:'History'}];
  const SORT_OPTIONS=[{key:'value',label:'Current value'},{key:'pnl',label:'P&L amount'},{key:'pnlpct',label:'P&L %'},{key:'invested',label:'Amount invested'},{key:'name',label:'Coin name'}];

  const selChange=selected?changes[selected.symbol]:0;
  const selUp=selChange>=0;
  const usdtBal=wallet.USDT??0;
  const coinBal=selected?(wallet[selected.short]||0):0;
  const isStarred=selected?watchlist.includes(selected.symbol):false;
  const openPositions=(sym)=>positions.filter(p=>p.symbol===sym&&p.status!=='CLOSED');

  /* ── If coin detail is open, render Dashboard-style view ── */
  if (selected) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
          .tr-detail{display:flex;flex-direction:column;min-height:100vh;background:white;}
          .fade-in{animation:fi .3s ease both;}
          @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
          @keyframes signalIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}
          @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
          @keyframes spin{to{transform:rotate(360deg)}}
          .tab-ul{position:relative;}
          .tab-ul::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:#6366f1;border-radius:2px;}
          .star-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;display:flex;align-items:center;transition:transform .15s;}
          .star-btn:hover{transform:scale(1.15);}
          .ai-btn{display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;border-radius:20px;background:linear-gradient(135deg,#6366f1,#818cf8);color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:opacity .15s,transform .12s;box-shadow:0 2px 10px rgba(99,102,241,0.3);white-space:nowrap;flex-shrink:0;}
          .ai-btn:hover{opacity:.9;transform:translateY(-1px);}
          .ai-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
          .ai-btn-text{display:inline;}
          .tr-coin-header{display:flex;align-items:center;gap:10px;padding:14px 20px 12px;border-bottom:1px solid #f1f5f9;flex-shrink:0;background:white;}
          .tr-price-block{text-align:right;flex-shrink:0;}
          .spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
          @media(max-width:600px){
            .ai-btn{padding:7px 10px;}
            .ai-btn-text{display:none!important;}
            .tr-coin-header{flex-wrap:wrap;padding:10px 14px 8px;gap:8px;}
            .tr-price-block{order:10;width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:8px 0 0;border-top:1px solid #f8fafc;margin-top:2px;}
            .tr-price-big{font-size:20px!important;}
            .ai-btn-wrap{flex-shrink:0;}
            .tr-tabs{overflow-x:auto;scrollbar-width:none;}
            .tr-tabs::-webkit-scrollbar{display:none;}
            .tr-tab{white-space:nowrap;padding:7px 12px;font-size:12px;}
            .tr-summary-grid{grid-template-columns:1fr 1fr!important;}
            .tr-open-card{padding:14px!important;}
          }
          @media(max-width:400px){
            .tr-price-big{font-size:18px!important;}
            .tr-summary-grid{grid-template-columns:1fr!important;}
          }
        `}</style>
        <div className="tr-detail fade-in">
          {/* Header */}
          <div className="tr-coin-header">
            <button onClick={()=>setSelected(null)} style={{...bb(),flexShrink:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,background:selected.bg,border:`1.5px solid ${selected.color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:selected.color,fontFamily:"'Sora',sans-serif"}}>
              {selected.short.slice(0,3)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a',lineHeight:1.2}}>
                {selected.short}<span style={{color:'#94a3b8',fontWeight:400,fontSize:12}}>/USDT</span>
              </div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{selected.name}</div>
            </div>
            <button className="ai-btn" onClick={getAISignal} disabled={aiLoading}>
              {aiLoading?<><span className="spinner"/><span className="ai-btn-text"> Analyzing…</span></>:<><span style={{fontSize:12,fontWeight:800,letterSpacing:'-0.3px'}}>AI</span><span className="ai-btn-text"> Signal</span></>}
            </button>
            <button className="star-btn" onClick={()=>toggleWatchlist(selected.symbol)} title={isStarred?'Remove from watchlist':'Add to watchlist'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isStarred?'#f59e0b':'none'} stroke={isStarred?'#f59e0b':'#cbd5e1'} strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <div className="tr-price-block" style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
              <div className="tr-price-big" style={{fontSize:22,fontWeight:700,fontFamily:"'Sora',sans-serif",color:selUp?'#16a34a':'#dc2626',letterSpacing:'-0.5px',lineHeight:1}}>
                ${selPrice?selPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
              </div>
              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:selUp?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',color:selUp?'#16a34a':'#dc2626',border:`1px solid ${selUp?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>
                {selUp?'+':''}{selChange?.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Time + chart type */}
          <div style={{display:'flex',alignItems:'center',padding:'10px 20px 8px',gap:4,flexShrink:0,borderBottom:'1px solid #f1f5f9',background:'white'}}>
            {TIME_FILTERS.map(tf=>(
              <button key={tf} onClick={()=>setTimeFilter(tf)}
                style={{padding:'6px 13px',borderRadius:8,border:'none',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'.15s',background:timeFilter===tf?'#f0f4ff':'transparent',color:timeFilter===tf?'#6366f1':'#64748b'}}>
                {tf}
              </button>
            ))}
            <div style={{marginLeft:'auto',display:'flex',gap:4}}>
              {['line','candle'].map(t=>(
                <button key={t} onClick={()=>setChartType(t)}
                  style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',border:`1px solid ${chartType===t?'#e2e8f0':'transparent'}`,fontSize:11.5,fontWeight:500,fontFamily:"'DM Sans',sans-serif",background:chartType===t?'#f8fafc':'transparent',color:chartType===t?'#0f172a':'#94a3b8',textTransform:'capitalize'}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div style={{padding:'16px 20px 0',background:'white',flexShrink:0}}>
            {chartLoad?(
              <div style={{height:280,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:13}}>Loading chart…</div>
            ):chartType==='line'?(
              <LineChart data={chartData} color={selected.color} timeFilter={timeFilter}/>
            ):(
              <CandleChart candles={candles} timeFilter={timeFilter}/>
            )}
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:'8px 20px',background:'white',flexShrink:0}}>
            {[
              {l:'Volume',v:volumes[selected.symbol]?'$'+(volumes[selected.symbol]/1e6).toFixed(1)+'M':'—'},
              {l:'High',v:candles.length?'$'+Math.max(...candles.map(c=>c.h)).toLocaleString(undefined,{maximumFractionDigits:4}):'—'},
              {l:'Low',v:candles.length?'$'+Math.min(...candles.map(c=>c.l)).toLocaleString(undefined,{maximumFractionDigits:4}):'—'},
            ].map(s=>(
              <div key={s.l} style={{background:'#f8fafc',borderRadius:10,padding:'10px 14px',border:'1px solid #f1f5f9'}}>
                <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>{s.l}</div>
                <div style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a'}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Sub-tabs */}
          <div style={{display:'flex',borderBottom:'2px solid #f1f5f9',padding:'0 20px',background:'white',flexShrink:0,marginTop:4}}>
            {['chart','trade','positions'].map(t=>(
              <button key={t} onClick={()=>setDetailTab(t)} className={detailTab===t?'tab-ul':''}
                style={{padding:'10px 18px',border:'none',background:'transparent',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textTransform:'capitalize',color:detailTab===t?'#6366f1':'#64748b',marginBottom:-2}}>
                {t==='positions'?`Positions (${openPositions(selected.symbol).length})`:t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{background:'#f8fafc'}}>

            {detailTab==='chart'&&(
              <div style={{padding:'14px 20px'}}>
                {aiSignal&&(
                  <div style={{background:'white',border:`1.5px solid ${aiSignal.action==='BUY'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:14,padding:16,marginBottom:14,boxShadow:`0 4px 20px ${aiSignal.action==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}`,animation:'signalIn .3s cubic-bezier(.22,1,.36,1) both'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:32,height:32,borderRadius:'50%',background:`linear-gradient(135deg,${aiSignal.action==='BUY'?'#6366f1,#22c55e':'#6366f1,#ef4444'})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'white'}}>AI</div>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:'#6366f1',fontFamily:"'Sora',sans-serif"}}>AI Signal</div>
                          <div style={{fontSize:10,color:'#94a3b8'}}>Multi-agent analysis</div>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:700,background:aiSignal.action==='BUY'?'#22c55e':'#ef4444',color:'white'}}>{aiSignal.action}</div>
                        <button onClick={()=>setAiSignal(null)} style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:24,height:24,cursor:'pointer',color:'#64748b',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                      </div>
                    </div>
                    <div style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:4}}><span>Confidence</span><span style={{fontWeight:700,color:'#0f172a'}}>{aiSignal.confidence}%</span></div>
                      <div style={{height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,width:`${aiSignal.confidence}%`,background:aiSignal.confidence>75?'#22c55e':aiSignal.confidence>50?'#f59e0b':'#ef4444',transition:'width .8s ease'}}/></div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                      {[{l:'Entry',v:`$${aiSignal.entry}`,c:'#0f172a'},{l:'Take Profit',v:`$${aiSignal.tp}`,c:'#16a34a'},{l:'Stop Loss',v:`$${aiSignal.sl}`,c:'#dc2626'}].map(x=>(
                        <div key={x.l} style={{background:'#f8fafc',borderRadius:9,padding:'9px 10px',border:'1px solid #f1f5f9',minWidth:0}}>
                          <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3,whiteSpace:'nowrap'}}>{x.l}</div>
                          <div style={{fontSize:12,fontWeight:700,color:x.c,fontFamily:"'Sora',sans-serif",wordBreak:'break-all',lineHeight:1.3}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{borderTop:'1px solid #f1f5f9',paddingTop:10}}>
                      <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Agent verdicts</div>
                      {aiSignal.agents?.map(a=>(
                        <div key={a.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,gap:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                            <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background:a.verdict==='BUY'?'#22c55e':a.verdict==='SELL'?'#ef4444':'#94a3b8'}}/>
                            <span style={{fontSize:12,color:'#64748b',whiteSpace:'nowrap'}}>{a.name}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                            <span style={{fontSize:11,fontWeight:700,padding:'1px 8px',borderRadius:5,
                              background:a.verdict==='BUY'?'rgba(34,197,94,0.1)':a.verdict==='SELL'?'rgba(239,68,68,0.1)':'rgba(148,163,184,0.1)',
                              color:a.verdict==='BUY'?'#16a34a':a.verdict==='SELL'?'#dc2626':'#94a3b8'}}>{a.verdict}</span>
                            <span style={{fontSize:11,color:'#94a3b8',minWidth:28,textAlign:'right'}}>{a.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:10,padding:'9px 12px',background:'#f8fafc',borderRadius:9,fontSize:12,color:'#475569',lineHeight:1.6,fontStyle:'italic',wordBreak:'break-word'}}>"{aiSignal.reason}"</div>
                  </div>
                )}
                <div style={{background:'white',border:'1px solid #f1f5f9',borderRadius:12,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:11,color:'#94a3b8',marginBottom:10,textTransform:'uppercase',letterSpacing:'.4px'}}>Market info</div>
                  {[{l:'Symbol',v:`${selected.short}/USDT`},{l:'Price',v:`$${selPrice?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})||'—'}`},{l:'24h Change',v:`${selChange>=0?'+':''} ${selChange?.toFixed(2)}%`,c:selChange>=0?'#16a34a':'#dc2626'},{l:'24h Volume',v:volumes[selected.symbol]?'$'+(volumes[selected.symbol]/1e6).toFixed(2)+'M':'—'},{l:'Your holding',v:coinBal>0?`${coinBal.toFixed(6)} ${selected.short}`:'None',c:coinBal>0?'#16a34a':undefined}].map(x=>(
                    <div key={x.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #f8fafc'}}>
                      <span style={{fontSize:13,color:'#64748b'}}>{x.l}</span>
                      <span style={{fontSize:13,fontWeight:600,color:x.c||'#0f172a'}}>{x.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTab==='trade'&&(
              <div style={{padding:20}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                  <div style={{background:'white',border:'1px solid #f1f5f9',borderRadius:10,padding:'10px 14px'}}>
                    <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>USDT Balance</div>
                    <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>${usdtBal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  </div>
                  <div style={{background:'white',border:'1px solid #f1f5f9',borderRadius:10,padding:'10px 14px'}}>
                    <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{selected.short} Holding</div>
                    <div style={{fontSize:14,fontWeight:700,color:coinBal>0?'#0f172a':'#cbd5e1',fontFamily:"'Sora',sans-serif"}}>{coinBal>0?coinBal.toLocaleString(undefined,{maximumFractionDigits:6}):'0'}</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                  {['BUY','SELL'].map(tt=>(
                    <button key={tt} onClick={()=>{setTradeType(tt);setTradeAmt('');setTradeQty('');}}
                      style={{padding:13,borderRadius:10,cursor:'pointer',border:`1.5px solid ${tt==='BUY'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,background:tradeType===tt?(tt==='BUY'?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)'):'white',color:tt==='BUY'?'#16a34a':'#dc2626',fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif",opacity:tradeType===tt?1:0.45}}>
                      {tt}
                    </button>
                  ))}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:500}}>Market Price — fixed</div>
                  <div style={{padding:'12px 14px',background:'#f8fafc',border:'1.5px solid #f1f5f9',borderRadius:10,color:'#0f172a',fontSize:15,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>${selPrice?selPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}</div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:11,color:'#64748b',fontWeight:500}}>Amount (USDT)</span>
                    {tradeType==='BUY'&&<button onClick={()=>onAmtChange(usdtBal.toFixed(2))} style={{fontSize:10,color:'#6366f1',background:'#f0f4ff',border:'none',borderRadius:5,padding:'2px 7px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Max ${usdtBal.toFixed(2)}</button>}
                    {tradeType==='SELL'&&coinBal>0&&<button onClick={()=>onQtyChange(coinBal.toFixed(6))} style={{fontSize:10,color:'#6366f1',background:'#f0f4ff',border:'none',borderRadius:5,padding:'2px 7px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Max {coinBal.toFixed(6)}</button>}
                  </div>
                  <input value={tradeAmt} onChange={e=>onAmtChange(e.target.value)} placeholder="0.00 USDT" type="number" min="0"
                    style={{width:'100%',padding:'12px 14px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:10,color:'#0f172a',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}
                    onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:500}}>Quantity ({selected.short})</div>
                  <input value={tradeQty} onChange={e=>onQtyChange(e.target.value)} placeholder={`0.000000 ${selected.short}`} type="number" min="0"
                    style={{width:'100%',padding:'12px 14px',background:'white',border:'1.5px solid #e2e8f0',borderRadius:10,color:'#0f172a',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}
                    onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                </div>
                {tradeType==='SELL'&&coinBal<=0&&(
                  <div style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#dc2626',lineHeight:1.5}}>
                    You don't own any {selected.short}. Buy first.
                  </div>
                )}
                <button onClick={placeTrade} disabled={tradeType==='SELL'&&coinBal<=0}
                  style={{width:'100%',padding:'14px',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:tradeType==='SELL'&&coinBal<=0?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif",background:tradeType==='SELL'&&coinBal<=0?'#e2e8f0':tradeType==='BUY'?'#22c55e':'#ef4444',color:tradeType==='SELL'&&coinBal<=0?'#94a3b8':'white'}}>
                  {tradeType} {selected.short}{tradeAmt?` · $${parseFloat(tradeAmt).toFixed(2)}`:''}</button>
              </div>
            )}

            {detailTab==='positions'&&(
              <div style={{padding:'14px 20px'}}>
                {positions.filter(p=>p.symbol===selected.symbol).length===0?(
                  <div style={{textAlign:'center',color:'#94a3b8',padding:'40px 0',fontSize:13}}>No positions yet</div>
                ):positions.filter(p=>p.symbol===selected.symbol).map(p=>{
                  const isClosed=p.status==='CLOSED';
                  const liveCur = isClosed ? (p.closePrice||p.entry) : (prices[p.symbol]||p.current||p.entry);
                  const pnlVal = isClosed ? (p.closePnl||0)
                    : (p.type==='BUY'?(liveCur-p.entry)*p.qty:(p.entry-liveCur)*p.qty);
                  return(
                    <div key={p.id} style={{background:'white',border:`1px solid ${isClosed?'#f1f5f9':pnlVal>=0?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'}`,borderRadius:12,padding:16,marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,0.04)',opacity:isClosed?0.65:1}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a'}}>{p.coin}/USDT</span>
                          <span style={{padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:700,background:p.type==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',color:p.type==='BUY'?'#16a34a':'#dc2626',border:`1px solid ${p.type==='BUY'?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>{p.type}</span>
                          {isClosed&&<span style={{padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:600,background:'#f1f5f9',color:'#64748b',border:'1px solid #e2e8f0'}}>Closed</span>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:14,fontWeight:700,color:pnlVal>=0?'#16a34a':'#dc2626',fontFamily:"'Sora',sans-serif"}}>{pnlVal>=0?'+':''} ${pnlVal?.toFixed(4)}</span>
                          {!isClosed&&<button onClick={()=>{if(window.confirm(`Close? P&L: ${pnlVal>=0?'+':''} $${pnlVal?.toFixed(4)}`))closePosition(p);}} style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.05)',color:'#dc2626',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}} onMouseEnter={e=>e.target.style.background='rgba(239,68,68,0.12)'} onMouseLeave={e=>e.target.style.background='rgba(239,68,68,0.05)'}>Close</button>}
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {[{l:'Entry',v:`$${p.entry.toFixed(4)}`},{l:'TP',v:`$${p.tp.toFixed(2)}`},{l:'SL',v:`$${p.sl.toFixed(2)}`},{l:'Qty',v:p.qty},{l:isClosed?'Closed @':'Current',v:`$${liveCur.toFixed(4)}`},{l:'Time',v:p.time.split(',')[0]}].map(x=>(
                          <div key={x.l}><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{x.l}</div><div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{x.v}</div></div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Toast msg={toast}/>
      </>
    );
  }

  /* ── TRADES LIST VIEW ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .tr-page{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:'DM Sans',sans-serif;}
        @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes slideUp{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-10px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .tr-tab-bar{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;border-bottom:2px solid #f1f5f9;background:white;padding:0 20px;}
        .tr-tab-bar::-webkit-scrollbar{display:none;}
        .tr-tab{padding:11px 16px;border:none;background:transparent;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;color:#64748b;white-space:nowrap;position:relative;transition:color .15s;margin-bottom:-2px;}
        .tr-tab.active{color:#6366f1;font-weight:600;}
        .tr-tab.active::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:#6366f1;border-radius:2px;}
        .pos-card{background:white;border:1px solid #f1f5f9;border-radius:12px;padding:16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04);transition:box-shadow .15s;}
        .pos-card:hover{box-shadow:0 3px 12px rgba(0,0,0,0.08);}
        .section-hd{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding:16px 0 8px;}
      `}</style>

      <div className="tr-page">
        {/* Summary Card */}
        <div style={{background:'white',borderBottom:'1px solid #f1f5f9',padding:'20px 20px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:20,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a',letterSpacing:'-0.3px'}}>Trades</div>
            {/* Search bubble */}
            <button style={bb(showSearch)} onClick={()=>{setShowSearch(true);setTimeout(()=>searchRef.current?.focus(),50);}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </div>

          {/* Big portfolio card */}
          <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',borderRadius:16,padding:'20px',color:'white'}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4}}>Portfolio value</div>
            <div style={{display:'flex',alignItems:'baseline',gap:10}}>
              <div style={{fontSize:32,fontWeight:700,fontFamily:"'Sora',sans-serif",letterSpacing:'-1px',lineHeight:1}}>
                ${(wallet.USDT||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                <span style={{fontSize:14,fontWeight:400,color:'rgba(255,255,255,0.5)',marginLeft:6}}>USDT</span>
              </div>
            </div>
            {/* 24h holdings change */}
            {holdings.length>0&&(()=>{
              const total24hVal=holdings.reduce((s,h)=>s+h.change24hVal,0);
              const total24hPct=holdings.reduce((s,h)=>s+h.currentVal,0)>0
                ?(total24hVal/holdings.reduce((s,h)=>s+h.currentVal,0)*100):0;
              return(
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:total24hVal>=0?'#4ade80':'#f87171'}}>
                    {total24hVal>=0?'+':''}${total24hVal.toFixed(2)} today
                  </span>
                  <span style={{fontSize:11,padding:'2px 7px',borderRadius:5,fontWeight:600,
                    background:total24hVal>=0?'rgba(74,222,128,0.15)':'rgba(248,113,113,0.15)',
                    color:total24hVal>=0?'#4ade80':'#f87171'}}>
                    {total24hPct>=0?'+':''}{total24hPct.toFixed(2)}%
                  </span>
                </div>
              );
            })()}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
              {[
                {l:'Unrealised P&L',
                  v:`${totalUnrealised>=0?'+':''}$${totalUnrealised.toFixed(2)}`,
                  sub: totalInvested>0?`${totalOpenPct>=0?'+':''}${totalOpenPct.toFixed(2)}% on open`:null,
                  c:totalUnrealised>=0?'#4ade80':'#f87171'},
                {l:'Realised P&L',
                  v:`${totalRealised>=0?'+':''}$${totalRealised.toFixed(2)}`,
                  sub: closedPos.length>0?`${closedPos.length} closed position${closedPos.length!==1?'s':''}`:null,
                  c:totalRealised>=0?'#4ade80':'#f87171'},
                {l:'Invested (open)',
                  v:`$${totalInvested.toFixed(2)}`,
                  sub: totalInvested>0?`${openPos.filter(p=>p.type==='BUY').length} BUY position${openPos.filter(p=>p.type==='BUY').length!==1?'s':''}`:null,
                  c:'rgba(255,255,255,0.85)'},
                {l:'Current (open)',
                  v:`$${totalCurrent.toFixed(2)}`,
                  sub: totalInvested>0?`${totalOpenPct>=0?'+':''}${totalOpenPct.toFixed(2)}% return`:null,
                  c:totalOpenPct>=0?'#4ade80':'#f87171'},
              ].map(x=>(
                <div key={x.l} style={{background:'rgba(255,255,255,0.07)',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>{x.l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:x.c,fontFamily:"'Sora',sans-serif"}}>{x.v}</div>
                  {x.sub&&<div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:2}}>{x.sub}</div>}
                </div>
              ))}
            </div>
            {holdings.length>0&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:6}}>{holdings.length} coin{holdings.length>1?'s':''} held · {openPos.length} open position{openPos.length!==1?'s':''}</div>
                <div style={{display:'flex',gap:3,height:6,borderRadius:3,overflow:'hidden'}}>
                  {holdings.map(h=><div key={h.coin} style={{flex:Math.max(h.currentVal,1),background:h.info.color,opacity:.8,borderRadius:3}}/>)}
                </div>
                <div style={{display:'flex',gap:12,marginTop:8,flexWrap:'wrap'}}>
                  {holdings.map(h=>(
                    <div key={h.coin} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'rgba(255,255,255,0.55)'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:h.info.color}}/>{h.coin}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="tr-tab-bar">
          {TABS.map(t=>(
            <button key={t.key} className={`tr-tab${tab===t.key?' active':''}`}
              onClick={()=>{setTab(t.key);setSearchQ('');}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sort toolbar — holdings only */}
        {tab==='holdings'&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',background:'white',borderBottom:'1px solid #f1f5f9'}}>
            <button style={bb(showSort)} onClick={()=>setShowSort(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/>
              </svg>
            </button>
            {searchQ&&<span style={{fontSize:12,color:'#6366f1',background:'#f0f4ff',padding:'4px 10px',borderRadius:20,border:'1px solid rgba(99,102,241,0.2)'}}>{searchQ} <button onClick={()=>setSearchQ('')} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',marginLeft:4}}>✕</button></span>}
            <span style={{fontSize:12,color:'#94a3b8'}}>{sortedHoldings.length} holding{sortedHoldings.length!==1?'s':''}</span>
          </div>
        )}

        <div style={{padding:'0 20px 32px'}}>

          {/* ══ OPEN TAB ══ */}
          {tab==='open'&&(
            <>
              {filteredOpen.length===0?(
                <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📊</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6}}>{searchQ?`No results for "${searchQ}"`:'No open positions'}</div>
                  <div style={{fontSize:13}}>{searchQ?'Try a different search':'Go to Dashboard or Watchlist to place trades'}</div>
                </div>
              ):filteredOpen.map(p=>{
                // Always use live price from WebSocket — never stale p.current
                const cur = prices[p.symbol] || p.current || p.entry;
                const pnlVal = p.type==='BUY'
                  ? (cur - p.entry) * p.qty
                  : (p.entry - cur) * p.qty;
                // BUY profit = price went up. SELL profit = price went down.
                const pnlPct=p.entry>0?(p.type==='BUY'
                  ?((cur-p.entry)/p.entry*100)
                  :((p.entry-cur)/p.entry*100)):0;
                const info=coinInfo(p.coin);
                const coin=ALL_COINS.find(c=>c.short===p.coin);
                return(
                  <div key={p.id} className="pos-card" style={{marginTop:12,borderColor:pnlVal>=0?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)',cursor:'pointer'}}
                    onClick={()=>coin&&openCoin(coin)}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:info.bg,border:`1.5px solid ${info.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:info.color,fontFamily:"'Sora',sans-serif",flexShrink:0}}>{p.coin.slice(0,3)}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{p.coin}/USDT</div>
                          <div style={{display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                            <span style={{padding:'1px 7px',borderRadius:4,fontSize:10,fontWeight:700,background:p.type==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',color:p.type==='BUY'?'#16a34a':'#dc2626'}}>{p.type}</span>
                            <span style={{fontSize:11,color:'#94a3b8'}}>{p.time?.split(',')[0]}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:18,fontWeight:700,fontFamily:"'Sora',sans-serif",color:pnlVal>=0?'#16a34a':'#dc2626'}}>{pnlVal>=0?'+':''} ${pnlVal.toFixed(4)}</div>
                        <div style={{fontSize:11,fontWeight:600,color:pnlVal>=0?'#16a34a':'#dc2626'}}>{pnlPct>=0?'+':''}{pnlPct.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                      {[{l:'Entry',v:`$${parseFloat(p.entry).toFixed(4)}`},{l:'Current',v:`$${parseFloat(cur).toFixed(4)}`},{l:'Qty',v:p.qty},{l:'Invested',v:`$${(parseFloat(p.entry)*parseFloat(p.qty)).toFixed(2)}`},{l:'Take Profit',v:`$${parseFloat(p.tp).toFixed(2)}`},{l:'Stop Loss',v:`$${parseFloat(p.sl).toFixed(2)}`}].map(x=>(
                        <div key={x.l} style={{background:'#f8fafc',borderRadius:8,padding:'8px 10px',border:'1px solid #f1f5f9'}}>
                          <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{x.l}</div>
                          <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    {p.tp&&p.sl&&(()=>{
                      const range=p.tp-p.sl, progress=range>0?Math.max(0,Math.min(100,((cur-p.sl)/range)*100)):50;
                      return(<div style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#94a3b8',marginBottom:4}}><span>SL ${p.sl.toFixed(2)}</span><span>TP ${p.tp.toFixed(2)}</span></div><div style={{height:4,background:'#f1f5f9',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${progress}%`,background:progress>66?'#22c55e':progress>33?'#f59e0b':'#ef4444',borderRadius:2,transition:'width .5s ease'}}/></div></div>);
                    })()}
                    {/* BUY / SELL / Close buttons */}
                    <div style={{display:'flex',gap:8}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>coin&&openCoin(coin,'BUY')}
                        style={{flex:1,padding:'9px 0',borderRadius:9,border:'1.5px solid rgba(34,197,94,0.35)',background:'rgba(34,197,94,0.07)',color:'#16a34a',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                        BUY
                      </button>
                      <button onClick={()=>coin&&openCoin(coin,'SELL')}
                        style={{flex:1,padding:'9px 0',borderRadius:9,border:'1.5px solid rgba(239,68,68,0.35)',background:'rgba(239,68,68,0.07)',color:'#dc2626',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                        SELL
                      </button>
                      <button onClick={()=>{if(window.confirm(`Close ${p.type} ${p.qty} ${p.coin}?\nP&L: ${pnlVal>=0?'+':''} $${pnlVal.toFixed(4)}`))closePosition(p);}}
                        style={{flex:1,padding:'9px 0',borderRadius:9,border:'1.5px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.05)',color:'#dc2626',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ══ HOLDINGS TAB ══ */}
          {tab==='holdings'&&(
            <>
              {sortedHoldings.length===0?(
                <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8'}}>
                  <div style={{fontSize:40,marginBottom:12}}>💰</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6}}>{searchQ?`No results for "${searchQ}"`:'No holdings yet'}</div>
                  <div style={{fontSize:13}}>{searchQ?'Try a different search':'Buy coins on Dashboard to see them here'}</div>
                </div>
              ):(
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10}}>
                  {sortedHoldings.map((h,idx)=>{
                    const pnlPos=h.pnl>=0;
                    const coin=ALL_COINS.find(c=>c.short===h.coin);
                    return(
                      <div key={h.coin}
                        onClick={()=>coin&&openCoin(coin)}
                        style={{background:'white',borderRadius:14,border:`1.5px solid ${pnlPos?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'}`,
                          padding:'14px 16px',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                          transition:'box-shadow .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'}>

                        {/* Row 1: icon + name + value */}
                        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                          <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,
                            background:h.info.bg,border:`1.5px solid ${h.info.color}44`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:10,fontWeight:700,color:h.info.color,fontFamily:"'Sora',sans-serif"}}>
                            {h.coin.slice(0,3)}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:15,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{h.coin}</div>
                            <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>
                              {h.qty.toLocaleString(undefined,{maximumFractionDigits:6})} coins
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:16,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>
                              ${h.currentVal>0?h.currentVal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}
                            </div>
                            <div style={{fontSize:11,fontWeight:600,color:pnlPos?'#16a34a':'#dc2626',marginTop:2}}>
                              {pnlPos?'+':''}{h.pnlPct.toFixed(2)}% &nbsp;
                              <span style={{fontWeight:700}}>{pnlPos?'+':''}${h.pnl.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: stats grid */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                          {[
                            {l:'Invested',v:`$${h.invested.toFixed(2)}`},
                            {l:'Avg buy',v:h.avgBuyPrice>0?`$${h.avgBuyPrice.toFixed(4)}`:'—'},
                            {l:'Current price',v:h.cur>0?`$${h.cur.toFixed(4)}`:'—'},
                          ].map(x=>(
                            <div key={x.l} style={{background:'#f8fafc',borderRadius:8,padding:'7px 10px',border:'1px solid #f1f5f9'}}>
                              <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{x.l}</div>
                              <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{x.v}</div>
                            </div>
                          ))}
                        </div>

                        {/* Row 3: 24h change + BUY/SELL */}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}
                          onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:11,color:'#94a3b8'}}>24h</span>
                            <span style={{fontSize:12,fontWeight:600,
                              color:h.change24h>=0?'#16a34a':'#dc2626',
                              padding:'2px 8px',borderRadius:5,
                              background:h.change24h>=0?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)'}}>
                              {h.change24h>=0?'+':''}{h.change24h.toFixed(2)}%
                            </span>
                            <span style={{fontSize:11,color:h.change24h>=0?'#16a34a':'#dc2626'}}>
                              ({h.change24hVal>=0?'+':''}${h.change24hVal.toFixed(2)})
                            </span>
                          </div>
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>coin&&openCoin(coin,'BUY')}
                              style={{padding:'7px 16px',borderRadius:8,border:'1.5px solid rgba(34,197,94,0.35)',
                                background:'rgba(34,197,94,0.07)',color:'#16a34a',fontSize:12,fontWeight:700,cursor:'pointer',
                                fontFamily:"'DM Sans',sans-serif"}}>BUY</button>
                            <button onClick={()=>coin&&openCoin(coin,'SELL')}
                              style={{padding:'7px 16px',borderRadius:8,border:'1.5px solid rgba(239,68,68,0.35)',
                                background:'rgba(239,68,68,0.07)',color:'#dc2626',fontSize:12,fontWeight:700,cursor:'pointer',
                                fontFamily:"'DM Sans',sans-serif"}}>SELL</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {sortedHoldings.length>0&&(
                <div style={{marginTop:12,padding:'12px 16px',background:'white',borderRadius:12,border:'1px solid #f1f5f9',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10}}>Avg. buying price per coin</div>
                  {sortedHoldings.map(h=>(
                    <div key={h.coin} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f8fafc'}}>
                      <span style={{fontSize:13,color:'#64748b'}}>{h.coin}</span>
                      <div style={{display:'flex',gap:16}}>
                        {[{l:'Avg buy',v:h.avgBuyPrice>0?`$${h.avgBuyPrice.toFixed(4)}`:'—'},{l:'Current',v:h.cur>0?`$${h.cur.toFixed(4)}`:'—'},{l:'Qty',v:h.qty.toLocaleString(undefined,{maximumFractionDigits:4})}].map(x=>(
                          <div key={x.l} style={{textAlign:'right'}}><div style={{fontSize:10,color:'#94a3b8'}}>{x.l}</div><div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{x.v}</div></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══ PAST TAB ══ */}
          {tab==='past'&&(
            <>
              {filteredClosed.length===0&&filteredPast.length===0?(
                <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📁</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6}}>{searchQ?`No results for "${searchQ}"`:'No past holdings'}</div>
                  <div style={{fontSize:13}}>{searchQ?'Try a different search':'Coins you have sold will appear here'}</div>
                </div>
              ):(
                <>
                  {filteredClosed.length>0&&(
                    <>
                      <div className="section-hd">Closed positions</div>
                      {filteredClosed.map(p=>{
                        const pnlVal=p.closePnl||0, info=coinInfo(p.coin);
                        const coin=ALL_COINS.find(c=>c.short===p.coin);
                        return(
                          <div key={p.id} className="pos-card" style={{marginBottom:8,opacity:0.85,borderColor:pnlVal>=0?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',cursor:'pointer'}}
                            onClick={()=>coin&&openCoin(coin)}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <div style={{width:34,height:34,borderRadius:'50%',background:info.bg,border:`1.5px solid ${info.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:info.color,fontFamily:"'Sora',sans-serif",flexShrink:0}}>{p.coin.slice(0,3)}</div>
                                <div>
                                  <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{p.coin}/USDT</div>
                                  <div style={{display:'flex',gap:5,alignItems:'center',marginTop:1}}>
                                    <span style={{padding:'1px 6px',borderRadius:4,fontSize:9,fontWeight:700,background:p.type==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',color:p.type==='BUY'?'#16a34a':'#dc2626'}}>{p.type}</span>
                                    <span style={{fontSize:9,color:'#94a3b8',padding:'1px 6px',borderRadius:4,background:'#f1f5f9'}}>Closed</span>
                                    <span style={{fontSize:10,color:'#94a3b8'}}>{p.closeTime?.split(',')[0]||p.time?.split(',')[0]}</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{textAlign:'right'}}>
                                <div style={{fontSize:16,fontWeight:700,fontFamily:"'Sora',sans-serif",color:pnlVal>=0?'#16a34a':'#dc2626'}}>{pnlVal>=0?'+':''} ${pnlVal.toFixed(4)}</div>
                                <div style={{fontSize:10,color:'#94a3b8'}}>P&L</div>
                              </div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                              {[{l:'Entry',v:`$${p.entry.toFixed(4)}`},{l:'Closed @',v:`$${p.closePrice?.toFixed(4)||'—'}`},{l:'Qty',v:p.qty},{l:'Invested',v:`$${(p.entry*p.qty).toFixed(2)}`}].map(x=>(
                                <div key={x.l} style={{background:'#f8fafc',borderRadius:7,padding:'6px 8px'}}><div style={{fontSize:8,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:1}}>{x.l}</div><div style={{fontSize:11,fontWeight:600,color:'#0f172a'}}>{x.v}</div></div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {filteredPast.length>0&&(
                    <>
                      <div className="section-hd">Previously held coins</div>
                      <div style={{background:'white',borderRadius:14,border:'1px solid #f1f5f9',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                        {filteredPast.map((h,i)=>{
                          const coin=ALL_COINS.find(c=>c.short===h.coin);
                          return(
                            <div key={h.coin} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:i<filteredPast.length-1?'1px solid #f8fafc':'none',cursor:'pointer'}}
                              onClick={()=>coin&&openCoin(coin)}
                              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,background:h.info.bg,border:`1.5px solid ${h.info.color}44`,opacity:.6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:h.info.color,fontFamily:"'Sora',sans-serif"}}>{h.coin.slice(0,3)}</div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:600,color:'#64748b',fontFamily:"'Sora',sans-serif"}}>{h.coin}</div>
                                <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{h.lastTxn?.time?.split(',')[0]||'—'}</div>
                              </div>
                              <div style={{textAlign:'right'}}>
                                <div style={{fontSize:12,fontWeight:600,color:'#64748b'}}>Sold for ${h.totalSold.toFixed(2)}</div>
                                <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>Total proceeds</div>
                              </div>
                              <div style={{display:'flex',gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>coin&&openCoin(coin,'BUY')} style={{padding:'6px 10px',borderRadius:8,border:'1.5px solid rgba(34,197,94,0.35)',background:'rgba(34,197,94,0.07)',color:'#16a34a',fontSize:11,fontWeight:700,cursor:'pointer'}}>BUY</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ══ HISTORY TAB ══ */}
          {tab==='history'&&(
            <>
              {filteredTxns.length===0?(
                <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📋</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6}}>{searchQ?`No results for "${searchQ}"`:'No transactions yet'}</div>
                  <div style={{fontSize:13}}>{searchQ?'Try a different search':'Your trade history will appear here'}</div>
                </div>
              ):(
                <div style={{background:'white',borderRadius:14,border:'1px solid #f1f5f9',marginTop:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  {filteredTxns.map((t,i)=>{
                    const isBuy=t.type==='BUY', isSell=t.type==='SELL', isClose=t.type==='CLOSE', isDeposit=t.type==='DEPOSIT';
                    const coinMatch=t.note?.match(/(?:BUY|SELL|CLOSE \w+) [\d.]+ (\w+)/);
                    const coin=coinMatch?.[1]; const info=coin?coinInfo(coin):null;
                    return(
                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<filteredTxns.length-1?'1px solid #f8fafc':'none'}}>
                        <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:info?info.bg:'rgba(148,163,184,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {info?<span style={{fontSize:9,fontWeight:700,color:info.color,fontFamily:"'Sora',sans-serif"}}>{coin.slice(0,3)}</span>:
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDeposit?'#6366f1':'#94a3b8'} strokeWidth="2.5" strokeLinecap="round"><path d={isDeposit?'M12 5v14M5 12l7 7 7-7':'M12 19V5M5 12l7-7 7 7'}/></svg>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.note||t.type}</div>
                          <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{t.time}</div>
                        </div>
                        {t.amount!=null&&<div style={{fontSize:13,fontWeight:700,flexShrink:0,color:isBuy?'#dc2626':isSell||isClose||isDeposit?'#16a34a':'#64748b',fontFamily:"'Sora',sans-serif"}}>{isBuy?'-':'+'} ${typeof t.amount==='number'?t.amount.toLocaleString(undefined,{maximumFractionDigits:4}):t.amount}</div>}
                        <div style={{padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:700,flexShrink:0,background:isBuy?'rgba(239,68,68,0.08)':isSell?'rgba(34,197,94,0.08)':'rgba(99,102,241,0.08)',color:isBuy?'#dc2626':isSell?'#16a34a':'#6366f1'}}>{t.type}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Search modal — same style as Dashboard */}
      {showSearch&&(
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:70}}
          onClick={()=>{setShowSearch(false);setSearchQ('');}}>
          <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.3)',backdropFilter:'blur(6px)'}}/>
          <div onClick={e=>e.stopPropagation()}
            style={{position:'relative',zIndex:1,width:'90%',maxWidth:520,background:'white',borderRadius:16,border:'1px solid #e2e8f0',overflow:'hidden',boxShadow:'0 16px 48px rgba(0,0,0,0.12)',animation:'dropIn .2s cubic-bezier(.22,1,.36,1) both'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #f1f5f9'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                placeholder={tab==='open'?'Search open positions…':tab==='holdings'?'Search holdings…':tab==='past'?'Search past holdings…':'Search transactions…'}
                style={{flex:1,background:'transparent',border:'none',color:'#0f172a',fontSize:15,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
              <button onClick={()=>{setShowSearch(false);setSearchQ('');}}
                style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',color:'#64748b',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{maxHeight:360,overflowY:'auto'}}>
              {(tab==='open'?filteredOpen.map(p=>({coin:p.coin,sub:p.type})):
                tab==='holdings'?sortedHoldings.map(h=>({coin:h.coin,sub:`${h.qty.toFixed(4)} coins`})):
                tab==='past'?[...filteredClosed.map(p=>({coin:p.coin,sub:'Closed'})),...filteredPast.map(h=>({coin:h.coin,sub:'Sold'}))]:
                filteredTxns.slice(0,10).map(t=>{const m=t.note?.match(/(?:BUY|SELL|CLOSE \w+) [\d.]+ (\w+)/);return{coin:m?.[1]||t.type,sub:t.time?.split(',')[0]}})
              ).filter((x,i,a)=>x.coin&&a.findIndex(y=>y.coin===x.coin)===i).slice(0,8).map((item,i)=>{
                const info=coinInfo(item.coin);
                const coin=ALL_COINS.find(c=>c.short===item.coin);
                return(
                  <div key={i} onClick={()=>{setShowSearch(false);setSearchQ(item.coin);}}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:'1px solid #f8fafc',cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{width:34,height:34,borderRadius:'50%',background:info.bg,border:`1.5px solid ${info.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:info.color,fontFamily:"'Sora',sans-serif"}}>{item.coin.slice(0,3)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{item.coin}</div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>{item.sub}</div>
                    </div>
                    {coin&&<div style={{display:'flex',gap:6}} onClick={e=>{e.stopPropagation();setShowSearch(false);openCoin(coin);}}>
                      <span style={{fontSize:11,color:'#6366f1',fontWeight:600}}>View →</span>
                    </div>}
                  </div>
                );
              })}
              {((tab==='open'?filteredOpen:tab==='holdings'?sortedHoldings:tab==='past'?[...filteredClosed,...filteredPast]:filteredTxns).length===0)&&(
                <div style={{padding:'24px',textAlign:'center',color:'#94a3b8',fontSize:13}}>No results for "{searchQ}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSort&&<SortModal onClose={()=>setShowSort(false)} sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} options={SORT_OPTIONS}/>}
      <Toast msg={toast}/>
    </>
  );
};

export default Trades;
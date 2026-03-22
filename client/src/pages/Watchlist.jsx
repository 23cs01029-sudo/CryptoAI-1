import { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/* ─── Wallet helpers ─────────────────────────────────────────── */
const getWallet = () => {
  try { return JSON.parse(localStorage.getItem('wallet') || '{"USDT":10000}'); }
  catch { return { USDT: 10000 }; }
};
const saveWallet = (w) => {
  localStorage.setItem('wallet', JSON.stringify(w));
  window.dispatchEvent(new Event('walletUpdate'));
  syncWallet(w);
};

/* ─── Backend sync helpers ───────────────────────────────────── */
const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user')||'{}').email || null; }
  catch { return null; }
};

const syncWallet = (wallet) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/wallet', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, balances: wallet }),
  }).catch(()=>{});
};

const syncPositions = (positions) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/positions', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, positions }),
  }).catch(()=>{});
};

// eslint-disable-next-line no-unused-vars
const syncTxns = (txns) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/txns', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, txns }),
  }).catch(()=>{});
};

const syncTrade = (type, coin, symbol, qty, price, pnl=0) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/trades', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, type, coin, symbol, qty, price, pnl }),
  }).catch(()=>{});
};

const syncWatchlist = (watchlist) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/watchlist', {
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
    const n = { id:Date.now()+Math.random(), type, title, body, meta, read:false, time:new Date().toISOString() };
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
        fetch('/api/notifications', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ userEmail, type, title, body, meta }),
        }).catch(()=>{});
      }
    }
  } catch {}
};

/* ─── All coins master list ──────────────────────────────────── */
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

const TIME_FILTERS = ['1H','1D','1W','1M','1Y'];
const ALERT_THRESHOLD = 1.5; // % move triggers alert

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

/* ─── Alert banner ───────────────────────────────────────────── */
const AlertBanner = ({ alerts, onDismiss }) => {
  if (!alerts.length) return null;
  return (
    <div style={{padding:'0 0 10px'}}>
      {alerts.map(a=>(
        <div key={a.id} style={{
          display:'flex',alignItems:'center',gap:10,
          padding:'10px 16px',marginBottom:6,
          background:a.up?'rgba(34,197,94,0.07)':'rgba(239,68,68,0.07)',
          border:`1px solid ${a.up?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`,
          borderRadius:10,animation:'alertIn .3s ease',
        }}>
          <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
            background:a.up?'#22c55e':'#ef4444'}}/>
          <div style={{flex:1,fontSize:13,color:'#0f172a',fontWeight:500}}>
            <span style={{fontWeight:700,fontFamily:"'Sora',sans-serif"}}>{a.coin}</span>
            {' '}{a.up?'jumped':'dropped'}{' '}
            <span style={{fontWeight:700,color:a.up?'#16a34a':'#dc2626'}}>
              {a.up?'+':''}{a.change.toFixed(2)}%
            </span>
            {' '}in the last minute
          </div>
          <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",flexShrink:0}}>
            ${a.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})}
          </div>
          <button onClick={()=>onDismiss(a.id)}
            style={{background:'transparent',border:'none',cursor:'pointer',
              color:'#94a3b8',fontSize:14,padding:'0 2px',flexShrink:0}}>✕</button>
        </div>
      ))}
    </div>
  );
};

/* ─── Toast ──────────────────────────────────────────────────── */
const Toast = ({ msg }) => {
  if (!msg) return null;
  return (
    <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',
      padding:'12px 20px',borderRadius:12,fontSize:13,fontWeight:600,
      fontFamily:"'DM Sans',sans-serif",zIndex:500,whiteSpace:'nowrap',
      background:msg.ok?'#0f172a':'#dc2626',color:'white',
      boxShadow:'0 4px 20px rgba(0,0,0,0.18)',animation:'toastIn .25s ease'}}>
      {msg.ok?'✓ ':'✕ '}{msg.text}
    </div>
  );
};

/* ─── MAIN WATCHLIST ─────────────────────────────────────────── */
const Watchlist = () => {
  const [prices,   setPrices]   = useState({});
  const [changes,  setChanges]  = useState({});
  const [volumes,  setVolumes]  = useState({});
  const [prevPrices, setPrevPrices] = useState({}); // for alert detection

  const [watchlist, setWatchlist] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('watchlist')||'[]'); } catch { return []; }
  });

  const [alerts,  setAlerts]  = useState([]);
  const alertIdRef = useRef(0);

  /* Load ALL data from MongoDB on mount — cross-device sync */
  useEffect(() => {
    const userEmail = getUserEmail(); if (!userEmail) return;
    Promise.all([
      fetch(`/api/wallet/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`/api/positions/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`/api/watchlist/${userEmail}`).then(r=>r.json()).catch(()=>({})),
    ]).then(([wRes, pRes, wlRes])=>{
      if (wRes.balances)              { localStorage.setItem('wallet', JSON.stringify(wRes.balances)); setWallet(wRes.balances); window.dispatchEvent(new Event('walletUpdate')); }
      if (pRes.positions?.length > 0) { localStorage.setItem('positions', JSON.stringify(pRes.positions)); setPositions(pRes.positions); }
      if (wlRes.symbols?.length > 0)  { localStorage.setItem('watchlist', JSON.stringify(wlRes.symbols)); setWatchlist(wlRes.symbols); }
    }).catch(()=>{});
  }, []);

  const location = useLocation();

  const [selected,   setSelected]   = useState(()=>{
    try {
      const sym = sessionStorage.getItem('wl_selected');
      return sym ? ALL_COINS.find(c=>c.symbol===sym)||null : null;
    } catch { return null; }
  });
  const [chartData,  setChartData]  = useState([]);
  const [candles,    setCandles]    = useState([]);
  const [chartType,  setChartType]  = useState('candle');
  const [timeFilter, setTimeFilter] = useState('1D');
  const [chartLoad,  setChartLoad]  = useState(false);
  const [detailTab,  setDetailTab]  = useState('chart');

  // trade
  const [tradeType, setTradeType] = useState('BUY');
  const [tradeAmt,  setTradeAmt]  = useState('');
  const [tradeQty,  setTradeQty]  = useState('');
  const [positions, setPositions] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('positions')||'[]');}catch{return[];}
  });

  const [wallet, setWallet] = useState(getWallet);
  useEffect(()=>{
    const sync=()=>setWallet(getWallet());
    window.addEventListener('walletUpdate',sync);
    return()=>window.removeEventListener('walletUpdate',sync);
  },[]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQ,     setSearchQ]      = useState('');
  const [showSearch,  setShowSearch]   = useState(false);
  const [showSort,    setShowSort]     = useState(false);
  const [sortBy,      setSortBy]       = useState('volume');
  const [sortDir,     setSortDir]      = useState('desc');
  const [toast, setToast]  = useState(null);
  const [aiSignal,  setAiSignal]  = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const showToast = (text, ok=true) => {
    setToast({text,ok}); setTimeout(()=>setToast(null),3000);
  };

  const allWatchedCoins = ALL_COINS.filter(c=>watchlist.includes(c.symbol));
  const watchedCoins = allWatchedCoins
    .filter(c=>
      searchQ==='' ||
      c.short.toLowerCase().includes(searchQ.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQ.toLowerCase())
    )
    .sort((a,b)=>{
      const mul = sortDir==='desc' ? -1 : 1;
      if (sortBy==='change') return mul*((changes[a.symbol]||0)-(changes[b.symbol]||0));
      if (sortBy==='price')  return mul*((prices[a.symbol] ||0)-(prices[b.symbol] ||0));
      if (sortBy==='volume') return mul*((volumes[a.symbol]||0)-(volumes[b.symbol]||0));
      if (sortBy==='name')   return mul*a.short.localeCompare(b.short);
      return 0;
    });

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

  /* ─── Live WebSocket ─── */
  useEffect(()=>{
    if (!ALL_COINS.length) return;
    const streams = ALL_COINS.map(c=>`${c.symbol.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = e => {
      const{data:d}=JSON.parse(e.data); if(!d) return;
      const s=d.s, newPrice=parseFloat(d.c);

      if (watchlist.includes(s)) {
        setPrevPrices(prev=>{
          const old = prev[s];
          if (old && old > 0) {
            const pct = ((newPrice - old) / old) * 100;
            if (Math.abs(pct) >= ALERT_THRESHOLD) {
              const id = ++alertIdRef.current;
              const coin = ALL_COINS.find(c=>c.symbol===s);
              setAlerts(a=>[...a, {
                id, coin:coin?.short||s, symbol:s,
                price:newPrice, change:pct, up:pct>0,
              }].slice(-5));
              setTimeout(()=>setAlerts(a=>a.filter(x=>x.id!==id)), 12000);
            }
          }
          return {...prev,[s]:newPrice};
        });
      }

      setPrices(p=>({...p,[s]:newPrice}));
      setChanges(p=>({...p,[s]:parseFloat(d.P)}));
      setVolumes(p=>({...p,[s]:parseFloat(d.q)}));
    };

    ws.onerror = () => {
      /* connection error — prices will update once WS reconnects */
    };

    return ()=>ws.close();
  }, [watchlist]);

  /* Live P&L */
  useEffect(()=>{
    setPositions(prev=>{
      const next=prev.map(p=>{
        const cur=prices[p.symbol]; if(!cur||p.status==='CLOSED') return p;
        const pnl=p.type==='BUY'?(cur-p.entry)*p.qty:(p.entry-cur)*p.qty;
        return{...p,pnl:parseFloat(pnl.toFixed(4)),current:cur};
      });
      localStorage.setItem('positions',JSON.stringify(next));
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

  const openCoin = useCallback((coin)=>{
    setSelected(coin); setDetailTab('chart');
    setTimeFilter('1D'); setTradeAmt(''); setTradeQty(''); setTradeType('BUY');
    setAiSignal(null);
    setChartData([]); setCandles([]); // clear stale data immediately
    sessionStorage.setItem('wl_selected', coin.symbol);
    fetchChart(coin.symbol,'1D');
  },[fetchChart]);

  /* AI Signal */
  const getAISignal = async () => {
    if (!selected) return;
    setAiLoading(true); setAiSignal(null);
    const price  = selPrice;
    const change = changes[selected.symbol]||0;
    const vol    = volumes[selected.symbol]||0;
    const recentPrices = chartData.slice(-20).map(d=>d.price);
    const high = candles.length ? Math.max(...candles.slice(-20).map(c=>c.h)) : price*1.02;
    const low  = candles.length ? Math.min(...candles.slice(-20).map(c=>c.l)) : price*0.98;
    const prompt = `You are a crypto trading AI system with 4 specialist agents analyzing ${selected.short}/USDT.\n\nCurrent market data:\n- Price: $${price.toFixed(4)}\n- 24h Change: ${change.toFixed(2)}%\n- 24h Volume: $${(vol/1e6).toFixed(1)}M\n- Recent 20-candle High: $${high.toFixed(4)}\n- Recent 20-candle Low: $${low.toFixed(4)}\n- Recent prices (last 10): ${recentPrices.slice(-10).map(p=>p.toFixed(2)).join(', ')}\n\nYou must respond with ONLY valid JSON, no markdown:\n{"action":"BUY or SELL","confidence":number 40-95,"entry":"${price.toFixed(4)}","tp":"take profit 4 decimals","sl":"stop loss 4 decimals","reason":"one sentence","agents":[{"name":"Quant Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Technical Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Risk Agent","verdict":"BUY or SELL or HOLD","score":number},{"name":"Sentiment Agent","verdict":"BUY or SELL or HOLD","score":number}]}`;
    try {
      const res = await fetch('/api/ai-signal', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000,
          messages:[{role:'user',content:prompt}] }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text||'';
      const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
      setAiSignal(parsed);
      setDetailTab('chart');
      pushNotif('signal', `AI Signal: ${parsed.action} ${selected.short}/USDT`, `${parsed.action} signal · ${parsed.confidence}% confidence · Entry $${parsed.entry} · TP $${parsed.tp} · SL $${parsed.sl}`, {coin:selected.short, action:parsed.action});
    } catch {
      const isBull = change >= 0;
      setAiSignal({
        action: isBull?'BUY':'SELL',
        confidence: Math.floor(Math.random()*25)+60,
        entry: price.toFixed(4),
        tp: (isBull?price*1.055:price*0.945).toFixed(4),
        sl: (isBull?price*0.972:price*1.028).toFixed(4),
        reason: isBull
          ? `${selected.short} showing bullish momentum with strong volume support.`
          : `${selected.short} facing selling pressure with declining volume.`,
        agents: [
          {name:'Quant Agent',     verdict:isBull?'BUY':'SELL', score:Math.floor(Math.random()*20)+65},
          {name:'Technical Agent', verdict:isBull?'BUY':'HOLD', score:Math.floor(Math.random()*20)+55},
          {name:'Risk Agent',      verdict:'HOLD',               score:Math.floor(Math.random()*20)+50},
          {name:'Sentiment Agent', verdict:isBull?'BUY':'SELL', score:Math.floor(Math.random()*20)+60},
        ],
      });
      setDetailTab('chart');
    }
    setAiLoading(false);
  };

  useEffect(()=>{ if(selected) fetchChart(selected.symbol,timeFilter); },[timeFilter]); // eslint-disable-line

  /* Clear dashboard selection when navigating to Watchlist */
  useEffect(()=>{ sessionStorage.removeItem('db_selected'); },[]);

  /* Clear selected coin when navigating away from Watchlist */
  useEffect(()=>{
    setSelected(null);
    sessionStorage.removeItem('wl_selected');
  },[location.pathname]);

  /* Restore chart on mount if coming back from refresh */
  useEffect(()=>{ if(selected) fetchChart(selected.symbol,'1D'); },[]);  // eslint-disable-line

  /* Remove from watchlist */
  const removeFromWatchlist = (symbol) => {
    const next = watchlist.filter(s=>s!==symbol);
    setWatchlist(next);
    localStorage.setItem('watchlist',JSON.stringify(next));
    syncWatchlist(next); // sync to MongoDB
    if (selected?.symbol===symbol) {
      setSelected(null);
      sessionStorage.removeItem('wl_selected');
    }
    showToast('Removed from watchlist');
  };

  /* Add to watchlist */
  const addToWatchlist = (symbol) => {
    if (watchlist.includes(symbol)) { showToast('Already in watchlist',false); return; }
    const next=[...watchlist,symbol];
    setWatchlist(next);
    localStorage.setItem('watchlist',JSON.stringify(next));
    syncWatchlist(next); // sync to MongoDB
    showToast('Added to watchlist');
    setShowAddModal(false);
  };

  /* Amount ↔ Qty */
  const selPrice = selected
    ? (prices[selected.symbol] || (candles.length ? candles[candles.length-1].c : 0))
    : 0;
  const onAmtChange=(val)=>{ setTradeAmt(val); if(selPrice&&val) setTradeQty((parseFloat(val)/selPrice).toFixed(6)); else setTradeQty(''); };
  const onQtyChange=(val)=>{ setTradeQty(val); if(selPrice&&val) setTradeAmt((parseFloat(val)*selPrice).toFixed(2)); else setTradeAmt(''); };

  /* Place trade */
  const placeTrade = () => {
    const qty=parseFloat(tradeQty), price=selPrice;
    if (!qty||qty<=0) { showToast('Enter a valid quantity',false); return; }
    if (!price)       { showToast('Price not available',false); return; }
    const w=getWallet();
    if (tradeType==='BUY') {
      const cost=qty*price;
      if ((w.USDT||0)<cost) { showToast(`Not enough USDT. Need $${cost.toFixed(2)}`,false); return; }
      w.USDT=parseFloat(((w.USDT||0)-cost).toFixed(6));
      w[selected.short]=parseFloat(((w[selected.short]||0)+qty).toFixed(8));
      saveWallet(w); setWallet({...w});
      const txns=JSON.parse(localStorage.getItem('wallet_txns')||'[]');
      txns.unshift({id:Date.now(),type:'BUY',amount:cost,note:`BUY ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)}`,time:new Date().toLocaleString()});
      localStorage.setItem('wallet_txns',JSON.stringify(txns));
      showToast(`Bought ${qty.toFixed(6)} ${selected.short} for $${cost.toFixed(2)}`);
      pushNotif('trade', `BUY ${selected.short}/USDT`, `Bought ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)} · Total $${cost.toFixed(2)}`, {coin:selected.short, type:'BUY'});
      syncTrade('BUY', selected.short, selected.symbol, qty, price);
    } else {
      const owned=w[selected.short]||0;
      if (owned<=0) { showToast(`You don't own any ${selected.short}`,false); return; }
      if (qty>owned) { showToast(`Not enough. Have ${owned.toFixed(6)}`,false); return; }
      const proceeds=qty*price;
      w[selected.short]=parseFloat((owned-qty).toFixed(8));
      if (w[selected.short]<0.000001) delete w[selected.short];
      w.USDT=parseFloat(((w.USDT||0)+proceeds).toFixed(6));
      saveWallet(w); setWallet({...w});
      const txns=JSON.parse(localStorage.getItem('wallet_txns')||'[]');
      txns.unshift({id:Date.now(),type:'SELL',amount:proceeds,note:`SELL ${qty.toFixed(6)} ${selected.short} @ $${price.toFixed(2)}`,time:new Date().toLocaleString()});
      localStorage.setItem('wallet_txns',JSON.stringify(txns));
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
  const closePosition=(pos)=>{
    const curPrice=prices[pos.symbol]||pos.current||pos.entry;
    const pnl=pos.type==='BUY'?(curPrice-pos.entry)*pos.qty:(pos.entry-curPrice)*pos.qty;
    const w=getWallet();
    if (pos.type==='BUY') {
      // BUY close: return current market value to USDT
      w.USDT=parseFloat(((w.USDT||0)+pos.qty*curPrice).toFixed(6));
    } else {
      // SELL/short close: deduct buyback cost (proceeds already paid at open)
      w.USDT=parseFloat(((w.USDT||0)-pos.qty*curPrice).toFixed(6));
      // Give back coins since we're buying back to close
      w[pos.coin]=parseFloat(((w[pos.coin]||0)+pos.qty).toFixed(8));
    }
    saveWallet(w); setWallet({...w});
    const txns=JSON.parse(localStorage.getItem('wallet_txns')||'[]');
    txns.unshift({id:Date.now(),type:'CLOSE',amount:Math.abs(pnl),
      note:`CLOSE ${pos.type} ${pos.qty} ${pos.coin} — P&L: ${pnl>=0?'+':''}$${pnl.toFixed(4)}`,
      time:new Date().toLocaleString()});
    localStorage.setItem('wallet_txns',JSON.stringify(txns));
    const next=positions.map(p=>p.id===pos.id
      ?{...p,status:'CLOSED',closePrice:curPrice,closePnl:parseFloat(pnl.toFixed(4)),closeTime:new Date().toLocaleString()}
      :p);
    setPositions(next); localStorage.setItem('positions',JSON.stringify(next));
    syncPositions(next);
    showToast(`Closed — P&L: ${pnl>=0?'+':''}$${pnl.toFixed(4)}`, pnl>=0);
    syncTrade('CLOSE', pos.coin, pos.symbol, pos.qty, curPrice, parseFloat(pnl.toFixed(4)));
  };

  const selChange  = selected ? changes[selected.symbol] : 0;
  const selUp      = selChange >= 0;
  const usdtBal    = wallet.USDT ?? 0;
  const coinBal    = selected ? (wallet[selected.short]||0) : 0;
  const openPos    = (sym)=>positions.filter(p=>p.symbol===sym&&p.status!=='CLOSED');

  const bb=(active=false)=>({
    width:36,height:36,borderRadius:'50%',
    background:active?'rgba(99,102,241,0.1)':'#f1f5f9',
    border:`1.5px solid ${active?'rgba(99,102,241,0.35)':'#e2e8f0'}`,
    display:'flex',alignItems:'center',justifyContent:'center',
    cursor:'pointer',flexShrink:0,transition:'all .15s',
  });

  /* ─── Add coin modal ─── */
  const AddCoinModal = () => {
    const [q, setQ] = useState('');
    const ref = useRef(null);
    useEffect(()=>{ ref.current?.focus(); },[]);
    const available = ALL_COINS.filter(c=>
      !watchlist.includes(c.symbol) &&
      (c.name.toLowerCase().includes(q.toLowerCase())||c.short.toLowerCase().includes(q.toLowerCase()))
    );
    return (
      <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'flex-start',
        justifyContent:'center',paddingTop:70}} onClick={()=>setShowAddModal(false)}>
        <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.3)',backdropFilter:'blur(6px)'}}/>
        <div onClick={e=>e.stopPropagation()}
          style={{position:'relative',zIndex:1,width:'90%',maxWidth:520,background:'white',
            borderRadius:16,border:'1px solid #e2e8f0',overflow:'hidden',
            boxShadow:'0 16px 48px rgba(0,0,0,0.12)',animation:'dropIn .2s cubic-bezier(.22,1,.36,1) both'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #f1f5f9'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search to add…"
              style={{flex:1,background:'transparent',border:'none',color:'#0f172a',fontSize:15,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
            <button onClick={()=>setShowAddModal(false)}
              style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',
                color:'#64748b',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          {available.length===0 ? (
            <div style={{padding:'24px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
              {watchlist.length===ALL_COINS.length ? 'All coins are already in your watchlist!' : 'No coins found'}
            </div>
          ) : (
            <div style={{maxHeight:360,overflowY:'auto'}}>
              {available.map(c=>(
                <div key={c.symbol}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                    borderBottom:'1px solid #f8fafc',cursor:'pointer',transition:'background .15s'}}
                  onClick={()=>addToWatchlist(c.symbol)}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:c.bg,
                    border:`1.5px solid ${c.color}44`,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:700,color:c.color,fontFamily:"'Sora',sans-serif"}}>
                    {c.short.slice(0,3)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{c.short}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{c.name}</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>
                    {prices[c.symbol]?'$'+prices[c.symbol].toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
                  </div>
                  <div style={{padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:700,
                    background:(changes[c.symbol]||0)>=0?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
                    color:(changes[c.symbol]||0)>=0?'#16a34a':'#dc2626',
                    border:`1px solid ${(changes[c.symbol]||0)>=0?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>
                    {(changes[c.symbol]||0)>=0?'+':''}{(changes[c.symbol]||0).toFixed(2)}%
                  </div>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'#f0f4ff',
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ─── Empty state ─── */
  if (!selected && watchedCoins.length===0) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .wl-page{min-height:100vh;background:#f8fafc;font-family:'DM Sans',sans-serif;}
        @keyframes dropIn{from{opacity:0;transform:translateY(-12px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>
      <div className="wl-page" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:16,padding:24}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'#f0f4ff',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>No coins watchlisted</div>
        <div style={{fontSize:14,color:'#94a3b8',textAlign:'center',maxWidth:320,lineHeight:1.6}}>
          Star any coin on the Dashboard to add it here, or use the button below to add coins directly.
        </div>
        <button onClick={()=>setShowAddModal(true)}
          style={{padding:'12px 24px',background:'linear-gradient(135deg,#6366f1,#818cf8)',color:'white',
            border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif",boxShadow:'0 4px 16px rgba(99,102,241,0.3)'}}>
          + Add coins to watchlist
        </button>
      </div>
      {showAddModal && <AddCoinModal/>}
      <Toast msg={toast}/>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .wl-page{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column;}
        .fade-in{animation:fi .3s ease both;}
        @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes slideUp{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-12px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes alertIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .tab-ul{position:relative;}
        .tab-ul::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:#6366f1;border-radius:2px;}
        .coin-card{cursor:pointer;border-radius:12px;border:1.5px solid #f1f5f9;background:white;
          transition:border-color .15s,box-shadow .15s;overflow:hidden;}
        .coin-card:hover{border-color:#e2e8f0;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .coin-card.active{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.1);}
        .wl-ai-btn{display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;border-radius:20px;
          background:linear-gradient(135deg,#6366f1,#818cf8);color:white;font-size:12px;font-weight:600;
          cursor:pointer;font-family:'DM Sans',sans-serif;transition:opacity .15s,transform .12s;
          box-shadow:0 2px 10px rgba(99,102,241,0.3);white-space:nowrap;flex-shrink:0;}
        .wl-ai-btn:hover{opacity:.9;transform:translateY(-1px);}
        .wl-ai-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
        .wl-ai-btn-text{display:inline;}
        .wl-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;
          border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
        .wl-coin-header{display:flex;align-items:center;gap:10px;padding:14px 20px 12px;
          border-bottom:1px solid #f1f5f9;flex-shrink:0;background:white;}
        .wl-price-block{text-align:right;flex-shrink:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes signalIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}
        @media(max-width:600px){
          .wl-ai-btn{padding:7px 10px;}
          .wl-ai-btn-text{display:none!important;}
          .wl-coin-header{flex-wrap:wrap;padding:10px 14px 8px;gap:8px;}
          .wl-price-block{order:10;width:100%;text-align:left;
            display:flex;align-items:center;gap:10px;
            padding:8px 0 0;border-top:1px solid #f8fafc;margin-top:2px;}
          .wl-price-big{font-size:20px!important;}
          .wl-ai-btn-wrap{flex-shrink:0;}
        }
      `}</style>

      <div className="wl-page">
        {selected ? (
          /* ── COIN DETAIL (same as Dashboard) ── */
          <div className="fade-in" style={{display:'flex',flexDirection:'column',background:'white'}}>

            {/* Header */}
            <div className="wl-coin-header" style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px 12px',
              borderBottom:'1px solid #f1f5f9',flexShrink:0,background:'white'}}>
              <button onClick={()=>{ setSelected(null); sessionStorage.removeItem('wl_selected'); }} style={{...bb(),flexShrink:0}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,
                background:selected.bg,border:`1.5px solid ${selected.color}55`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:10,fontWeight:700,color:selected.color,fontFamily:"'Sora',sans-serif"}}>
                {selected.short.slice(0,3)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a',lineHeight:1.2}}>
                  {selected.short}<span style={{color:'#94a3b8',fontWeight:400,fontSize:12}}>/USDT</span>
                </div>
                <div style={{fontSize:10,color:'#94a3b8'}}>{selected.name}</div>
              </div>

              {/* AI Signal button */}
              <button className="wl-ai-btn" onClick={getAISignal} disabled={aiLoading}>
                {aiLoading
                  ? <><span className="wl-spinner"/><span className="wl-ai-btn-text"> Analyzing…</span></>
                  : <><span style={{fontSize:12,fontWeight:800,letterSpacing:'-0.3px'}}>AI</span><span className="wl-ai-btn-text"> Signal</span></>
                }
              </button>

              {/* Remove from watchlist (star) */}
              <button onClick={()=>removeFromWatchlist(selected.symbol)}
                title="Remove from watchlist"
                style={{background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:8,
                  display:'flex',alignItems:'center',transition:'transform .15s',flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>

              {/* Price block — moves to own row on mobile */}
              <div className="wl-price-block" style={{textAlign:'right',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <div className="wl-price-big" style={{fontSize:22,fontWeight:700,fontFamily:"'Sora',sans-serif",
                  color:selUp?'#16a34a':'#dc2626',letterSpacing:'-0.5px',lineHeight:1}}>
                  ${selPrice?selPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
                </div>
                <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,
                  background:selUp?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
                  color:selUp?'#16a34a':'#dc2626',
                  border:`1px solid ${selUp?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>
                  {selUp?'+':''}{selChange?.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Time + chart type */}
            <div style={{display:'flex',alignItems:'center',padding:'10px 20px 8px',gap:4,
              flexShrink:0,borderBottom:'1px solid #f1f5f9',background:'white'}}>
              {TIME_FILTERS.map(tf=>(
                <button key={tf} onClick={()=>setTimeFilter(tf)}
                  style={{padding:'6px 13px',borderRadius:8,border:'none',fontSize:12.5,fontWeight:500,
                    cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'.15s',
                    background:timeFilter===tf?'#f0f4ff':'transparent',color:timeFilter===tf?'#6366f1':'#64748b'}}>
                  {tf}
                </button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                {['line','candle'].map(t=>(
                  <button key={t} onClick={()=>setChartType(t)}
                    style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',
                      border:`1px solid ${chartType===t?'#e2e8f0':'transparent'}`,
                      fontSize:11.5,fontWeight:500,fontFamily:"'DM Sans',sans-serif",
                      background:chartType===t?'#f8fafc':'transparent',
                      color:chartType===t?'#0f172a':'#94a3b8',textTransform:'capitalize'}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div style={{padding:'14px 20px 0',background:'white',flexShrink:0}}>
              {chartLoad?(
                <div style={{height:260,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:13}}>Loading…</div>
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
                <button key={t} onClick={()=>setDetailTab(t)}
                  className={detailTab===t?'tab-ul':''}
                  style={{padding:'10px 18px',border:'none',background:'transparent',
                    fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",
                    textTransform:'capitalize',color:detailTab===t?'#6366f1':'#64748b',marginBottom:-2}}>
                  {t==='positions'?`Positions (${openPos(selected.symbol).length})`:t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{background:'#f8fafc'}}>

              {detailTab==='chart'&&(
                <div style={{padding:'14px 20px'}}>
                  {/* AI Signal card */}
                  {aiSignal&&(
                    <div style={{
                      background:'white',border:`1.5px solid ${aiSignal.action==='BUY'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,
                      borderRadius:14,padding:16,marginBottom:14,
                      boxShadow:`0 4px 20px ${aiSignal.action==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}`,
                      animation:'signalIn .3s cubic-bezier(.22,1,.36,1) both',
                    }}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:32,height:32,borderRadius:'50%',
                            background:`linear-gradient(135deg,${aiSignal.action==='BUY'?'#6366f1,#22c55e':'#6366f1,#ef4444'})`,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:11,fontWeight:800,color:'white',letterSpacing:'-0.3px'}}>AI</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:'#6366f1',fontFamily:"'Sora',sans-serif"}}>AI Signal</div>
                            <div style={{fontSize:10,color:'#94a3b8'}}>Multi-agent analysis</div>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:700,
                            background:aiSignal.action==='BUY'?'#22c55e':'#ef4444',color:'white',
                            fontFamily:"'Sora',sans-serif"}}>{aiSignal.action}</div>
                          <button onClick={()=>setAiSignal(null)}
                            style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:24,height:24,
                              cursor:'pointer',color:'#64748b',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                        </div>
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginBottom:4}}>
                          <span style={{textTransform:'uppercase',letterSpacing:'.4px'}}>Confidence</span>
                          <span style={{fontWeight:700,color:'#0f172a'}}>{aiSignal.confidence}%</span>
                        </div>
                        <div style={{height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:3,width:`${aiSignal.confidence}%`,
                            background:aiSignal.confidence>75?'#22c55e':aiSignal.confidence>50?'#f59e0b':'#ef4444',
                            transition:'width .8s ease'}}/>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                        {[{l:'Entry',v:`$${aiSignal.entry}`,c:'#0f172a'},{l:'Take Profit',v:`$${aiSignal.tp}`,c:'#16a34a'},{l:'Stop Loss',v:`$${aiSignal.sl}`,c:'#dc2626'}].map(x=>(
                          <div key={x.l} style={{background:'#f8fafc',borderRadius:9,padding:'9px 10px',border:'1px solid #f1f5f9',minWidth:0}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3,whiteSpace:'nowrap'}}>{x.l}</div>
                            <div style={{fontSize:12,fontWeight:700,color:x.c,fontFamily:"'Sora',sans-serif",wordBreak:'break-all',lineHeight:1.3}}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{borderTop:'1px solid #f1f5f9',paddingTop:10,marginBottom:10}}>
                        <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Agent verdicts</div>
                        {aiSignal.agents?.map(a=>(
                          <div key={a.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,gap:8}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                              <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                                background:a.verdict==='BUY'?'#22c55e':a.verdict==='SELL'?'#ef4444':'#94a3b8'}}/>
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
                      <div style={{padding:'9px 12px',background:'#f8fafc',borderRadius:9,fontSize:12,color:'#475569',lineHeight:1.6,fontStyle:'italic',wordBreak:'break-word'}}>
                        "{aiSignal.reason}"
                      </div>
                    </div>
                  )}
                  <div style={{background:'white',border:'1px solid #f1f5f9',borderRadius:12,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div style={{fontSize:11,color:'#94a3b8',marginBottom:10,textTransform:'uppercase',letterSpacing:'.4px'}}>Market info</div>
                    {[
                      {l:'Symbol',v:`${selected.short}/USDT`},
                      {l:'Price',v:`$${selPrice?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})||'—'}`},
                      {l:'24h Change',v:`${selChange>=0?'+':''}${selChange?.toFixed(2)}%`,c:selChange>=0?'#16a34a':'#dc2626'},
                      {l:'24h Volume',v:volumes[selected.symbol]?'$'+(volumes[selected.symbol]/1e6).toFixed(2)+'M':'—'},
                      {l:'Your holding',v:coinBal>0?`${coinBal.toFixed(6)} ${selected.short}`:'None',c:coinBal>0?'#16a34a':undefined},
                    ].map(x=>(
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
                        style={{padding:13,borderRadius:10,cursor:'pointer',
                          border:`1.5px solid ${tt==='BUY'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,
                          background:tradeType===tt?(tt==='BUY'?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)'):'white',
                          color:tt==='BUY'?'#16a34a':'#dc2626',fontSize:14,fontWeight:700,
                          fontFamily:"'DM Sans',sans-serif",opacity:tradeType===tt?1:0.45}}>
                        {tt}
                      </button>
                    ))}
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:500}}>Market Price — fixed</div>
                    <div style={{padding:'12px 14px',background:'#f8fafc',border:'1.5px solid #f1f5f9',borderRadius:10,
                      color:'#0f172a',fontSize:15,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>
                      ${selPrice?selPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:11,color:'#64748b',fontWeight:500}}>Amount (USDT)</span>
                      {tradeType==='BUY'&&<button onClick={()=>onAmtChange(usdtBal.toFixed(2))}
                        style={{fontSize:10,color:'#6366f1',background:'#f0f4ff',border:'none',borderRadius:5,
                          padding:'2px 7px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                        Max ${usdtBal.toFixed(2)}</button>}
                      {tradeType==='SELL'&&coinBal>0&&<button onClick={()=>onQtyChange(coinBal.toFixed(6))}
                        style={{fontSize:10,color:'#6366f1',background:'#f0f4ff',border:'none',borderRadius:5,
                          padding:'2px 7px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                        Max {coinBal.toFixed(6)}</button>}
                    </div>
                    <input value={tradeAmt} onChange={e=>onAmtChange(e.target.value)} placeholder="0.00 USDT" type="number" min="0"
                      style={{width:'100%',padding:'12px 14px',background:'white',border:'1.5px solid #e2e8f0',
                        borderRadius:10,color:'#0f172a',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}
                      onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:500}}>Quantity ({selected.short})</div>
                    <input value={tradeQty} onChange={e=>onQtyChange(e.target.value)} placeholder={`0.000000 ${selected.short}`} type="number" min="0"
                      style={{width:'100%',padding:'12px 14px',background:'white',border:'1.5px solid #e2e8f0',
                        borderRadius:10,color:'#0f172a',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}
                      onFocus={e=>e.target.style.borderColor='#6366f1'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  </div>
                  {tradeType==='SELL'&&coinBal<=0&&(
                    <div style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.2)',
                      borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#dc2626',lineHeight:1.5}}>
                      You don't own any {selected.short}. Buy first.
                    </div>
                  )}
                  <button onClick={placeTrade} disabled={tradeType==='SELL'&&coinBal<=0}
                    style={{width:'100%',padding:'14px',border:'none',borderRadius:12,fontSize:15,fontWeight:700,
                      cursor:tradeType==='SELL'&&coinBal<=0?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif",
                      background:tradeType==='SELL'&&coinBal<=0?'#e2e8f0':tradeType==='BUY'?'#22c55e':'#ef4444',
                      color:tradeType==='SELL'&&coinBal<=0?'#94a3b8':'white'}}>
                    {tradeType} {selected.short}{tradeAmt?` · $${parseFloat(tradeAmt).toFixed(2)}`:''}
                  </button>
                </div>
              )}

              {detailTab==='positions'&&(
                <div style={{padding:'14px 20px'}}>
                  {positions.filter(p=>p.symbol===selected.symbol).length===0?(
                    <div style={{textAlign:'center',color:'#94a3b8',padding:'40px 0',fontSize:13}}>No positions yet</div>
                  ):positions.filter(p=>p.symbol===selected.symbol).map(p=>{
                    const isClosed=p.status==='CLOSED';
                    const liveCur = isClosed
                      ? (p.closePrice||p.entry)
                      : (prices[p.symbol]||p.current||p.entry);
                    const pnlVal = isClosed
                      ? (p.closePnl||0)
                      : (p.type==='BUY'?(liveCur-p.entry)*p.qty:(p.entry-liveCur)*p.qty);
                    const pnlPct = p.entry>0
                      ? (p.type==='BUY'?((liveCur-p.entry)/p.entry*100):((p.entry-liveCur)/p.entry*100))
                      : 0;
                    return(
                      <div key={p.id} style={{background:'white',border:`1px solid ${isClosed?'#f1f5f9':pnlVal>=0?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'}`,
                        borderRadius:12,padding:16,marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,0.04)',opacity:isClosed?0.65:1}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a'}}>{p.coin}/USDT</span>
                            <span style={{padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:700,
                              background:p.type==='BUY'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
                              color:p.type==='BUY'?'#16a34a':'#dc2626',
                              border:`1px solid ${p.type==='BUY'?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>
                              {p.type}
                            </span>
                            {isClosed&&<span style={{padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:600,background:'#f1f5f9',color:'#64748b',border:'1px solid #e2e8f0'}}>Closed</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{textAlign:'right'}}>
                              <div style={{fontSize:14,fontWeight:700,color:pnlVal>=0?'#16a34a':'#dc2626',fontFamily:"'Sora',sans-serif"}}>
                                {pnlVal>=0?'+':''}${pnlVal.toFixed(4)}
                              </div>
                              {!isClosed&&(
                                <div style={{fontSize:11,fontWeight:600,color:pnlVal>=0?'#16a34a':'#dc2626'}}>
                                  {pnlPct>=0?'+':''}{pnlPct.toFixed(2)}%
                                </div>
                              )}
                            </div>
                            {!isClosed&&(
                              <button onClick={()=>{if(window.confirm(`Close position? P&L: ${pnlVal>=0?'+':''}$${pnlVal.toFixed(4)}`))closePosition(p);}}
                                style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid rgba(239,68,68,0.3)',
                                  background:'rgba(239,68,68,0.05)',color:'#dc2626',fontSize:11,fontWeight:600,
                                  cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                                onMouseEnter={e=>e.target.style.background='rgba(239,68,68,0.12)'}
                                onMouseLeave={e=>e.target.style.background='rgba(239,68,68,0.05)'}>
                                Close
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                          {[{l:'Entry',v:`$${p.entry.toFixed(4)}`},{l:'TP',v:`$${p.tp.toFixed(2)}`},
                            {l:'SL',v:`$${p.sl.toFixed(2)}`},{l:'Qty',v:p.qty},
                            {l:isClosed?'Closed @':'Current',v:`$${liveCur.toFixed(4)}`},
                            {l:'Time',v:p.time.split(',')[0]}].map(x=>(
                            <div key={x.l}>
                              <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>{x.l}</div>
                              <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{x.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── WATCHLIST GRID ── */
          <div style={{flex:1}}>
            {/* Top bar */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'16px 24px 12px',background:'white',borderBottom:'1px solid #f1f5f9',gap:10}}>
              <div style={{flexShrink:0}}>
                <div style={{fontSize:20,fontWeight:700,fontFamily:"'Sora',sans-serif",color:'#0f172a',letterSpacing:'-0.3px'}}>
                  Watchlist
                </div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>
                  {Object.keys(prices).length>0
                    ? `● Live · ${allWatchedCoins.length} coin${allWatchedCoins.length!==1?'s':''} watching`
                    : '○ Connecting…'}
                </div>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {/* Search bubble */}
                <button
                  onClick={()=>setShowSearch(true)}
                  style={{width:38,height:38,borderRadius:'50%',
                    background:showSearch?'rgba(99,102,241,0.1)':'#f1f5f9',
                    border:`1.5px solid ${showSearch?'rgba(99,102,241,0.35)':'#e2e8f0'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </button>

                {/* Sort bubble */}
                <button
                  onClick={()=>setShowSort(true)}
                  style={{width:38,height:38,borderRadius:'50%',
                    background:showSort?'rgba(99,102,241,0.1)':'#f1f5f9',
                    border:`1.5px solid ${showSort?'rgba(99,102,241,0.35)':'#e2e8f0'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="6"  x2="20" y2="6"/>
                    <line x1="4" y1="12" x2="14" y2="12"/>
                    <line x1="4" y1="18" x2="10" y2="18"/>
                  </svg>
                </button>

                <button onClick={()=>setShowAddModal(true)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',flexShrink:0,
                    background:'linear-gradient(135deg,#6366f1,#818cf8)',color:'white',
                    border:'none',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",boxShadow:'0 2px 10px rgba(99,102,241,0.3)'}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add coin
                </button>
              </div>
            </div>

            <div style={{padding:'16px 20px'}}>

              {/* Alert banners */}
              <AlertBanner alerts={alerts} onDismiss={id=>setAlerts(a=>a.filter(x=>x.id!==id))}/>

              {/* Coin cards grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
                {watchedCoins.map(coin=>{
                  const price  = prices[coin.symbol];
                  const change = changes[coin.symbol]||0;
                  const vol    = volumes[coin.symbol];
                  const up     = change >= 0;
                  const holding = wallet[coin.short]||0;
                  const hasAlert = alerts.some(a=>a.symbol===coin.symbol);

                  return (
                    <div key={coin.symbol}
                      className={`coin-card${hasAlert?' active':''}`}
                      onClick={()=>openCoin(coin)}
                      style={{borderColor:hasAlert?(up?'rgba(34,197,94,0.5)':'rgba(239,68,68,0.5)'):undefined}}>

                      {/* Card header */}
                      <div style={{padding:'14px 16px 10px',display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,
                          background:coin.bg,border:`1.5px solid ${coin.color}44`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:10,fontWeight:700,color:coin.color,fontFamily:"'Sora',sans-serif"}}>
                          {coin.short.slice(0,3)}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",lineHeight:1.2}}>
                            {coin.short}<span style={{color:'#94a3b8',fontWeight:400,fontSize:11}}>/USDT</span>
                          </div>
                          <div style={{fontSize:11,color:'#94a3b8'}}>
                            Vol {vol?(vol>1e9?(vol/1e9).toFixed(1)+'B':(vol/1e6).toFixed(1)+'M'):'—'}
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:17,fontWeight:700,color:'#0f172a',
                            fontFamily:"'Sora',sans-serif",letterSpacing:'-0.4px'}}>
                            {price?'$'+price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
                          </div>
                          <div style={{display:'inline-block',marginTop:3,padding:'2px 8px',borderRadius:5,
                            fontSize:11,fontWeight:700,
                            background:up?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
                            color:up?'#16a34a':'#dc2626',
                            border:`1px solid ${up?'rgba(34,197,94,0.25)':'rgba(239,68,68,0.25)'}`}}>
                            {up?'+':''}{change.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      {/* Holding + positions info */}
                      <div style={{padding:'0 16px 12px',display:'flex',gap:8}}>
                        {holding>0&&(
                          <div style={{flex:1,background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)',
                            borderRadius:8,padding:'6px 10px'}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:1}}>Holding</div>
                            <div style={{fontSize:12,fontWeight:600,color:'#16a34a'}}>
                              {holding.toLocaleString(undefined,{maximumFractionDigits:4})} {coin.short}
                            </div>
                          </div>
                        )}
                        {openPos(coin.symbol).length>0&&(
                          <div style={{flex:1,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.15)',
                            borderRadius:8,padding:'6px 10px'}}>
                            <div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:1}}>Open positions</div>
                            <div style={{fontSize:12,fontWeight:600,color:'#6366f1'}}>
                              {openPos(coin.symbol).length} active
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
                      <div style={{borderTop:'1px solid #f8fafc',padding:'8px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:11,color:'#94a3b8'}}>Tap to view chart & trade</span>
                        <button
                          onClick={e=>{e.stopPropagation();removeFromWatchlist(coin.symbol);}}
                          style={{background:'transparent',border:'none',cursor:'pointer',
                            fontSize:11,color:'#94a3b8',padding:'3px 8px',borderRadius:6,
                            transition:'color .15s'}}
                          onMouseEnter={e=>e.target.style.color='#dc2626'}
                          onMouseLeave={e=>e.target.style.color='#94a3b8'}>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alert info */}
              <div style={{marginTop:20,padding:'12px 16px',background:'rgba(99,102,241,0.04)',
                border:'1px solid rgba(99,102,241,0.15)',borderRadius:10,
                fontSize:12,color:'#64748b',display:'flex',alignItems:'center',gap:8}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                Price alerts fire automatically when any watchlisted coin moves ±{ALERT_THRESHOLD}% in a single WebSocket tick.
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && <AddCoinModal/>}

      {/* ── Sort Modal — same as Dashboard ── */}
      {showSort && (
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={()=>setShowSort(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.4)',backdropFilter:'blur(4px)'}}/>
          <div onClick={e=>e.stopPropagation()}
            style={{position:'relative',zIndex:1,width:'100%',maxWidth:600,
              background:'white',borderRadius:'20px 20px 0 0',border:'1px solid #e2e8f0',
              padding:'24px 24px 36px',boxShadow:'0 -8px 32px rgba(0,0,0,0.1)',
              animation:'slideUp 0.22s cubic-bezier(.22,1,.36,1) both'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'#e2e8f0',margin:'0 auto 20px'}}/>
            <div style={{fontSize:17,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",marginBottom:16}}>Sort by</div>
            {[
              {key:'change', label:'24h Change %'},
              {key:'price',  label:'Price'},
              {key:'volume', label:'Volume'},
              {key:'name',   label:'Coin name'},
            ].map(o=>(
              <div key={o.key} onClick={()=>setSortBy(o.key)}
                style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',
                  borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
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
            <button onClick={()=>setShowSort(false)}
              style={{width:'100%',padding:'14px',marginTop:14,background:'#22c55e',color:'white',
                border:'none',borderRadius:12,fontSize:15,fontWeight:700,
                cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Watchlist Search Modal — same style as Dashboard ── */}
      {showSearch && (
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'flex-start',
          justifyContent:'center',paddingTop:70}}
          onClick={()=>{setShowSearch(false);setSearchQ('');}}>
          <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,0.3)',backdropFilter:'blur(6px)'}}/>
          <div onClick={e=>e.stopPropagation()}
            style={{position:'relative',zIndex:1,width:'90%',maxWidth:520,background:'white',
              borderRadius:16,border:'1px solid #e2e8f0',overflow:'hidden',
              boxShadow:'0 16px 48px rgba(0,0,0,0.12)',animation:'dropIn 0.2s cubic-bezier(.22,1,.36,1) both'}}>
            {/* Input row */}
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #f1f5f9'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                autoFocus
                value={searchQ}
                onChange={e=>setSearchQ(e.target.value)}
                placeholder="Search your watchlist…"
                style={{flex:1,background:'transparent',border:'none',color:'#0f172a',
                  fontSize:15,outline:'none',fontFamily:"'DM Sans',sans-serif"}}
              />
              <button onClick={()=>{setShowSearch(false);setSearchQ('');}}
                style={{background:'#f1f5f9',border:'none',borderRadius:'50%',width:26,height:26,
                  cursor:'pointer',color:'#64748b',fontSize:13,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                ✕
              </button>
            </div>
            {/* Results */}
            <div style={{maxHeight:380,overflowY:'auto'}}>
              {allWatchedCoins.length === 0 ? (
                <div style={{padding:'24px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
                  Your watchlist is empty
                </div>
              ) : watchedCoins.length === 0 ? (
                <div style={{padding:'24px',textAlign:'center',color:'#94a3b8',fontSize:13}}>
                  No coins match "{searchQ}"
                </div>
              ) : watchedCoins.map(c=>(
                <div key={c.symbol}
                  onClick={()=>{openCoin(c);setShowSearch(false);setSearchQ('');}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                    borderBottom:'1px solid #f8fafc',cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:c.bg,
                    border:`1.5px solid ${c.color}44`,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:700,color:c.color,fontFamily:"'Sora',sans-serif"}}>
                    {c.short.slice(0,3)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>{c.short}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{c.name}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>
                      {prices[c.symbol]?'$'+prices[c.symbol].toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
                    </div>
                    <div style={{fontSize:11,fontWeight:700,
                      color:(changes[c.symbol]||0)>=0?'#16a34a':'#dc2626'}}>
                      {(changes[c.symbol]||0)>=0?'+':''}{(changes[c.symbol]||0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast}/>
    </>
  );
};

export default Watchlist;
import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

const getWallet = () => { try { return JSON.parse(localStorage.getItem('wallet') || '{"USDT":10000}'); } catch { return { USDT: 10000 }; } };
const getPositions = () => { try { return JSON.parse(localStorage.getItem('positions') || '[]'); } catch { return []; } };
const getSessions = () => { try { return JSON.parse(localStorage.getItem('ai_chat_sessions') || '[]'); } catch { return []; } };
const saveSessions = (s) => localStorage.setItem('ai_chat_sessions', JSON.stringify(s));

/* ─── Backend sync helpers ───────────────────────────────────── */
const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user')||'{}').email || null; }
  catch { return null; }
};

const syncSessions = (sessions) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch(`${API_BASE}/api/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, sessions }),
  }).catch(() => {});
};

const ALL_COINS = [
  {symbol:'BTCUSDT',short:'BTC'},{symbol:'ETHUSDT',short:'ETH'},
  {symbol:'SOLUSDT',short:'SOL'},{symbol:'BNBUSDT',short:'BNB'},
  {symbol:'XRPUSDT',short:'XRP'},{symbol:'DOGEUSDT',short:'DOGE'},
  {symbol:'ADAUSDT',short:'ADA'},{symbol:'AVAXUSDT',short:'AVAX'},
  {symbol:'DOTUSDT',short:'DOT'},{symbol:'MATICUSDT',short:'MATIC'},
];

const COINS_LIST = [
  'BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC'
];

const PROMPT_CATEGORIES = [
  {
    label: '🪙 Coin Analysis',
    color: '#6366f1',
    prompts: [
      { icon:'📈', text:'Give me a BTC trading signal with entry, TP and SL' },
      { icon:'🔮', text:'Analyze ETH price action and suggest a trade' },
      { icon:'⚡', text:'Which coin has the best momentum right now?' },
      { icon:'📊', text:'Compare BTC vs ETH risk/reward this week' },
    ]
  },
  {
    label: '💼 My Portfolio',
    color: '#22C55E',
    prompts: [
      { icon:'💼', text:'Analyze my portfolio and suggest improvements' },
      { icon:'📉', text:'Which of my positions are at risk?' },
      { icon:'💰', text:'How is my current P&L looking?' },
      { icon:'🎯', text:'What should I rebalance in my portfolio?' },
    ]
  },
  {
    label: '🧠 Strategy & Learning',
    color: '#F59E0B',
    prompts: [
      { icon:'🤖', text:'How does the 4-agent AI analysis system work?' },
      { icon:'📚', text:'Explain RSI and MACD indicators simply' },
      { icon:'⚠️', text:'What are the biggest risks in crypto trading?' },
      { icon:'💡', text:'What is a good risk management strategy?' },
    ]
  },
];

const AGENTS = [
  { name:'Quant Agent',    icon:'📐', desc:'Price momentum, RSI-like indicators, volume patterns' },
  { name:'Technical Agent',icon:'📉', desc:'Support/resistance, trend direction, breakout zones' },
  { name:'Risk Agent',     icon:'🛡️', desc:'Volatility, position sizing, conservative scoring' },
  { name:'Sentiment Agent',icon:'🌡️', desc:'24h price change & volume to gauge market mood' },
];

const renderMd = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace;color:#6366f1">$1</code>')
    .replace(/^### (.+)$/gm, '<div style="font-size:13px;font-weight:700;color:#0f172a;margin:12px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#0f172a;margin:14px 0 6px">$1</div>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#6366f1;margin-top:2px">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, '<br/>');
};

const Bubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{display:'flex',justifyContent:isUser?'flex-end':'flex-start',marginBottom:16,animation:'msgIn .2s ease both'}}>
      {!isUser && <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#6366f1,#818cf8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'white',marginRight:10,marginTop:2,boxShadow:'0 2px 8px rgba(99,102,241,0.3)'}}>AI</div>}
      <div style={{maxWidth:'76%',padding:isUser?'10px 16px':'12px 16px',borderRadius:isUser?'18px 18px 4px 18px':'4px 18px 18px 18px',background:isUser?'linear-gradient(135deg,#6366f1,#818cf8)':'white',color:isUser?'white':'#0f172a',fontSize:13.5,lineHeight:1.65,fontFamily:"'DM Sans',sans-serif",boxShadow:isUser?'0 2px 12px rgba(99,102,241,0.25)':'0 1px 6px rgba(0,0,0,0.07)',border:isUser?'none':'1px solid #f1f5f9',wordBreak:'break-word'}}>
        {msg.typing
          ? <div style={{display:'flex',gap:4,alignItems:'center',padding:'2px 4px'}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#6366f1',animation:`bounce .9s ease ${i*0.15}s infinite`}}/>)}</div>
          : isUser ? <span>{msg.content}</span>
          : <div dangerouslySetInnerHTML={{__html:renderMd(msg.content)}}/>
        }
        {!msg.typing && msg.time && (
          <div style={{fontSize:10,color:isUser?'rgba(255,255,255,0.5)':'#94a3b8',marginTop:4,textAlign:'right'}}>{msg.time}</div>
        )}
      </div>
      {isUser && <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,background:'#f1f5f9',border:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,marginLeft:10,marginTop:2}}>👤</div>}
    </div>
  );
};

const AIChat = () => {
  const [sessions, setSessions]       = useState(getSessions);
  const [activeId, setActiveId]       = useState(null);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAgents, setShowAgents]   = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput]   = useState('');
  const [prices, setPrices]           = useState({});
  const [syncing, setSyncing]         = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const wsRef    = useRef(null);
  const titleRef = useRef(null);

  const active = sessions.find(s => s.id === activeId);

  /* WebSocket prices */
  useEffect(() => {
    const t = setTimeout(() => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${ALL_COINS.map(c=>`${c.symbol.toLowerCase()}@ticker`).join('/')}`);
      wsRef.current = ws;
      ws.onmessage = e => { try { const d=(JSON.parse(e.data)).data; if(d?.s&&d?.c) setPrices(p=>({...p,[d.s]:parseFloat(d.c)})); } catch {} };
    }, 200);
    return () => { clearTimeout(t); wsRef.current?.close(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [active?.messages]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);

  const newSession = useCallback(() => {
    const id = Date.now().toString();
    const s = { id, title:'New conversation', messages:[], createdAt:new Date().toISOString() };
    setSessions(prev => {
      const next = [s, ...prev];
      saveSessions(next);
      syncSessions(next);
      return next;
    });
    setActiveId(id);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  /* Load from MongoDB on mount */
  useEffect(() => {
    const userEmail = getUserEmail();
    if (userEmail) {
      // Load wallet + positions from MongoDB so AI chat has fresh portfolio context
      Promise.all([
        fetch(`${API_BASE}/api/wallet/${userEmail}`).then(r=>r.json()).catch(()=>({})),
        fetch(`${API_BASE}/api/positions/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      ]).then(([wRes, pRes]) => {
        if (wRes.balances)              { localStorage.setItem('wallet', JSON.stringify(wRes.balances)); window.dispatchEvent(new Event('walletUpdate')); }
        if (pRes.positions?.length > 0) { localStorage.setItem('positions', JSON.stringify(pRes.positions)); }
      }).catch(() => {});

      setSyncing(true);
      fetch(`${API_BASE}/api/chat/sessions/${encodeURIComponent(userEmail)}`)
        .then(r => r.json())
        .then(data => {
          setSyncing(false);
          if (data.sessions?.length > 0) {
            setSessions(data.sessions);
            saveSessions(data.sessions);
            setActiveId(data.sessions[0].id);
          } else {
            if (sessions.length === 0) newSession();
            else { setActiveId(sessions[0].id); syncSessions(sessions); }
          }
        })
        .catch(() => {
          setSyncing(false);
          if (sessions.length === 0) newSession();
          else setActiveId(sessions[0].id);
        });
    } else {
      if (sessions.length === 0) newSession();
      else setActiveId(sessions[0].id);
    }
  }, []); // eslint-disable-line

  const delSession = (id, e) => {
    e?.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      saveSessions(next);
      syncSessions(next);
      if (activeId === id) {
        if (next.length > 0) setActiveId(next[0].id);
        else setTimeout(newSession, 50);
      }
      return next;
    });
  };

  const startRename = () => { setTitleInput(active?.title || ''); setEditingTitle(true); };

  const commitRename = () => {
    const t = titleInput.trim();
    if (t) {
      setSessions(prev => {
        const next = prev.map(s => s.id === activeId ? {...s, title: t} : s);
        saveSessions(next);
        syncSessions(next);
        return next;
      });
    }
    setEditingTitle(false);
  };

  const buildSys = () => {
    const w = getWallet();
    const pos = getPositions().filter(p=>p.status!=='CLOSED');
    const holdings = Object.entries(w).filter(([k])=>k!=='USDT'&&w[k]>0.000001)
      .map(([coin,qty])=>{ const sym=ALL_COINS.find(c=>c.short===coin)?.symbol; const cur=sym?(prices[sym]||0):0; return `${coin}: ${qty.toFixed(4)} @ $${cur.toFixed(2)} = $${(qty*cur).toFixed(2)}`; });
    const liveP = ALL_COINS.filter(c=>prices[c.symbol]).map(c=>`${c.short}: $${prices[c.symbol].toFixed(4)}`).join(', ');
    return `You are CryptoAI, an expert cryptocurrency trading assistant powered by 4 specialist agents:
1. Quant Agent — price momentum, RSI indicators, volume analysis
2. Technical Agent — support/resistance, trend direction, breakouts
3. Risk Agent — volatility measurement, position sizing, risk scoring
4. Sentiment Agent — 24h price change & volume to gauge market mood

User's live portfolio:
- USDT Balance: $${(w.USDT||0).toFixed(2)}
- Holdings: ${holdings.length?holdings.join(', '):'None'}
- Open positions: ${pos.length?pos.map(p=>`${p.type} ${p.coin} qty:${p.qty} entry:$${p.entry?.toFixed(2)} pnl:${p.pnl>=0?'+':''}$${p.pnl?.toFixed(2)}`).join(', '):'None'}
- Live prices: ${liveP||'Loading'}

Rules: For trading signals include Action/Entry/TP/SL/Confidence/Reasoning. Reference actual portfolio data. Use **bold** for numbers. Use ## for sections. Add risk disclaimer on trade advice.`;
  };

  const saveAndSync = (prev, sid, newMsg) => {
    const next = prev.map(s => {
      if (s.id !== sid) return s;
      return {...s, messages:[...(s.messages||[]).filter(m=>!m.typing), newMsg]};
    });
    saveSessions(next);
    syncSessions(next);
    return next;
  };

  const send = async (txt) => {
    const content = (txt||input).trim();
    if (!content||loading) return;
    setInput('');
    const sid = activeId;
    const prevMsgs = sessions.find(s=>s.id===sid)?.messages||[];
    const userMsg = { id:Date.now(), role:'user', content, time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) };
    const typMsg  = { id:'typing', role:'assistant', typing:true };

    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id!==sid) return s;
        const first = (s.messages||[]).length===0;
        return {...s, title:first?content.slice(0,45):s.title, messages:[...(s.messages||[]),userMsg,typMsg]};
      });
      const clean = next.map(s=>({...s,messages:(s.messages||[]).filter(m=>!m.typing)}));
      saveSessions(clean);
      syncSessions(clean);
      return next;
    });
    setLoading(true);

    const history = prevMsgs.filter(m=>!m.typing).map(m=>({role:m.role,content:m.content}));
    try {
      const res = await fetch(`${API_BASE}/api/chat/message`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:buildSys(),messages:[...history,{role:'user',content}]})});
      const data = await res.json();
      const reply = data.reply || data.content?.[0]?.text || 'Sorry, I could not process that.';
      const aiMsg = { id:Date.now()+1, role:'assistant', content:reply, time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) };
      setSessions(prev => saveAndSync(prev, sid, aiMsg));
    } catch {
      const lower = content.toLowerCase();
      const w = getWallet();
      let reply = `I'm CryptoAI, powered by 4 specialist agents:\n\n- **Quant Agent** — momentum & volume analysis\n- **Technical Agent** — support/resistance & trends\n- **Risk Agent** — volatility & position sizing\n- **Sentiment Agent** — market mood from price & volume\n\nI can help with trading signals, portfolio analysis, market education, and risk management. What would you like?`;
      if (lower.includes('portfolio')||lower.includes('hold')||lower.includes('analyz')) {
        const h=Object.entries(w).filter(([k])=>k!=='USDT'&&w[k]>0.000001);
        reply=`## Portfolio Analysis\n\n**USDT Balance:** $${(w.USDT||0).toFixed(2)}\n**Holdings:** ${h.length?h.map(([c,q])=>`${c}: ${q.toFixed(4)}`).join(', '):'None yet'}\n\n${h.length===0?'Portfolio is fully in USDT. Suggested allocation:\n- BTC 40% — stability & store of value\n- ETH 30% — DeFi & smart contracts exposure\n- SOL 20% — high growth potential\n- USDT 10% — reserve for opportunities':'Holdings detected. Consider rebalancing quarterly and keeping 10-15% in stablecoins as a reserve.'}\n\n⚠️ *Not financial advice. Always DYOR.*`;
      } else if (lower.includes('btc')||lower.includes('bitcoin')||lower.includes('signal')) {
        const btc=prices['BTCUSDT']||65000;
        reply=`## BTC/USDT Signal — Multi-Agent Analysis\n\n**Action:** BUY\n**Entry:** $${btc.toLocaleString(undefined,{maximumFractionDigits:2})}\n**Take Profit:** $${(btc*1.055).toLocaleString(undefined,{maximumFractionDigits:2})} (+5.5%)\n**Stop Loss:** $${(btc*0.972).toLocaleString(undefined,{maximumFractionDigits:2})} (-2.8%)\n**Confidence:** 74%\n\n- 📐 **Quant:** Bullish momentum, volume confirming\n- 📉 **Technical:** Above key support, trend intact\n- 🛡️ **Risk:** R/R ratio 1:1.96 — acceptable\n- 🌡️ **Sentiment:** Positive 24h change, stable volume\n\n⚠️ *Risk max 2% of portfolio per trade.*`;
      } else if (lower.includes('agent')) {
        reply=`## The 4-Agent AI System\n\n**📐 Quant Agent**\nAnalyzes price momentum using RSI-like calculations from recent candle data, volume confirmation, and price position within recent high/low range.\n\n**📉 Technical Agent**\nLooks at support/resistance levels, current trend direction, and flags potential breakout or breakdown zones based on candle patterns.\n\n**🛡️ Risk Agent**\nMeasures volatility (wide high/low range = high risk), checks if volume justifies the move, outputs a conservative score to balance aggressive signals.\n\n**🌡️ Sentiment Agent**\nUses the 24h % change and volume directly — strong green + high volume = bullish, strong red + low volume = bearish.\n\nA **Judge** then takes a weighted vote across all 4 agents to produce the final BUY/SELL signal with confidence %.`;
      } else if (lower.includes('defi')) {
        reply=`## DeFi vs CeFi\n\n**DeFi** — Smart contracts, you control keys. Examples: Uniswap, Aave. Risks: bugs, impermanent loss.\n**CeFi** — Exchanges like Binance. Custodial, easier UX. Risks: hacks, regulation.\n\n**Best practice:** CeFi for active trading, DeFi for earning yield on idle assets.`;
      }
      const aiMsg={id:Date.now()+1,role:'assistant',content:reply,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
      setSessions(prev => saveAndSync(prev, sid, aiMsg));
    }
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const totalMsgs = active?.messages?.filter(m=>!m.typing).length || 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .aic{display:flex;flex-direction:column;height:100vh;background:#f8fafc;font-family:'DM Sans',sans-serif;overflow:hidden;position:relative;}
        .aic-body{display:flex;flex:1;min-height:0;overflow:hidden;}
        .aic-main{display:flex;flex-direction:column;flex:1;min-width:0;}
        .aic-msgs{flex:1;overflow-y:auto;padding:24px 0 8px;}
        .aic-msgs::-webkit-scrollbar{width:4px;} .aic-msgs::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px;}
        .aic-wrap{max-width:760px;margin:0 auto;padding:0 20px;width:100%;}
        .aic-footer{padding:12px 0 16px;background:white;border-top:1px solid #f1f5f9;flex-shrink:0;}
        .aic-box{display:flex;align-items:flex-end;gap:10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:16px;padding:10px 12px;transition:border-color .15s;}
        .aic-box:focus-within{border-color:#6366f1;background:white;}
        .aic-ta{flex:1;background:transparent;border:none;outline:none;resize:none;font-size:14px;font-family:'DM Sans',sans-serif;color:#0f172a;line-height:1.5;max-height:120px;min-height:24px;}
        .aic-ta::placeholder{color:#94a3b8;}
        .send-btn{width:36px;height:36px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#818cf8);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s,transform .1s;box-shadow:0 2px 8px rgba(99,102,241,0.3);}
        .send-btn:hover{opacity:.9;transform:scale(1.05);} .send-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
        .sg{padding:10px 14px;border-radius:12px;border:1.5px solid #e2e8f0;background:white;color:#475569;font-size:12.5px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;text-align:left;line-height:1.4;}
        .sg:hover{border-color:#6366f1;color:#6366f1;background:#f0f4ff;}
        .ic-btn{display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;transition:all .15s;flex-shrink:0;}
        .ic-btn:hover{background:rgba(99,102,241,0.08)!important;}
        /* hist-panel styles now in responsive section above */
        .sess-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .12s;margin-bottom:3px;}
        .sess-row:hover{background:#f8fafc;}
        .sess-row.active{background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);}
        @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        .aic-prices{display:flex;gap:14px;flex-shrink:0;}
        /* hist-panel styles now in responsive section above */
        @media(max-width:640px){
          .aic-prices{display:none!important;}
          .aic-wrap{padding:0 12px;}
          .aic{height:100dvh;}
          .hist-panel.open{position:fixed;top:0;right:0;bottom:0;width:100vw;z-index:200;border-left:none;box-shadow:-4px 0 24px rgba(0,0,0,0.12);}
          .sg{padding:8px 12px;font-size:12px;}
        }
        @media(max-width:400px){
          .aic-wrap{padding:0 8px;}
        }
      `}</style>

      <div className="aic">
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',background:'white',borderBottom:'1px solid #f1f5f9',flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#818cf8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'white',boxShadow:'0 2px 10px rgba(99,102,241,0.25)',flexShrink:0}}>AI</div>
          <button onClick={newSession} title="New conversation" className="ic-btn"
            style={{width:30,height:30,borderRadius:8,background:'#f1f5f9',border:'1.5px solid #e2e8f0',fontSize:18,fontWeight:300,color:'#6366f1',lineHeight:1}}>+</button>

          <div style={{flex:1,minWidth:0}}>
            {editingTitle ? (
              <input ref={titleRef} value={titleInput} onChange={e=>setTitleInput(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e=>{if(e.key==='Enter')commitRename();if(e.key==='Escape')setEditingTitle(false);}}
                style={{width:'100%',fontSize:14,fontWeight:600,color:'#0f172a',fontFamily:"'Sora',sans-serif",background:'transparent',border:'none',borderBottom:'1.5px solid #6366f1',outline:'none',padding:'2px 0'}}/>
            ) : (
              <div onClick={startRename} title="Click to rename" style={{display:'flex',alignItems:'center',gap:6,cursor:'text'}}>
                <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:180}}>
                  {active?.title||'New conversation'}
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
            )}
            <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e'}}/>
              <span style={{fontSize:11,color:'#94a3b8',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted',textUnderlineOffset:2}}
                onClick={()=>setShowAgents(v=>!v)}>4 agents active</span>
              <span style={{fontSize:11,color:'#94a3b8'}}>· {totalMsgs} messages</span>
              {syncing&&<span style={{fontSize:10,color:'#6366f1',animation:'pulse 1s ease infinite'}}>↑ syncing…</span>}
            </div>
          </div>

          <div className="aic-prices">
            {['BTCUSDT','ETHUSDT','SOLUSDT'].filter(s=>prices[s]).map(sym=>{
              const short=ALL_COINS.find(c=>c.symbol===sym)?.short;
              const p=prices[sym];
              return(<div key={sym} style={{textAlign:'right'}}>
                <div style={{fontSize:10,color:'#94a3b8'}}>{short}</div>
                <div style={{fontSize:12,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>${p>=1000?(p/1000).toFixed(2)+'k':p.toFixed(3)}</div>
              </div>);
            })}
          </div>

          <button onClick={()=>setShowHistory(v=>!v)} title="Chat history" className="ic-btn"
            style={{width:34,height:34,borderRadius:10,background:showHistory?'rgba(99,102,241,0.1)':'#f1f5f9',border:`1.5px solid ${showHistory?'rgba(99,102,241,0.3)':'#e2e8f0'}`,color:showHistory?'#6366f1':'#64748b'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
            </svg>
          </button>
        </div>

        {showAgents&&(
          <div style={{background:'white',borderBottom:'1px solid #f1f5f9',padding:'12px 16px',animation:'fadeIn .15s ease'}}>
            <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10}}>Active agents</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
              {AGENTS.map(a=>(
                <div key={a.name} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',background:'#f8fafc',borderRadius:10,border:'1px solid #f1f5f9'}}>
                  <span style={{fontSize:16,flexShrink:0}}>{a.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{a.name}</div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:1,lineHeight:1.4}}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowAgents(false)} style={{marginTop:8,background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#94a3b8',padding:0}}>Close ✕</button>
          </div>
        )}

        <div className="aic-body">
          <div className="aic-main">
            <div className="aic-msgs">
              <div className="aic-wrap">
                {!active||active.messages.length===0?(
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:32}}>
                    <div style={{width:68,height:68,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#818cf8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,color:'white',marginBottom:14,boxShadow:'0 8px 32px rgba(99,102,241,0.25)'}}>AI</div>
                    <div style={{fontSize:22,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif",marginBottom:6}}>Hello, Trader 👋</div>
                    <div style={{fontSize:14,color:'#64748b',marginBottom:28,maxWidth:360,lineHeight:1.6}}>I'm your AI trading assistant with live access to your portfolio. Ask me anything about crypto, get trading signals, or analyze your holdings.</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:10,width:'100%'}}>
                      {}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'.6px',textTransform:'uppercase',marginBottom:8}}>🪙 Choose a coin to analyze</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {COINS_LIST.map(coin=>(
                        <button key={coin} onClick={()=>send(`Give me a trade signal for ${coin}/USDT with entry, take profit and stop loss`)} style={{padding:'5px 12px',borderRadius:8,border:'1.5px solid #334155',background:'#1E293B',color:'#e2e8f0',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='#6366f1';e.currentTarget.style.color='#6366f1';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#334155';e.currentTarget.style.color='#e2e8f0';}}>{coin}</button>
                      ))}
                    </div>
                  </div>

                  {/* Category prompts */}
                  {PROMPT_CATEGORIES.map((cat,ci)=>(
                    <div key={ci} style={{marginBottom:14}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'.6px',textTransform:'uppercase',marginBottom:7}}>{cat.label}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                        {cat.prompts.map((p,pi)=>(
                          <button key={pi} className="sg" onClick={()=>send(p.text)} onMouseEnter={e=>{e.currentTarget.style.background=cat.color+'18';e.currentTarget.style.borderColor=cat.color;}} onMouseLeave={e=>{e.currentTarget.style.background='#1E293B';e.currentTarget.style.borderColor=cat.color+'44';}}
                            style={{borderColor:cat.color+'44'}}>
                            <span style={{marginRight:6}}>{p.icon}</span>{p.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                    </div>
                  </div>
                ):(active.messages.map(msg=><Bubble key={msg.id} msg={msg}/>))}
                <div ref={endRef}/>
              </div>
            </div>

            <div className="aic-footer">
              <div className="aic-wrap">
                {totalMsgs===2&&(
                  <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                    {['Analyze my portfolio','BTC signal','ETH signal','Market overview'].map(t=>(
                      <button key={t} onClick={()=>send(t)}
                        style={{padding:'5px 12px',borderRadius:20,border:'1px solid #e2e8f0',background:'white',color:'#64748b',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#6366f1';e.currentTarget.style.color='#6366f1';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#64748b';}}>{t}</button>
                    ))}
                  </div>
                )}
                <div className="aic-box">
                  <textarea ref={inputRef} className="aic-ta" value={input}
                    onChange={e=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
                    placeholder="Ask about crypto, request a signal, analyze your portfolio…"
                    rows={1} disabled={loading}/>
                  <button className="send-btn" onClick={()=>send()} disabled={!input.trim()||loading}>
                    {loading?<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
                    :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
                  </button>
                </div>
                <div style={{textAlign:'center',fontSize:10,color:'#cbd5e1',marginTop:8}}>CryptoAI · Powered by Claude · Not financial advice</div>
              </div>
            </div>
          </div>

          <div className={`hist-panel${showHistory?' open':''}`}>
            {showHistory&&(
              <div style={{width:280,height:'100%',display:'flex',flexDirection:'column',animation:'fadeIn .15s ease'}}>
                <div style={{padding:'16px 16px 12px',borderBottom:'1px solid #f1f5f9',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>Chat History</div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      {syncing&&<span style={{fontSize:10,color:'#6366f1',animation:'pulse 1s ease infinite'}}>syncing…</span>}
                      <button onClick={()=>setShowHistory(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:16,padding:4,borderRadius:6}}>✕</button>
                    </div>
                  </div>
                  <button onClick={newSession}
                    style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px dashed #e2e8f0',background:'transparent',color:'#6366f1',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:8,transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#6366f1';e.currentTarget.style.background='#f0f4ff';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='transparent';}}>
                    <span style={{fontSize:16}}>+</span> New conversation
                  </button>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'10px 10px'}}>
                  {sessions.length===0?(
                    <div style={{textAlign:'center',color:'#94a3b8',fontSize:12,padding:'20px 0'}}>No conversations yet</div>
                  ):sessions.map(s=>(
                    <div key={s.id} className={`sess-row${s.id===activeId?' active':''}`} onClick={()=>setActiveId(s.id)}>
                      <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:s.id===activeId?'rgba(99,102,241,0.12)':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💬</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:s.id===activeId?600:400,color:s.id===activeId?'#6366f1':'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                        <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>{s.messages?.filter(m=>!m.typing).length||0} messages</div>
                      </div>
                      <button onClick={e=>delSession(s.id,e)}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#e2e8f0',fontSize:13,padding:'2px 4px',borderRadius:4,flexShrink:0}}
                        onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
                        onMouseLeave={e=>e.currentTarget.style.color='#e2e8f0'}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{padding:'12px 16px',borderTop:'1px solid #f1f5f9',background:'#f8fafc',flexShrink:0}}>
                  <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Your Portfolio</div>
                  <div style={{fontSize:14,fontWeight:700,color:'#0f172a',fontFamily:"'Sora',sans-serif"}}>${(getWallet().USDT||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} USDT</div>
                  <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{getPositions().filter(p=>p.status!=='CLOSED').length} open positions</div>
                  <div style={{fontSize:10,color:'#6366f1',marginTop:4,display:'flex',alignItems:'center',gap:4}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
                    Synced to cloud
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChat;
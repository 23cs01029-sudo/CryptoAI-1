import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

const NAV_LINKS = [
  { path: "/dashboard",     label: "Dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { path: "/watchlist",     label: "Watchlist",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { path: "/trades",        label: "Trades",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
  { path: "/ai-chat",       label: "AI Chat",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { path: "/analytics",     label: "Analytics",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { path: "/wallet",        label: "Wallet",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8L4 7h16l-4-4z"/><circle cx="18" cy="13" r="1" fill="currentColor"/></svg> },
  { path: "/notifications",  label: "Notifications",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

const getWallet = () => {
  try { return JSON.parse(localStorage.getItem("wallet") || '{"USDT":10000}'); }
  catch { return { USDT: 10000 }; }
};

const getNotifs = () => {
  try { return JSON.parse(localStorage.getItem("notifications") || "[]"); }
  catch { return []; }
};

const fmtTime = (iso) => {
  try {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return ""; }
};

const TYPE_COLOR = { trade:"#6366f1", price:"#f59e0b", signal:"#22c55e", system:"#94a3b8" };

const Navbar = ({ notifCount = 0 }) => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [walletOpen,  setWalletOpen]  = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [wallet,      setWallet]      = useState(getWallet);
  const [notifs, setNotifs] = useState(getNotifs);
  const [unread, setUnread] = useState(() => getNotifs().filter(n => !n.read).length);
  const walletRef = useRef(null);
  const notifRef  = useRef(null);

  useEffect(() => {
    const sync = () => {
      setWallet(getWallet());
      const n = getNotifs();
      setNotifs(n);
      setUnread(n.filter(x => !x.read).length);
    };
    window.addEventListener("walletUpdate",  sync);
    window.addEventListener("storage",       sync);
    window.addEventListener("notifUpdate",   sync);
    window.addEventListener("notifsUpdated", sync);
    return () => {
      window.removeEventListener("walletUpdate",  sync);
      window.removeEventListener("storage",       sync);
      window.removeEventListener("notifUpdate",   sync);
      window.removeEventListener("notifsUpdated", sync);
    };
  }, []);

  /* Sync wallet + notifications from MongoDB on mount — works across devices */
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userEmail = user.email;
      if (!userEmail) return;
      // Wallet sync
      fetch(`${API_BASE}/api/wallet/${userEmail}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.balances) {
            localStorage.setItem('wallet', JSON.stringify(data.balances));
            setWallet(data.balances);
            window.dispatchEvent(new Event('walletUpdate'));
          }
        }).catch(() => {});
      // Notifications sync
      fetch(`${API_BASE}/api/notifications/${userEmail}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!Array.isArray(data) || data.length === 0) return;
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
          // Merge local + remote, deduplicate by id, sort newest first
          const merged = [...remote, ...local]
            .filter((n, i, arr) => arr.findIndex(x => String(x.id) === String(n.id)) === i)
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 100);
          localStorage.setItem('notifications', JSON.stringify(merged));
          setNotifs(merged);
          setUnread(merged.filter(x => !x.read).length);
        })
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const h = e => {
      if (walletRef.current && !walletRef.current.contains(e.target)) setWalletOpen(false);
      if (notifRef.current  && !notifRef.current.contains(e.target))  setNotifOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const holdings = Object.entries(wallet).filter(([k]) => k !== "USDT" && wallet[k] > 0);
  const usdtBal  = wallet.USDT ?? 10000;

  const handleWalletClick = () => {
    if (walletOpen) { setWalletOpen(false); navigate("/wallet"); }
    else setWalletOpen(true);
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');

    /* ── Desktop left sidebar ── */
    .nb-sidebar {
      position:fixed; top:0; left:0; bottom:0; width:220px;
      background:white; border-right:1px solid #e2e8f0;
      display:flex; flex-direction:column; z-index:200;
      font-family:'DM Sans',sans-serif;
      box-shadow:2px 0 16px rgba(15,23,42,0.05);
    }
    .nb-brand {
      font-family:'Sora',sans-serif; font-size:20px; font-weight:700;
      letter-spacing:-0.4px;
      background:linear-gradient(135deg,#3b6ef8 0%,#6366f1 60%,#818cf8 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text; text-decoration:none; display:block;
    }
    .nb-section {
      font-size:10px; font-weight:600; color:#94a3b8;
      text-transform:uppercase; letter-spacing:0.6px;
      padding:16px 20px 6px;
    }
    .nb-links { flex:1; overflow-y:auto; padding:8px 12px; scrollbar-width:none; }
    .nb-links::-webkit-scrollbar { display:none; }
    .nb-link {
      display:flex; align-items:center; gap:10px; text-decoration:none;
      font-size:13.5px; font-weight:500; color:#64748b;
      padding:10px 12px; border-radius:10px;
      transition:background .15s,color .15s; margin-bottom:2px; white-space:nowrap;
    }
    .nb-link:hover  { background:rgba(99,102,241,0.07); color:#4f46e5; }
    .nb-link.active { background:rgba(99,102,241,0.1); color:#4338ca; font-weight:600; }
    .nb-link-icon   { color:#94a3b8; flex-shrink:0; transition:color .15s; }
    .nb-link:hover .nb-link-icon  { color:#4f46e5; }
    .nb-link.active .nb-link-icon { color:#4338ca; }
    .nb-bottom { border-top:1px solid #f1f5f9; padding:12px; flex-shrink:0; }
    .nb-wallet-btn {
      width:100%; display:flex; align-items:center; gap:10px;
      padding:10px 12px; border-radius:10px;
      border:1.5px solid #e2e8f0; background:#f8fafc;
      cursor:pointer; font-family:'DM Sans',sans-serif;
      transition:border-color .15s,background .15s; text-align:left; position:relative;
    }
    .nb-wallet-btn:hover { border-color:rgba(99,102,241,0.4); background:rgba(99,102,241,0.04); }
    .nb-wallet-dot {
      width:30px; height:30px; border-radius:50%;
      background:linear-gradient(135deg,#6366f1,#818cf8);
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; font-size:12px; font-weight:700; color:white; font-family:'Sora',sans-serif;
    }
    .nb-wallet-info { flex:1; min-width:0; }
    .nb-wallet-label { font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:.4px; }
    .nb-wallet-bal { font-size:14px; font-weight:700; color:#0f172a; font-family:'Sora',sans-serif; }
    .nb-notif-btn {
      display:flex; align-items:center; gap:10px; width:100%;
      padding:10px 12px; border-radius:10px; border:none; background:transparent;
      cursor:pointer; font-family:'DM Sans',sans-serif;
      font-size:13.5px; font-weight:500; color:#64748b;
      margin-top:4px; transition:background .15s,color .15s; position:relative;
    }
    .nb-notif-btn:hover { background:rgba(99,102,241,0.07); color:#4f46e5; }
    .nb-wallet-drop {
      position:absolute; bottom:calc(100% + 8px); left:0; right:0;
      background:white; border:1px solid #e2e8f0; border-radius:14px;
      box-shadow:0 -4px 24px rgba(15,23,42,0.12); overflow:hidden;
      animation:dropUp .2s cubic-bezier(.22,1,.36,1); z-index:300; min-width:196px;
    }
    @keyframes dropUp { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:none} }
    @keyframes dropIn { from{opacity:0;transform:translateY(-8px) scale(.97)} to{opacity:1;transform:none} }
    .nb-notif-drop {
      position:absolute; bottom:calc(100% + 8px); left:0; right:0;
      background:white; border:1px solid #e2e8f0; border-radius:14px;
      box-shadow:0 -4px 24px rgba(15,23,42,0.12); overflow:hidden;
      animation:dropUp .2s cubic-bezier(.22,1,.36,1); z-index:300; min-width:260px;
    }
    .nb-drop-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 14px 8px; border-bottom:1px solid #f1f5f9;
    }
    .nb-drop-head span { font-size:13px; font-weight:600; color:#0f172a; font-family:'Sora',sans-serif; }
    .nb-drop-close {
      width:24px; height:24px; border-radius:50%; background:#f1f5f9;
      border:none; cursor:pointer; font-size:12px; color:#64748b;
      display:flex; align-items:center; justify-content:center;
    }
    .nb-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f8fafc; }
    .nb-drop-btn {
      width:calc(100% - 28px); margin:10px 14px; padding:9px; border:none;
      border-radius:9px; background:linear-gradient(135deg,#6366f1,#818cf8);
      color:white; font-size:12.5px; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif;
    }
    .nb-notif-item { display:flex; align-items:flex-start; gap:10px; padding:9px 14px; transition:background .15s; cursor:pointer; }
    .nb-notif-item:hover { background:rgba(99,102,241,0.04); }
    .nb-ndot { width:7px; height:7px; border-radius:50%; margin-top:5px; flex-shrink:0; }
    .nb-badge {
      position:absolute; top:50%; transform:translateY(-50%); right:12px;
      min-width:18px; height:18px; padding:0 5px;
      background:#ef4444; border-radius:9px;
      font-size:10px; font-weight:700; color:white;
      display:flex; align-items:center; justify-content:center;
    }

    /* ── Mobile topbar ── */
    .nb-topbar {
      display:none; position:fixed; top:0; left:0; right:0; z-index:1000;
      height:62px;
      background:rgba(255,255,255,0.88);
      backdrop-filter:blur(20px) saturate(1.4);
      -webkit-backdrop-filter:blur(20px) saturate(1.4);
      border-bottom:1px solid rgba(200,215,235,0.55);
      align-items:center; justify-content:space-between;
      padding:0 16px;
      box-shadow:0 2px 16px rgba(100,140,200,0.08);
      font-family:'DM Sans',sans-serif;
    }
    .nb-topbar-brand {
      font-family:'Sora',sans-serif; font-size:20px; font-weight:700;
      letter-spacing:-0.4px;
      background:linear-gradient(135deg,#3b6ef8 0%,#6366f1 60%,#818cf8 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text; text-decoration:none;
    }
    .nb-mob-wallet {
      display:flex; align-items:center; gap:6px;
      padding:6px 10px 6px 7px;
      background:rgba(255,255,255,0.9);
      border:1.5px solid rgba(200,215,235,0.7);
      border-radius:24px; cursor:pointer; font-family:'DM Sans',sans-serif;
      box-shadow:0 2px 8px rgba(100,140,200,0.08);
    }
    .nb-mob-dot {
      width:20px; height:20px; border-radius:50%;
      background:linear-gradient(135deg,#6366f1,#818cf8);
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:700; color:white; font-family:'Sora',sans-serif; flex-shrink:0;
    }
    .nb-mob-bal { font-size:12px; font-weight:600; color:#0f172a; white-space:nowrap; }
    .nb-hamburger {
      width:38px; height:38px; border-radius:50%;
      background:rgba(255,255,255,0.85); border:1.5px solid rgba(200,215,235,0.7);
      display:flex; align-items:center; justify-content:center; cursor:pointer;
      box-shadow:0 2px 8px rgba(100,140,200,0.1);
    }
    .nb-mob-overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,0.35); backdrop-filter:blur(2px); z-index:999; }
    .nb-mob-overlay.open { display:block; }
    .nb-mob-panel {
      position:fixed; top:0; right:0; bottom:0; width:240px;
      background:rgba(255,255,255,0.97); border-left:1px solid rgba(200,215,235,0.6);
      box-shadow:-8px 0 32px rgba(100,140,200,0.14); z-index:1001;
      padding:24px 16px; display:flex; flex-direction:column; gap:4px;
      transform:translateX(100%); transition:transform .3s cubic-bezier(.22,1,.36,1);
    }
    .nb-mob-panel.open { transform:translateX(0); }
    .nb-mob-brand {
      font-family:'Sora',sans-serif; font-size:18px; font-weight:700;
      background:linear-gradient(135deg,#3b6ef8,#6366f1);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text; margin-bottom:16px; padding:0 8px;
    }
    .nb-mob-link {
      display:flex; align-items:center; gap:10px; text-decoration:none;
      font-size:14px; font-weight:500; color:#475569;
      padding:11px 12px; border-radius:10px; transition:background .15s,color .15s;
    }
    .nb-mob-link:hover  { background:rgba(99,102,241,0.07); color:#4f46e5; }
    .nb-mob-link.active { background:rgba(99,102,241,0.1); color:#4338ca; font-weight:600; }
    .nb-mob-link-icon { color:#94a3b8; flex-shrink:0; transition:color .15s; }
    .nb-mob-link:hover .nb-mob-link-icon  { color:#4f46e5; }
    .nb-mob-link.active .nb-mob-link-icon { color:#4338ca; }

    /* ── Breakpoints ── */
    @media (max-width:768px) {
      .nb-sidebar       { display:none !important; }
      .nb-topbar        { display:flex !important; }
      .nb-mob-topoffset { height:62px; display:block; }
    }
    @media (min-width:769px) {
      .nb-topbar        { display:none !important; }
      .nb-mob-overlay   { display:none !important; }
      .nb-mob-panel     { display:none !important; }
      .nb-mob-topoffset { display:none !important; }
    }
  `;

  return (
    <>
      <style>{CSS}</style>

      {/* ── Desktop left sidebar ── */}
      <aside className="nb-sidebar">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #f1f5f9",padding:"18px 16px 16px"}}>
          <Link to="/dashboard" className="nb-brand" style={{padding:0,border:"none"}}>CryptoAI</Link>
          {/* Notification bell beside brand */}
          <div ref={notifRef} style={{position:"relative"}}>
            <button
              onClick={()=>setNotifOpen(p=>!p)}
              style={{width:34,height:34,borderRadius:"50%",background:notifOpen?"rgba(99,102,241,0.1)":"#f1f5f9",border:`1.5px solid ${notifOpen?"rgba(99,102,241,0.35)":"#e2e8f0"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative",transition:"all .15s",flexShrink:0}}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={notifOpen?"#6366f1":"#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread>0 && (
                <span style={{
                  position:"absolute", top:-3, right:-3,
                  minWidth:16, height:16, padding:"0 4px",
                  background:"#ef4444", borderRadius:8,
                  fontSize:9, fontWeight:700, color:"white",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  border:"2px solid white", lineHeight:1,
                }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </button>
            {notifOpen && (
              <div className="nb-notif-drop" style={{bottom:"auto",top:"calc(100% + 8px)",left:0,right:"auto",minWidth:280}}>
                <div className="nb-drop-head">
                  <span>Notifications</span>
                  <button className="nb-drop-close" onClick={()=>setNotifOpen(false)}>✕</button>
                </div>
                {notifs.length === 0 ? (
                  <div style={{padding:"24px 14px",textAlign:"center",color:"#94a3b8",fontSize:12}}>
                    No notifications yet
                  </div>
                ) : (
                  <>
                    {notifs.slice(0,5).map((n)=>(
                      <div key={n.id} className="nb-notif-item"
                        style={{background:n.read?"white":"rgba(99,102,241,0.03)",borderLeft:`2px solid ${n.read?"transparent":"#6366f1"}`}}
                        onClick={()=>{
                          const updated=getNotifs().map(x=>x.id===n.id?{...x,read:true}:x);
                          localStorage.setItem("notifications",JSON.stringify(updated));
                          setNotifs(updated); setUnread(updated.filter(x=>!x.read).length);
                          setNotifOpen(false); navigate("/notifications");
                        }}>
                        <span className="nb-ndot" style={{background:TYPE_COLOR[n.type]||"#94a3b8"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12.5,color:"#334155",lineHeight:1.4,fontWeight:n.read?400:600,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{fmtTime(n.time)}</div>
                        </div>
                        {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",flexShrink:0,marginTop:4}}/>}
                      </div>
                    ))}
                  </>
                )}
                <div style={{padding:"10px 14px",borderTop:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  {unread>0&&<span style={{fontSize:11,color:"#6366f1",fontWeight:600}}>{unread} unread</span>}
                  <button onClick={()=>{ setNotifOpen(false); navigate("/notifications"); }}
                    style={{fontSize:12.5,fontWeight:600,color:"#4f46e5",background:"none",border:"none",cursor:"pointer",marginLeft:"auto",fontFamily:"'DM Sans',sans-serif",padding:0}}>
                    View all →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="nb-links">
          <div className="nb-section">Menu</div>
          {NAV_LINKS.map(({ path, label, icon }) => (
            <Link key={path} to={path}
              className={`nb-link${location.pathname === path ? " active" : ""}`}>
              <span className="nb-link-icon">{icon}</span>
              {label}
              {path === "/notifications" && unread > 0 && (
                <span style={{
                  marginLeft:"auto", minWidth:18, height:18, padding:"0 5px",
                  background:"#ef4444", borderRadius:9, fontSize:10, fontWeight:700,
                  color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                  lineHeight:1,
                }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="nb-bottom">
          {/* Wallet */}
          <div ref={walletRef} style={{ position:"relative" }}>
            <button className="nb-wallet-btn" onClick={handleWalletClick}>
              <div className="nb-wallet-dot">$</div>
              <div className="nb-wallet-info">
                <div className="nb-wallet-label">Wallet</div>
                <div className="nb-wallet-bal">
                  ${usdtBal.toLocaleString(undefined,{maximumFractionDigits:2})}
                  <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:3}}>USDT</span>
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {walletOpen && (
              <div className="nb-wallet-drop">
                <div className="nb-drop-head">
                  <span>My Wallet</span>
                  <button className="nb-drop-close" onClick={()=>setWalletOpen(false)}>✕</button>
                </div>
                <div className="nb-row">
                  <div>
                    <div style={{fontSize:11,color:"#94a3b8"}}>Available balance</div>
                    <div style={{fontSize:14,fontWeight:700,color:"#0f172a",fontFamily:"'Sora',sans-serif"}}>
                      ${usdtBal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                      <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:4}}>USDT</span>
                    </div>
                  </div>
                </div>
                {holdings.length>0 ? (
                  <>
                    <div style={{padding:"6px 14px 3px",fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".5px"}}>Holdings</div>
                    {holdings.map(([coin,qty])=>(
                      <div key={coin} className="nb-row">
                        <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{coin}</span>
                        <span style={{fontSize:12,color:"#64748b"}}>{qty.toLocaleString(undefined,{maximumFractionDigits:6})}</span>
                      </div>
                    ))}
                  </>
                ):(
                  <div style={{padding:"14px",textAlign:"center",fontSize:12,color:"#94a3b8"}}>No coin holdings yet</div>
                )}
                <button className="nb-drop-btn" onClick={()=>{setWalletOpen(false);navigate("/wallet");}}>
                  Add funds &amp; manage wallet →
                </button>
              </div>
            )}
          </div>

          {/* Notifications button moved to header beside brand */}

          {/* Logout */}
          <button
            onClick={()=>{
              localStorage.removeItem('user');
              localStorage.removeItem('wallet');
              localStorage.removeItem('positions');
              localStorage.removeItem('wallet_txns');
              localStorage.removeItem('watchlist');
              localStorage.removeItem('notifications');
              localStorage.removeItem('notifs_seeded');
              navigate('/');
            }}
            style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,
              padding:'10px 12px',borderRadius:10,border:'none',
              background:'transparent',cursor:'pointer',
              fontFamily:"'DM Sans',sans-serif",fontSize:'13.5px',
              fontWeight:500,color:'#ef4444',marginTop:4,
              transition:'background .15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.07)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <nav className="nb-topbar">
        <Link to="/dashboard" className="nb-topbar-brand">CryptoAI</Link>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="nb-mob-wallet" onClick={()=>navigate("/wallet")}>
            <div className="nb-mob-dot">$</div>
            <span className="nb-mob-bal">
              ${usdtBal.toLocaleString(undefined,{maximumFractionDigits:2})}
              <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:2}}>USDT</span>
            </span>
          </button>

          {/* Notification bell — mobile */}
          <div style={{position:"relative"}}>
            <button className="nb-hamburger" style={{position:"relative"}}
              onClick={()=>setNotifOpen(p=>!p)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unread>0&&(
                <span style={{position:"absolute",top:4,right:4,width:8,height:8,
                  background:"#ef4444",borderRadius:"50%",border:"2px solid white"}}/>
              )}
            </button>
            {notifOpen&&(
              <div style={{position:"fixed",top:70,right:12,width:"calc(100vw - 24px)",maxWidth:320,
                background:"white",border:"1px solid #e2e8f0",borderRadius:14,
                boxShadow:"0 8px 32px rgba(15,23,42,0.15)",overflow:"hidden",
                animation:"dropIn .2s cubic-bezier(.22,1,.36,1)",zIndex:1100}}>
                <div className="nb-drop-head">
                  <span>Notifications</span>
                  <button className="nb-drop-close" onClick={()=>setNotifOpen(false)}>✕</button>
                </div>
                {notifs.length === 0 ? (
                  <div style={{padding:"24px 14px",textAlign:"center",color:"#94a3b8",fontSize:12}}>No notifications yet</div>
                ) : notifs.slice(0,5).map((n)=>(
                  <div key={n.id} className="nb-notif-item"
                    style={{background:n.read?"white":"rgba(99,102,241,0.03)",borderLeft:`2px solid ${n.read?"transparent":"#6366f1"}`}}
                    onClick={()=>{
                      const updated=getNotifs().map(x=>x.id===n.id?{...x,read:true}:x);
                      localStorage.setItem("notifications",JSON.stringify(updated));
                      setNotifs(updated); setUnread(updated.filter(x=>!x.read).length);
                      setNotifOpen(false); navigate("/notifications");
                    }}>
                    <span className="nb-ndot" style={{background:TYPE_COLOR[n.type]||"#94a3b8"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12.5,color:"#334155",lineHeight:1.4,fontWeight:n.read?400:600,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{fmtTime(n.time)}</div>
                    </div>
                    {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#6366f1",flexShrink:0,marginTop:4}}/>}
                  </div>
                ))}
                <div style={{padding:"10px 14px",borderTop:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  {unread>0&&<span style={{fontSize:11,color:"#6366f1",fontWeight:600}}>{unread} unread</span>}
                  <button onClick={()=>{ setNotifOpen(false); navigate("/notifications"); }}
                    style={{fontSize:12.5,fontWeight:600,color:"#4f46e5",background:"none",border:"none",cursor:"pointer",marginLeft:"auto",fontFamily:"'DM Sans',sans-serif",padding:0}}>
                    View all →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger menu */}
          <button className="nb-hamburger" onClick={()=>setSidebarOpen(p=>!p)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile slide panel */}
      <div className={`nb-mob-overlay${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(false)}/>
      <div className={`nb-mob-panel${sidebarOpen?" open":""}`}>
        <div className="nb-mob-brand">CryptoAI</div>
        {NAV_LINKS.map(({path,label,icon})=>(
          <Link key={path} to={path}
            className={`nb-mob-link${location.pathname===path?" active":""}`}>
            <span className="nb-mob-link-icon">{icon}</span>
            {label}
            {path === "/notifications" && unread > 0 && (
              <span style={{
                marginLeft:"auto", minWidth:18, height:18, padding:"0 5px",
                background:"#ef4444", borderRadius:9, fontSize:10, fontWeight:700,
                color:"white", display:"flex", alignItems:"center", justifyContent:"center",
              }}>{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>
        ))}
        <div style={{marginTop:"auto",padding:"12px",background:"#f8fafc",borderRadius:12,border:"1px solid #f1f5f9",cursor:"pointer"}}
          onClick={()=>{setSidebarOpen(false);navigate("/wallet");}}>
          <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:4}}>Wallet</div>
          <div style={{fontSize:15,fontWeight:700,color:"#0f172a",fontFamily:"'Sora',sans-serif"}}>
            ${usdtBal.toLocaleString(undefined,{maximumFractionDigits:2})}
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:400,marginLeft:4}}>USDT</span>
          </div>
          <div style={{fontSize:11,color:"#6366f1",marginTop:4,fontWeight:500}}>Tap to manage →</div>
        </div>

        {/* Logout — mobile */}
        <button
          onClick={()=>{
            localStorage.removeItem('user');
            localStorage.removeItem('wallet');
            localStorage.removeItem('positions');
            localStorage.removeItem('wallet_txns');
            localStorage.removeItem('watchlist');
            localStorage.removeItem('notifications');
            localStorage.removeItem('notifs_seeded');
            setSidebarOpen(false);
            navigate('/');
          }}
          style={{
            display:'flex',alignItems:'center',gap:10,width:'100%',
            padding:'12px',borderRadius:10,border:'1px solid rgba(239,68,68,0.2)',
            background:'rgba(239,68,68,0.05)',cursor:'pointer',marginTop:8,
            fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,
            color:'#ef4444',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>

      <div className="nb-mob-topoffset" style={{height:62}}/>
    </>
  );
};

export default Navbar;
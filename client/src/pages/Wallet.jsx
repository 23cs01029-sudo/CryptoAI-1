import { useState, useEffect } from "react";

const getWallet = () => {
  try { return JSON.parse(localStorage.getItem("wallet") || '{"USDT":10000}'); }
  catch { return { USDT: 10000 }; }
};
const getUserEmail = () => {
  try { return JSON.parse(localStorage.getItem('user')||'{}').email || null; }
  catch { return null; }
};

const syncWalletDB = (w) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/wallet', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, balances: w }) }).catch(()=>{});
};

const syncTxnsDB = (t) => {
  const userEmail = getUserEmail(); if (!userEmail) return;
  fetch('/api/txns', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userEmail, txns: t }) }).catch(()=>{});
};

const saveWallet = (w) => {
  localStorage.setItem("wallet", JSON.stringify(w));
  window.dispatchEvent(new Event("walletUpdate"));
  syncWalletDB(w);
};

const getTxns = () => {
  try { return JSON.parse(localStorage.getItem("wallet_txns") || "[]"); }
  catch { return []; }
};
const saveTxns = (t) => {
  localStorage.setItem("wallet_txns", JSON.stringify(t));
  syncTxnsDB(t);
};

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000, 25000];

const Wallet = () => {
  const [wallet, setWallet]     = useState(getWallet);
  const [txns,   setTxns]       = useState(getTxns);
  const [amount, setAmount]     = useState("");
  const [tab,    setTab]        = useState("add");   // add | holdings | history
  const [msg,    setMsg]        = useState(null);    // { text, ok }

  useEffect(() => {
    const sync = () => { setWallet(getWallet()); setTxns(getTxns()); };
    window.addEventListener("walletUpdate", sync);
    return () => window.removeEventListener("walletUpdate", sync);
  }, []);

  /* Load wallet + txns from MongoDB on mount — cross-device sync */
  useEffect(() => {
    const userEmail = getUserEmail(); if (!userEmail) return;
    Promise.all([
      fetch(`/api/wallet/${userEmail}`).then(r=>r.json()).catch(()=>({})),
      fetch(`/api/txns/${userEmail}`).then(r=>r.json()).catch(()=>({})),
    ]).then(([wRes, tRes]) => {
      if (wRes.balances) {
        localStorage.setItem('wallet', JSON.stringify(wRes.balances));
        setWallet(wRes.balances);
        window.dispatchEvent(new Event('walletUpdate'));
      }
      if (tRes.txns?.length > 0) {
        localStorage.setItem('wallet_txns', JSON.stringify(tRes.txns));
        setTxns(tRes.txns);
      }
    }).catch(() => {});
  }, []);

  const showMsg = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const addFunds = (val) => {
    const amt = parseFloat(val);
    if (!amt || amt <= 0) { showMsg("Enter a valid amount", false); return; }
    if (amt > 1000000)    { showMsg("Maximum deposit is $1,000,000", false); return; }
    const updated = { ...wallet, USDT: (wallet.USDT || 0) + amt };
    saveWallet(updated);
    setWallet(updated);
    const txn = {
      id: Date.now(), type: "DEPOSIT", amount: amt,
      note: `Added $${amt.toLocaleString()} USDT`,
      time: new Date().toLocaleString(),
    };
    const newTxns = [txn, ...txns];
    saveTxns(newTxns);
    setTxns(newTxns);
    setAmount("");
    showMsg(`$${amt.toLocaleString()} USDT added to your wallet!`);
  };

  const resetWallet = () => {
    if (!window.confirm("Reset wallet to $10,000 USDT? This will clear all balances.")) return;
    const fresh = { USDT: 10000 };
    saveWallet(fresh);
    setWallet(fresh);
    const txn = {
      id: Date.now(), type: "RESET", amount: 10000,
      note: "Wallet reset to $10,000 USDT",
      time: new Date().toLocaleString(),
    };
    const newTxns = [txn, ...txns];
    saveTxns(newTxns);
    setTxns(newTxns);
    showMsg("Wallet reset to $10,000 USDT");
  };

  const holdings = Object.entries(wallet).filter(([k]) => k !== "USDT" && wallet[k] > 0);
  const usdtBal  = wallet.USDT ?? 0;
  const totalHoldings = holdings.length;

  const inp = {
    width: "100%", padding: "14px 16px",
    border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: 20, fontWeight: 700, color: "#0f172a",
    outline: "none", background: "white",
    fontFamily: "'Sora', sans-serif", boxSizing: "border-box",
    transition: "border-color .2s",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .wl { font-family:'DM Sans',sans-serif; color:#0f172a; max-width:600px; margin:0 auto; padding:24px 20px; }
        .wl-tab-bar { display:flex; gap:4px; background:#f1f5f9; padding:4px; border-radius:12px; margin-bottom:24px; }
        .wl-tab {
          flex:1; padding:9px 0; border:none; border-radius:9px; cursor:pointer;
          font-size:13px; font-weight:500; font-family:'DM Sans',sans-serif;
          background:transparent; color:#64748b; transition:.15s;
        }
        .wl-tab.active { background:white; color:#0f172a; font-weight:600;
          box-shadow:0 1px 4px rgba(0,0,0,0.08); }

        .wl-card {
          background:white; border:1px solid #f1f5f9; border-radius:16px;
          padding:20px; margin-bottom:14px;
          box-shadow:0 1px 4px rgba(0,0,0,0.04);
        }

        .quick-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .quick-btn {
          padding:10px 0; border:1.5px solid #e2e8f0; border-radius:10px;
          background:white; color:#0f172a; font-size:13px; font-weight:600;
          cursor:pointer; font-family:'DM Sans',sans-serif; transition:.15s;
        }
        .quick-btn:hover { border-color:#6366f1; color:#6366f1; background:#f0f4ff; }

        .add-btn {
          width:100%; padding:14px; border:none; border-radius:12px;
          background:linear-gradient(135deg,#6366f1,#818cf8); color:white;
          font-size:15px; font-weight:700; cursor:pointer;
          font-family:'DM Sans',sans-serif;
          box-shadow:0 4px 16px rgba(99,102,241,0.25);
          transition:opacity .15s, transform .12s;
        }
        .add-btn:hover { opacity:.92; transform:translateY(-1px); }
        .add-btn:active { transform:translateY(0); }

        .reset-btn {
          width:100%; padding:11px; border:1.5px solid #fee2e2; border-radius:10px;
          background:transparent; color:#dc2626; font-size:13px; font-weight:500;
          cursor:pointer; font-family:'DM Sans',sans-serif; transition:.15s;
        }
        .reset-btn:hover { background:#fef2f2; }

        .holding-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 0; border-bottom:1px solid #f8fafc;
        }
        .holding-row:last-child { border-bottom:none; }

        .txn-row {
          display:flex; align-items:center; gap:12px;
          padding:12px 0; border-bottom:1px solid #f8fafc;
        }
        .txn-row:last-child { border-bottom:none; }
        .txn-icon {
          width:36px; height:36px; border-radius:10px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
        }

        .toast {
          position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
          padding:12px 20px; border-radius:12px; font-size:13px; font-weight:600;
          font-family:'DM Sans',sans-serif; z-index:500; white-space:nowrap;
          animation:toastIn .25s ease;
          box-shadow:0 4px 20px rgba(0,0,0,0.15);
        }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>

      <div className="wl">

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:24, fontWeight:700, fontFamily:"'Sora',sans-serif",
            letterSpacing:"-0.4px", margin:0 }}>My Wallet</h1>
          <p style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>
            Manage your virtual trading funds
          </p>
        </div>

        {/* Balance card */}
        <div style={{
          background:"linear-gradient(135deg,#6366f1 0%,#818cf8 60%,#a5b4fc 100%)",
          borderRadius:20, padding:"24px 24px 20px", marginBottom:20, color:"white",
        }}>
          <div style={{ fontSize:12, fontWeight:500, opacity:.8, marginBottom:6,
            textTransform:"uppercase", letterSpacing:".5px" }}>
            Available balance
          </div>
          <div style={{ fontSize:36, fontWeight:700, fontFamily:"'Sora',sans-serif",
            letterSpacing:"-1px", lineHeight:1 }}>
            ${usdtBal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style={{ fontSize:13, opacity:.75, marginTop:4 }}>USDT</div>
          {totalHoldings > 0 && (
            <div style={{ marginTop:14, paddingTop:14,
              borderTop:"1px solid rgba(255,255,255,0.2)",
              fontSize:12, opacity:.85 }}>
              {totalHoldings} coin holding{totalHoldings > 1 ? "s" : ""} in portfolio
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="wl-tab-bar">
          {["add","holdings","history"].map(t => (
            <button key={t} className={`wl-tab${tab===t?" active":""}`}
              onClick={() => setTab(t)}>
              {t === "add" ? "Add Funds" : t === "holdings" ? "Holdings" : "History"}
            </button>
          ))}
        </div>

        {/* ── ADD FUNDS TAB ── */}
        {tab === "add" && (
          <>
            <div className="wl-card">
              <div style={{ fontSize:12, color:"#64748b", fontWeight:500,
                marginBottom:10, textTransform:"uppercase", letterSpacing:".4px" }}>
                Quick add
              </div>
              <div className="quick-grid">
                {QUICK_AMOUNTS.map(a => (
                  <button key={a} className="quick-btn" onClick={() => addFunds(a)}>
                    +${a.toLocaleString()}
                  </button>
                ))}
              </div>

              <div style={{ fontSize:12, color:"#64748b", fontWeight:500,
                marginBottom:8, textTransform:"uppercase", letterSpacing:".4px" }}>
                Custom amount
              </div>
              <div style={{ position:"relative", marginBottom:12 }}>
                <div style={{ position:"absolute", left:16, top:"50%",
                  transform:"translateY(-50%)", fontSize:20, fontWeight:700,
                  color:"#94a3b8", fontFamily:"'Sora',sans-serif" }}>$</div>
                <input
                  type="number" min="1" max="1000000"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addFunds(amount)}
                  style={{ ...inp, paddingLeft:32 }}
                  onFocus={e  => e.target.style.borderColor = "#6366f1"}
                  onBlur={e   => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
              <button className="add-btn" onClick={() => addFunds(amount)}>
                Add funds to wallet
              </button>
            </div>

            <div className="wl-card">
              <div style={{ fontSize:13, color:"#64748b", marginBottom:12, lineHeight:1.5 }}>
                This is a virtual trading wallet. Funds are simulated — no real money is involved.
                Use this to practice crypto trading strategies.
              </div>
              <button className="reset-btn" onClick={resetWallet}>
                Reset wallet to $10,000
              </button>
            </div>
          </>
        )}

        {/* ── HOLDINGS TAB ── */}
        {tab === "holdings" && (
          <div className="wl-card">
            <div style={{ fontSize:13, fontWeight:600, color:"#0f172a",
              marginBottom:14, fontFamily:"'Sora',sans-serif" }}>
              Current holdings
            </div>

            {/* USDT row */}
            <div className="holding-row">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:"50%",
                  background:"linear-gradient(135deg,#6366f1,#818cf8)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700, color:"white",
                  fontFamily:"'Sora',sans-serif" }}>
                  $
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#0f172a" }}>USDT</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>Tether</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#0f172a",
                  fontFamily:"'Sora',sans-serif" }}>
                  ${usdtBal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>
                  {usdtBal.toLocaleString(undefined,{maximumFractionDigits:2})} USDT
                </div>
              </div>
            </div>

            {holdings.length === 0 ? (
              <div style={{ textAlign:"center", color:"#94a3b8", padding:"24px 0",
                fontSize:13 }}>
                No coin holdings yet. Go to Dashboard to buy coins!
              </div>
            ) : holdings.map(([coin, qty]) => (
              <div key={coin} className="holding-row">
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%",
                    background:"rgba(99,102,241,0.1)", border:"1.5px solid rgba(99,102,241,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700, color:"#6366f1",
                    fontFamily:"'Sora',sans-serif" }}>
                    {coin.slice(0,3)}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#0f172a" }}>{coin}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>Cryptocurrency</div>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#0f172a",
                    fontFamily:"'Sora',sans-serif" }}>
                    {qty.toLocaleString(undefined,{maximumFractionDigits:6})}
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{coin}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="wl-card">
            <div style={{ fontSize:13, fontWeight:600, color:"#0f172a",
              marginBottom:14, fontFamily:"'Sora',sans-serif" }}>
              Transaction history
            </div>

            {txns.length === 0 ? (
              <div style={{ textAlign:"center", color:"#94a3b8", padding:"24px 0", fontSize:13 }}>
                No transactions yet.
              </div>
            ) : txns.map(txn => {
              const isDeposit = txn.type === "DEPOSIT";
              // eslint-disable-next-line no-unused-vars
              const isReset   = txn.type === "RESET";
              const isBuy     = txn.type === "BUY";
              const isSell    = txn.type === "SELL";
              return (
                <div key={txn.id} className="txn-row">
                  <div className="txn-icon" style={{
                    background: isDeposit ? "rgba(34,197,94,0.1)"
                      : isSell   ? "rgba(34,197,94,0.1)"
                      : isBuy    ? "rgba(239,68,68,0.1)"
                      : "rgba(148,163,184,0.1)",
                  }}>
                    {isDeposit ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                      </svg>
                    ) : isBuy ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M5 12l7-7 7 7M12 5v14"/>
                      </svg>
                    ) : isSell ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{txn.note}</div>
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{txn.time}</div>
                  </div>
                  {txn.amount && (
                    <div style={{ fontSize:13, fontWeight:700,
                      color: isDeposit||isSell ? "#16a34a" : isBuy ? "#dc2626" : "#64748b",
                      fontFamily:"'Sora',sans-serif" }}>
                      {isDeposit||isSell ? "+" : isBuy ? "-" : ""}
                      ${typeof txn.amount === "number"
                        ? txn.amount.toLocaleString(undefined,{maximumFractionDigits:2})
                        : txn.amount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div className="toast" style={{
          background: msg.ok ? "#0f172a" : "#dc2626",
          color: "white",
        }}>
          {msg.ok ? "✓ " : "✕ "}{msg.text}
        </div>
      )}
    </>
  );
};

export default Wallet;
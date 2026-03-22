import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [step, setStep]         = useState("form");

  const [loginContact, setLoginContact] = useState("");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob]     = useState("");

  const [otp, setOtp]                   = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [sentVia, setSentVia]           = useState("sending");
  const [errMsg, setErrMsg]             = useState("");
  const [timer, setTimer]               = useState(0);
  const [otpCount, setOtpCount]         = useState(0);
  const [focused, setFocused]           = useState(null);
  const [loading, setLoading]           = useState(false);

  const navigate = useNavigate();

  /* ── EmailJS config ── replace with your values from emailjs.com */
  const EMAILJS_SERVICE_ID  = "service_7eo8n3g";
  const EMAILJS_TEMPLATE_ID = "template_h1yr6mv";
  const EMAILJS_PUBLIC_KEY  = "RJjsxL_MNFrrHk61S";

  /* ── Timer ── */
  useEffect(() => {
    if (timer > 0) {
      const id = setInterval(() => setTimer(p => p - 1), 1000);
      return () => clearInterval(id);
    }
  }, [timer]);

  /* ── Helpers ── */
  const getAge = (d) => {
    const b = new Date(d), t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  };
  const isEmailVal = (v) => /\S+@\S+\.\S+/.test(v);
  const isPhoneVal = (v) => /^\d{10}$/.test(v.replace(/\s+/g, ""));

  /* ── Validate ── */
  const validateLogin = () => {
    const v = loginContact.trim();
    if (!v) { setErrMsg("Enter your email or phone number"); return false; }
    if (!isEmailVal(v) && !isPhoneVal(v)) { setErrMsg("Enter a valid email OR a 10-digit phone number"); return false; }
    setErrMsg(""); return true;
  };
  const validateSignup = () => {
    if (!name.trim())       { setErrMsg("Enter your full name"); return false; }
    if (!isEmailVal(email)) { setErrMsg("Enter a valid email address"); return false; }
    if (!isPhoneVal(phone)) { setErrMsg("Phone number must be exactly 10 digits"); return false; }
    if (!dob)               { setErrMsg("Select your date of birth"); return false; }
    if (getAge(dob) < 18)   { setErrMsg("You must be 18 or older to register."); return false; }
    setErrMsg(""); return true;
  };

  /* ── Check backend (optional — works without server too) ── */

  /* ── Check backend ── */
  const checkBackend = async (emailVal, phoneVal) => {
    try {
      setErrMsg('Checking account…');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_BASE}/api/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal || undefined, phone: phoneVal || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setErrMsg('');
      if (isSignup && data.exists) {
        setErrMsg('Account already exists. Please login instead.');
        return false;
      }
      if (!isSignup && !data.exists) {
        setErrMsg('No account found. Please sign up first.');
        return false;
      }
      return true;
    } catch (err) {
      setErrMsg('');
      if (err.name === 'AbortError') {
        setErrMsg('Server is waking up, please try again in 30 seconds.');
        return false;
      }
      return true;
    }
  };

  /* ── Send OTP ── EmailJS handles email, SMS via backend ── */
  const sendOtp = async () => {
    if (otpCount >= 20) { setErrMsg("Maximum OTP limit reached"); return; }
    setLoading(true); setErrMsg("");

    const isPhone      = !isSignup && isPhoneVal(loginContact.trim());
    const contactEmail = isSignup ? email       : (isEmailVal(loginContact.trim()) ? loginContact.trim() : null);
    const contactPhone = isSignup ? phone       : (isPhone ? loginContact.trim() : null);

    // Optional backend check
    const ok = await checkBackend(contactEmail, contactPhone);
    if (!ok) { setLoading(false); return; }

    // Generate OTP locally
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);

    // Show OTP screen immediately
    setStep("otp");
    setTimer(30);
    setOtp(["", "", "", "", "", ""]);
    setOtpCount(p => p + 1);
    setSentVia("sending");
    setLoading(false);

    if (isPhone) {
      setSentVia("phone");
      return;
    }

    // Send email via EmailJS (non-blocking)
    if (window.emailjs) {
      window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: contactEmail, otp: newOtp, app_name: "CryptoAI" },
        EMAILJS_PUBLIC_KEY
      ).then(() => setSentVia("email"))
       .catch(() => setSentVia("failed"));
    } else {
      setSentVia("failed");
    }
  };

  const handleLogin  = () => { if (!validateLogin())  return; sendOtp(); };
  const handleSignup = () => { if (!validateSignup()) return; sendOtp(); };

  /* ── Verify OTP ── */
  const verifyOtp = async () => {
    const entered = otp.join("");
    if (entered.length !== 6) { setErrMsg("Enter the complete 6-digit OTP"); return; }
    if (entered !== generatedOtp) { setErrMsg("Invalid OTP. Please try again."); return; }

    setLoading(true);

    const contactEmail = isSignup ? email : (isEmailVal(loginContact.trim()) ? loginContact.trim() : null);
    const contactPhone = isSignup ? phone : (isPhoneVal(loginContact.trim()) ? loginContact.trim() : null);

    const user = isSignup
      ? { name, email, phone, dob }
      : { email: contactEmail, phone: contactPhone, contact: loginContact.trim() };

    localStorage.setItem("user", JSON.stringify(user));

    // Save to MongoDB if backend is running (fire and forget)
    try {
      await fetch('/api/auth/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
    } catch { /* backend offline — ignore */ }

    setLoading(false);
    navigate("/dashboard");
  };

  /* ── OTP keyboard nav ── */
  const handleOtpKey = (e, idx) => {
    if (e.key === "Backspace") {
      const next = [...otp]; next[idx] = ""; setOtp(next);
      if (idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = [...otp]; next[idx] = e.key; setOtp(next);
      if (idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
    }
  };

  /* ── Input style ── */
  const inp = (field) => ({
    width: "100%", padding: "12px 14px", borderRadius: "11px",
    border: focused === field ? "1.5px solid rgba(99,102,241,0.55)" : "1.5px solid rgba(200,212,230,0.8)",
    background: "rgba(255,255,255,0.6)", color: "#1e293b", fontSize: "14px",
    outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif",
    backdropFilter: "blur(4px)", transition: "border 0.2s, box-shadow 0.2s",
    boxShadow: focused === field ? "0 0 0 3px rgba(99,102,241,0.09)" : "none",
  });

  const displayContact = isSignup ? email : loginContact;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Sora:wght@500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}body{font-family:'DM Sans',sans-serif;}
        .lp{min-height:100vh;display:flex;align-items:center;justify-content:center;
          background:linear-gradient(170deg,#b8d8f5 0%,#cce4f7 18%,#ddf0fb 40%,#edf7fd 65%,#f6fbff 85%,#fff 100%);
          position:relative;overflow:hidden;}
        .blob{position:absolute;border-radius:50%;pointer-events:none;}
        .b1{width:520px;height:380px;background:radial-gradient(ellipse,rgba(176,214,255,.5),transparent 68%);top:-100px;left:-140px;}
        .b2{width:420px;height:320px;background:radial-gradient(ellipse,rgba(190,210,255,.4),transparent 68%);bottom:-80px;right:-100px;}
        .b3{width:280px;height:220px;background:radial-gradient(ellipse,rgba(160,230,230,.28),transparent 68%);top:38%;left:4%;}
        .b4{width:220px;height:200px;background:radial-gradient(ellipse,rgba(200,215,255,.32),transparent 68%);top:12%;right:6%;}
        .card{position:relative;z-index:10;width:400px;background:rgba(255,255,255,0.68);
          backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);
          border:1px solid rgba(255,255,255,0.92);border-radius:22px;padding:40px 36px 34px;
          box-shadow:0 2px 4px rgba(0,0,0,.03),0 8px 24px rgba(99,102,241,.07),
            0 28px 56px rgba(100,140,210,.11),inset 0 1px 0 rgba(255,255,255,.96);
          animation:rise .45s cubic-bezier(.22,1,.36,1) both;}
        @media(max-width:440px){.card{width:92vw;padding:32px 20px 28px;}}
        @keyframes rise{from{opacity:0;transform:translateY(20px) scale(.98);}to{opacity:1;transform:none;}}
        .brand{text-align:center;margin-bottom:18px;font-family:'Sora',sans-serif;font-size:26px;
          font-weight:700;letter-spacing:-.5px;
          background:linear-gradient(135deg,#3b6ef8 0%,#6366f1 50%,#818cf8 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .card-title{font-family:'Sora',sans-serif;font-size:20px;font-weight:600;color:#0f172a;
          text-align:center;margin-bottom:6px;letter-spacing:-.3px;}
        .card-sub{font-size:13px;color:#64748b;text-align:center;line-height:1.55;margin-bottom:24px;}
        .field{margin-bottom:13px;}
        .field-label{display:block;font-size:11.5px;font-weight:500;color:#64748b;margin-bottom:5px;letter-spacing:.2px;}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .err-msg{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);
          border-radius:9px;padding:10px 14px;font-size:12.5px;color:#dc2626;
          margin-bottom:12px;text-align:center;line-height:1.4;}
        .btn-main{width:100%;padding:13px;background:#0f172a;color:white;border:none;
          border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;
          font-family:'DM Sans',sans-serif;margin-top:6px;
          box-shadow:0 4px 16px rgba(15,23,42,.18);
          transition:background .18s,transform .12s,box-shadow .18s;
          display:flex;align-items:center;justify-content:center;gap:8px;}
        .btn-main:hover:not(:disabled){background:#1e293b;transform:translateY(-1px);box-shadow:0 6px 22px rgba(15,23,42,.24);}
        .btn-main:disabled{opacity:.65;cursor:not-allowed;}
        .switch-text{text-align:center;margin-top:18px;font-size:13px;color:#64748b;}
        .switch-link{color:#4f46e5;font-weight:600;cursor:pointer;}
        .switch-link:hover{text-decoration:underline;}
        .otp-row{display:flex;gap:9px;justify-content:center;margin-bottom:20px;}
        .otp-digit{width:46px;height:54px;border-radius:11px;
          border:1.5px solid rgba(200,212,230,.75);background:rgba(255,255,255,.65);
          text-align:center;font-size:22px;font-weight:600;color:#0f172a;
          outline:none;font-family:'Sora',sans-serif;
          transition:border .2s,box-shadow .2s;backdrop-filter:blur(4px);}
        .otp-digit:focus{border-color:rgba(99,102,241,.6);box-shadow:0 0 0 3px rgba(99,102,241,.1);}
        .otp-info{background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.13);
          border-radius:10px;padding:11px 14px;font-size:12.5px;color:#4338ca;
          text-align:center;margin-bottom:22px;line-height:1.5;}
        .otp-info strong{font-family:'Sora',sans-serif;font-weight:600;display:block;margin-top:2px;}
        .otp-status{text-align:center;font-size:12px;margin-top:10px;min-height:20px;}
        .timer-row{text-align:center;font-size:13px;color:#64748b;margin-top:14px;}
        .resend-link{color:#4f46e5;font-weight:600;cursor:pointer;}
        .resend-link:hover{text-decoration:underline;}
        .back-btn{display:flex;align-items:center;justify-content:center;gap:5px;
          font-size:13px;color:#94a3b8;cursor:pointer;margin-top:16px;transition:color .15s;}
        .back-btn:hover{color:#0f172a;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);
          border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
        .spinner-sm{width:10px;height:10px;border-color:rgba(99,102,241,.3);border-top-color:#6366f1;margin-right:5px;}
      `}</style>

      <div className="lp">
        <div className="b1 blob"/><div className="b2 blob"/>
        <div className="b3 blob"/><div className="b4 blob"/>

        <div className="card">

          {/* ── FORM ── */}
          {step === "form" && (
            <>
              <div className="brand">CryptoAI</div>
              <h1 className="card-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p className="card-sub">
                {isSignup ? "Sign up free and start trading smarter with AI."
                          : "Enter your email or 10-digit phone number to get OTP."}
              </p>

              {errMsg && <div className="err-msg">{errMsg}</div>}

              {!isSignup && (
                <>
                  <div className="field">
                    <label className="field-label">Email or phone number</label>
                    <input placeholder="you@example.com or 10-digit number"
                      value={loginContact} onChange={e => setLoginContact(e.target.value)}
                      onFocus={() => setFocused("lc")} onBlur={() => setFocused(null)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp("lc")}/>
                  </div>
                  <button className="btn-main" onClick={handleLogin} disabled={loading}>
                    {loading ? <span className="spinner"/> : 'Get OTP'}
                  </button>
                </>
              )}

              {isSignup && (
                <>
                  <div className="field">
                    <label className="field-label">Full name</label>
                    <input placeholder="Your full name" value={name}
                      onChange={e => setName(e.target.value)}
                      onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} style={inp("name")}/>
                  </div>
                  <div className="two-col">
                    <div className="field">
                      <label className="field-label">Email address</label>
                      <input type="email" placeholder="you@example.com" value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={inp("email")}/>
                    </div>
                    <div className="field">
                      <label className="field-label">Phone number</label>
                      <input type="tel" placeholder="10-digit number" value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                        onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} style={inp("phone")}/>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Date of birth</label>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                      onFocus={() => setFocused("dob")} onBlur={() => setFocused(null)} style={inp("dob")}/>
                  </div>
                  <button className="btn-main" onClick={handleSignup} disabled={loading}>
                    {loading ? <span className="spinner"/> : 'Sign up & get OTP'}
                  </button>
                </>
              )}

              <p className="switch-text">
                {isSignup ? "Already have an account? " : "New to CryptoAI? "}
                <span className="switch-link" onClick={() => { setIsSignup(!isSignup); setStep("form"); setErrMsg(""); }}>
                  {isSignup ? "Sign in" : "Create an account"}
                </span>
              </p>
            </>
          )}

          {/* ── OTP ── */}
          {step === "otp" && (
            <>
              <div className="brand">CryptoAI</div>
              <h1 className="card-title">Enter OTP</h1>
              <p className="card-sub">We sent a 6-digit code to</p>

              <div className="otp-info">
                <strong>{displayContact}</strong>
              </div>

              {errMsg && <div className="err-msg">{errMsg}</div>}

              <div className="otp-row">
                {otp.map((digit, i) => (
                  <input key={i} id={`otp-${i}`} className="otp-digit"
                    maxLength={1} value={digit}
                    inputMode="numeric" pattern="[0-9]*"
                    autoComplete="one-time-code"
                    onChange={e => {
                      const raw = e.target.value;
                      const val = raw.replace(/[^0-9]/g, '').slice(-1);
                      if (!val) return;
                      const next = [...otp]; next[i] = val; setOtp(next);
                      if (i < 5) document.getElementById(`otp-${i+1}`)?.focus();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        const next = [...otp]; next[i] = ''; setOtp(next);
                        if (i > 0) document.getElementById(`otp-${i-1}`)?.focus();
                      }
                    }}
                    autoFocus={i === 0}/>
                ))}
              </div>

              <button className="btn-main" onClick={verifyOtp} disabled={loading}>
                {loading ? <span className="spinner"/> : 'Verify OTP'}
              </button>

              {/* Status messages — no OTP shown on screen */}
              <div className="otp-status">
                {sentVia === 'sending' && (
                  <span style={{color:'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <span className="spinner spinner-sm"/>Sending OTP…
                  </span>
                )}
                {sentVia === 'email'  && <span style={{color:'#16a34a'}}>✅ OTP sent to your email inbox</span>}
                {sentVia === 'phone'  && <span style={{color:'#16a34a'}}>✅ OTP sent via SMS</span>}
                {sentVia === 'failed' && (
                  <span style={{color:'#dc2626'}}>
                    ✕ Could not send OTP.{' '}
                    <span className="resend-link" onClick={isSignup ? handleSignup : handleLogin}>Try again</span>
                  </span>
                )}
              </div>

              <div className="timer-row">
                {timer > 0
                  ? <>Resend OTP in <strong>{timer}s</strong></>
                  : <>Didn't receive it?{' '}
                      <span className="resend-link" onClick={isSignup ? handleSignup : handleLogin}>
                        Resend OTP
                      </span>
                    </>
                }
              </div>

              <div className="back-btn" onClick={() => { setStep("form"); setSentVia("sending"); setErrMsg(""); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back to {isSignup ? "sign up" : "login"}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
};

export default Login;
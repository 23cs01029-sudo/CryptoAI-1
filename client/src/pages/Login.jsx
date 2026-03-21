import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [step, setStep]         = useState("form");

  // login — one field only
  const [loginContact, setLoginContact] = useState("");

  // signup — separate fields
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob]     = useState("");

  const [otp, setOtp]                   = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [timer, setTimer]               = useState(0);
  const [otpCount, setOtpCount]         = useState(0);
  const [focused, setFocused]           = useState(null);

  const navigate = useNavigate();

  // ── Timer ──────────────────────────────────────────
  useEffect(() => {
    if (timer > 0) {
      const id = setInterval(() => setTimer((p) => p - 1), 1000);
      return () => clearInterval(id);
    }
  }, [timer]);

  // ── Helpers ────────────────────────────────────────
  const getAge = (dob) => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
  const isPhone = (v) => /^\d{10}$/.test(v.replace(/\s+/g, ""));

  // ── Validate login (email OR 10-digit phone) ───────
  const validateLogin = () => {
    const v = loginContact.trim();
    if (!v) { alert("Enter your email or phone number"); return false; }
    if (!isEmail(v) && !isPhone(v)) {
      alert("Enter a valid email OR a 10-digit phone number");
      return false;
    }
    return true;
  };

  // ── Validate signup (all fields + both email & phone)
  const validateSignup = () => {
    if (!name.trim())     { alert("Enter your full name"); return false; }
    if (!isEmail(email))  { alert("Enter a valid email address"); return false; }
    if (!isPhone(phone))  { alert("Phone number must be exactly 10 digits"); return false; }
    if (!dob)             { alert("Select your date of birth"); return false; }
    if (getAge(dob) < 18) { alert("You must be 18 or older to register."); return false; }
    return true;
  };

  // ── Send OTP ───────────────────────────────────────
  const sendOtp = () => {
    if (otpCount >= 20) { alert("Maximum OTP limit reached"); return; }
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    console.log("🔐 OTP:", newOtp);
    setStep("otp");
    setTimer(30);
    setOtp(["", "", "", "", "", ""]);
    setOtpCount((p) => p + 1);
  };

  const handleLogin = () => {
    if (!validateLogin()) return;
    sendOtp();
  };

  const handleSignup = () => {
    if (!validateSignup()) return;
    sendOtp();
  };

  // ── Verify OTP ─────────────────────────────────────
  const verifyOtp = () => {
    const entered = otp.join("");
    if (entered.length !== 6) { alert("Enter the complete 6-digit OTP"); return; }
    if (entered !== generatedOtp) { alert("Invalid OTP. Try again."); return; }
    const user = isSignup
      ? { name, email, phone, dob }
      : { contact: loginContact };
    localStorage.setItem("user", JSON.stringify(user));
    navigate("/dashboard");
  };

  // ── OTP keyboard nav ───────────────────────────────
  const handleOtpKey = (e, idx) => {
    if (e.key === "Backspace") {
      const next = [...otp]; next[idx] = ""; setOtp(next);
      if (idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = [...otp]; next[idx] = e.key; setOtp(next);
      if (idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
    }
  };

  // ── Input style ────────────────────────────────────
  const inp = (field) => ({
    width: "100%",
    padding: "12px 14px",
    borderRadius: "11px",
    border: focused === field
      ? "1.5px solid rgba(99,102,241,0.55)"
      : "1.5px solid rgba(200,212,230,0.8)",
    background: "rgba(255,255,255,0.6)",
    color: "#1e293b",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
    backdropFilter: "blur(4px)",
    transition: "border 0.2s, box-shadow 0.2s",
    boxShadow: focused === field ? "0 0 0 3px rgba(99,102,241,0.09)" : "none",
  });

  const displayContact = isSignup ? email : loginContact;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Sora:wght@500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DM Sans',sans-serif; }

        .lp {
          min-height:100vh; display:flex; align-items:center; justify-content:center;
          background:linear-gradient(170deg,#b8d8f5 0%,#cce4f7 18%,#ddf0fb 40%,#edf7fd 65%,#f6fbff 85%,#fff 100%);
          position:relative; overflow:hidden;
        }
        .blob{position:absolute;border-radius:50%;pointer-events:none;}
        .b1{width:520px;height:380px;background:radial-gradient(ellipse,rgba(176,214,255,.5),transparent 68%);top:-100px;left:-140px;}
        .b2{width:420px;height:320px;background:radial-gradient(ellipse,rgba(190,210,255,.4),transparent 68%);bottom:-80px;right:-100px;}
        .b3{width:280px;height:220px;background:radial-gradient(ellipse,rgba(160,230,230,.28),transparent 68%);top:38%;left:4%;}
        .b4{width:220px;height:200px;background:radial-gradient(ellipse,rgba(200,215,255,.32),transparent 68%);top:12%;right:6%;}

        .card {
          position:relative; z-index:10; width:400px;
          background:rgba(255,255,255,0.68);
          backdrop-filter:blur(28px) saturate(1.5);
          -webkit-backdrop-filter:blur(28px) saturate(1.5);
          border:1px solid rgba(255,255,255,0.92); border-radius:22px;
          padding:40px 36px 34px;
          box-shadow:0 2px 4px rgba(0,0,0,.03),0 8px 24px rgba(99,102,241,.07),
                     0 28px 56px rgba(100,140,210,.11),inset 0 1px 0 rgba(255,255,255,.96);
          animation:rise .45s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes rise{from{opacity:0;transform:translateY(20px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}

        .brand{
          text-align:center; margin-bottom:18px;
          font-family:'Sora',sans-serif; font-size:26px; font-weight:700; letter-spacing:-.5px;
          background:linear-gradient(135deg,#3b6ef8 0%,#6366f1 50%,#818cf8 100%);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .card-title{font-family:'Sora',sans-serif;font-size:20px;font-weight:600;color:#0f172a;text-align:center;margin-bottom:6px;letter-spacing:-.3px;}
        .card-sub{font-size:13px;color:#64748b;text-align:center;line-height:1.55;margin-bottom:24px;}

        .field{margin-bottom:13px;}
        .field-label{display:block;font-size:11.5px;font-weight:500;color:#64748b;margin-bottom:5px;letter-spacing:.2px;}

        /* email + phone side by side on signup */
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}

        .btn-main{
          width:100%; padding:13px; background:#0f172a; color:white;
          border:none; border-radius:12px; font-size:14px; font-weight:600;
          cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:6px;
          box-shadow:0 4px 16px rgba(15,23,42,.18);
          transition:background .18s,transform .12s,box-shadow .18s;
        }
        .btn-main:hover{background:#1e293b;transform:translateY(-1px);box-shadow:0 6px 22px rgba(15,23,42,.24);}
        .btn-main:active{transform:translateY(0);}

        .switch-text{text-align:center;margin-top:18px;font-size:13px;color:#64748b;}
        .switch-link{color:#4f46e5;font-weight:600;cursor:pointer;}
        .switch-link:hover{text-decoration:underline;}

        .otp-row{display:flex;gap:9px;justify-content:center;margin-bottom:20px;}
        .otp-digit{
          width:46px;height:54px;border-radius:11px;
          border:1.5px solid rgba(200,212,230,.75);
          background:rgba(255,255,255,.65);
          text-align:center;font-size:22px;font-weight:600;color:#0f172a;
          outline:none;font-family:'Sora',sans-serif;
          transition:border .2s,box-shadow .2s;backdrop-filter:blur(4px);
        }
        .otp-digit:focus{border-color:rgba(99,102,241,.6);box-shadow:0 0 0 3px rgba(99,102,241,.1);}

        .otp-info{
          background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.13);
          border-radius:10px;padding:11px 14px;font-size:12.5px;color:#4338ca;
          text-align:center;margin-bottom:22px;line-height:1.5;
        }
        .otp-info strong{font-family:'Sora',sans-serif;font-weight:600;display:block;margin-top:2px;}

        .timer-row{text-align:center;font-size:13px;color:#64748b;margin-top:14px;}
        .resend-link{color:#4f46e5;font-weight:600;cursor:pointer;}

        .hint{font-size:11px;color:#94a3b8;text-align:center;margin-top:8px;font-style:italic;}

        .back-btn{
          display:flex;align-items:center;justify-content:center;gap:5px;
          font-size:13px;color:#94a3b8;cursor:pointer;margin-top:16px;
          transition:color .15s;
        }
        .back-btn:hover{color:#0f172a;}
      `}</style>

      <div className="lp">
        <div className="b1 blob"/><div className="b2 blob"/>
        <div className="b3 blob"/><div className="b4 blob"/>

        <div className="card">

          {/* ── FORM ── */}
          {step === "form" && (
            <>
              <div className="brand">CryptoAI</div>

              <h1 className="card-title">
                {isSignup ? "Create your account" : "Welcome back"}
              </h1>
              <p className="card-sub">
                {isSignup
                  ? "Sign up free and start trading smarter with AI."
                  : "Enter your email or 10-digit phone number to get OTP."}
              </p>

              {/* ── LOGIN: single field ── */}
              {!isSignup && (
                <>
                  <div className="field">
                    <label className="field-label">Email or phone number</label>
                    <input
                      placeholder="you@example.com or 10-digit number"
                      value={loginContact}
                      onChange={(e) => setLoginContact(e.target.value)}
                      onFocus={() => setFocused("lc")}
                      onBlur={() => setFocused(null)}
                      style={inp("lc")}
                    />
                  </div>
                  <button className="btn-main" onClick={handleLogin}>
                    Get OTP
                  </button>
                </>
              )}

              {/* ── SIGNUP: all fields including BOTH email + phone ── */}
              {isSignup && (
                <>
                  <div className="field">
                    <label className="field-label">Full name</label>
                    <input
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                      style={inp("name")}
                    />
                  </div>

                  {/* Email + Phone side by side */}
                  <div className="two-col">
                    <div className="field">
                      <label className="field-label">Email address</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocused("email")}
                        onBlur={() => setFocused(null)}
                        style={inp("email")}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Phone number</label>
                      <input
                        type="tel"
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) =>
                          setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        onFocus={() => setFocused("phone")}
                        onBlur={() => setFocused(null)}
                        style={inp("phone")}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Date of birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      onFocus={() => setFocused("dob")}
                      onBlur={() => setFocused(null)}
                      style={inp("dob")}
                    />
                  </div>

                  <button className="btn-main" onClick={handleSignup}>
                    Sign up & get OTP
                  </button>
                </>
              )}

              <p className="switch-text">
                {isSignup ? "Already have an account? " : "New to CryptoAI? "}
                <span
                  className="switch-link"
                  onClick={() => { setIsSignup(!isSignup); setStep("form"); }}
                >
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

              <div className="otp-row">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    className="otp-digit"
                    maxLength={1}
                    value={digit}
                    onChange={() => {}}
                    onKeyDown={(e) => handleOtpKey(e, i)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <button className="btn-main" onClick={verifyOtp}>
                Verify OTP
              </button>

              <p className="hint">
                OTP is in browser console — press F12 → Console tab
              </p>

              <div className="timer-row">
                {timer > 0 ? (
                  <>Resend OTP in <strong>{timer}s</strong></>
                ) : (
                  <>Didn't receive it?{" "}
                    <span
                      className="resend-link"
                      onClick={isSignup ? handleSignup : handleLogin}
                    >
                      Resend OTP
                    </span>
                  </>
                )}
              </div>

              <div className="back-btn" onClick={() => setStep("form")}>
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
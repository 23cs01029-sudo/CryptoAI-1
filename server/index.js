require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://crypto-ai-1.vercel.app',
    'https://cryptoai-server.onrender.com',
  ],
  credentials: true,
}));
app.use(express.json());

/* ─── MongoDB ─────────────────────────────────────────────────── */
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoai')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

/* ─── Schemas ─────────────────────────────────────────────────── */
const UserSchema = new mongoose.Schema({
  email:     { type: String, sparse: true },
  phone:     { type: String, sparse: true },
  otp:       String,
  otpExpiry: Date,
  createdAt: { type: Date, default: Date.now },
});

const NotifSchema = new mongoose.Schema({
  userEmail: String,
  type:      String,   // trade | signal | price | system
  title:     String,
  body:      String,
  meta:      Object,
  read:      { type: Boolean, default: false },
  time:      { type: Date, default: Date.now },
});

const TradeSchema = new mongoose.Schema({
  userEmail: String,
  type:      String,   // BUY | SELL | CLOSE
  coin:      String,
  symbol:    String,
  qty:       Number,
  price:     Number,
  pnl:       Number,
  time:      { type: Date, default: Date.now },
});

const WatchlistSchema = new mongoose.Schema({
  userEmail: { type: String, unique: true },
  symbols:   [String],
  updatedAt: { type: Date, default: Date.now },
});

const ChatSessionSchema = new mongoose.Schema({
  userEmail: { type: String, unique: true },
  sessions:  [mongoose.Schema.Types.Mixed],
  updatedAt: { type: Date, default: Date.now },
});

const WalletSchema = new mongoose.Schema({
  userEmail:  { type: String, unique: true },
  balances:   { type: Object, default: { USDT: 10000 } }, // { USDT: 9500, BTC: 0.001, ... }
  updatedAt:  { type: Date, default: Date.now },
});

const PositionSchema = new mongoose.Schema({
  userEmail:  String,
  posId:      Number,   // local id for upsert
  coin:       String,
  symbol:     String,
  type:       String,   // BUY | SELL
  entry:      Number,
  qty:        Number,
  tp:         Number,
  sl:         Number,
  status:     { type: String, default: 'OPEN' },
  pnl:        Number,
  current:    Number,
  closePrice: Number,
  closePnl:   Number,
  closeTime:  String,
  color:      String,
  time:       String,
  updatedAt:  { type: Date, default: Date.now },
});

const TxnSchema = new mongoose.Schema({
  userEmail: String,
  txnId:     Number,
  type:      String,   // BUY | SELL | CLOSE | DEPOSIT
  amount:    Number,
  note:      String,
  time:      String,
  createdAt: { type: Date, default: Date.now },
});

const User        = mongoose.model('User',        UserSchema);
const Notif       = mongoose.model('Notif',       NotifSchema);
const Trade       = mongoose.model('Trade',       TradeSchema);
const Watchlist   = mongoose.model('Watchlist',   WatchlistSchema);
const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);
const Wallet      = mongoose.model('Wallet',      WalletSchema);
const Position    = mongoose.model('Position',    PositionSchema);
const Txn         = mongoose.model('Txn',         TxnSchema);

/* ─── Email ───────────────────────────────────────────────────── */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // fixes certificate issues on some networks
  },
});

const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[email] EMAIL_USER or EMAIL_PASS not set — skipping email');
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
    console.log(`[email] ✅ sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('[email] ❌ error:', err.message);
  }
};

/* ─── Twilio SMS (optional) ───────────────────────────────────── */
// Only initializes if TWILIO keys are set in .env
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  console.log('✅ Twilio SMS enabled');
}

const sendSMS = async (to, message) => {
  if (!twilioClient) {
    console.warn('[sms] Twilio not configured — OTP shown in console only');
    return false;
  }
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: `+91${to}`, // India +91 prefix — change if needed
    });
    console.log(`[sms] ✅ sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[sms] ❌ error:', err.message);
    return false;
  }
};

/* ─── Auth Routes ─────────────────────────────────────────────── */

// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
  const { email, phone } = req.body;
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });

  const otp       = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const identifier = email || phone;

  await User.findOneAndUpdate(
    { $or: [ email ? { email } : {}, phone ? { phone } : {} ] },
    { ...(email && { email }), ...(phone && { phone }), otp, otpExpiry },
    { upsert: true, new: true }
  );

  if (email) {
    await sendEmail(email, 'Your CryptoAI OTP', `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;
        border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#6366f1;margin:0 0 16px;">CryptoAI</h2>
        <p style="color:#475569;margin:0 0 12px;">Your one-time password is:</p>
        <div style="font-size:36px;font-weight:700;color:#0f172a;letter-spacing:8px;
          text-align:center;padding:16px;background:#f8fafc;border-radius:8px;margin:16px 0;">
          ${otp}
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          Expires in 10 minutes. Do not share this code.
        </p>
      </div>
    `);
  }

  if (phone) {
    const sent = await sendSMS(phone, `Your CryptoAI OTP is: ${otp}. Valid for 10 minutes.`);
    if (!sent) console.log(`[auth] Phone OTP for ${phone}: ${otp}`);
  }

  console.log(`[auth] OTP for ${identifier}: ${otp}`);
  res.json({ success: true, message: `OTP sent via ${email ? 'email' : 'SMS'}` });
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, phone, otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP required' });
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });

  const user = await User.findOne(email ? { email } : { phone });
  if (!user)                        return res.status(404).json({ error: 'User not found' });
  if (user.otp !== otp)             return res.status(401).json({ error: 'Invalid OTP' });
  if (new Date() > user.otpExpiry)  return res.status(401).json({ error: 'OTP expired' });

  await User.updateOne(email ? { email } : { phone }, { $unset: { otp: 1, otpExpiry: 1 } });
  res.json({ success: true, user: { email, phone } });
});

// POST /api/auth/check-user — check if user exists
app.post('/api/auth/check-user', async (req, res) => {
  const { email, phone } = req.body;
  const query = email ? { email } : { phone };
  try {
    const user = await User.findOne(query);
    res.json({ exists: !!user });
  } catch(err) { res.status(500).json({ exists: false }); }
});

// POST /api/auth/save-user — called after OTP verified on frontend
app.post('/api/auth/save-user', async (req, res) => {
  const { name, email, phone, dob } = req.body;
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });
  try {
    await User.findOneAndUpdate(
      email ? { email } : { phone },
      { ...(name&&{name}), ...(email&&{email}), ...(phone&&{phone}), ...(dob&&{dob}) },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─── Notification Routes ─────────────────────────────────────── */

// POST /api/notifications  — save + email alert
app.post('/api/notifications', async (req, res) => {
  const { userEmail, type, title, body, meta } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });

  const notif = await Notif.create({ userEmail, type, title, body, meta });

  // Send email for trade and signal types
  if (type === 'trade' || type === 'signal') {
    const color = type === 'signal' ? '#6366f1' : '#22c55e';
    await sendEmail(userEmail, `CryptoAI: ${title}`, `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;
        border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:${color};margin:0 0 12px;">CryptoAI Alert</h2>
        <h3 style="color:#0f172a;margin:0 0 8px;">${title}</h3>
        <p style="color:#475569;margin:0 0 16px;">${body}</p>
        <a href="https://crypto-ai-1.vercel.app"
          style="background:${color};color:white;padding:10px 20px;
            border-radius:8px;text-decoration:none;font-weight:600;">
          Open CryptoAI
        </a>
      </div>
    `);
  }

  res.json({ success: true, notif });
});

// GET /api/notifications/:email
app.get('/api/notifications/:email', async (req, res) => {
  const notifs = await Notif
    .find({ userEmail: req.params.email })
    .sort({ time: -1 })
    .limit(100);
  res.json(notifs);
});

// PATCH /api/notifications/:id/read
app.patch('/api/notifications/:id/read', async (req, res) => {
  await Notif.updateOne({ _id: req.params.id }, { read: true });
  res.json({ success: true });
});

// DELETE /api/notifications/:email  — clear all
app.delete('/api/notifications/:email', async (req, res) => {
  await Notif.deleteMany({ userEmail: req.params.email });
  res.json({ success: true });
});

// DELETE /api/notifications/item/:id  — delete single notification
app.delete('/api/notifications/item/:id', async (req, res) => {
  try {
    await Notif.deleteOne({ _id: req.params.id });
  } catch { /* id may be a local float id, not mongo _id — ignore */ }
  res.json({ success: true });
});

// POST /api/notifications/sync  — bulk upsert full notifications array (for mark-all-read)
app.post('/api/notifications/sync', async (req, res) => {
  const { userEmail, notifications } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    // Overwrite all notifications for this user
    await Notif.deleteMany({ userEmail });
    if (notifications?.length > 0) {
      await Notif.insertMany(
        notifications.map(n => ({
          userEmail,
          type:  n.type  || 'system',
          title: n.title || '',
          body:  n.body  || '',
          meta:  n.meta  || {},
          read:  n.read  || false,
          time:  n.time  ? new Date(n.time) : new Date(),
        }))
      );
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

/* ─── Trade Routes ────────────────────────────────────────────── */

// POST /api/trades
app.post('/api/trades', async (req, res) => {
  const trade = await Trade.create(req.body);
  res.json({ success: true, trade });
});

// GET /api/trades/:email
app.get('/api/trades/:email', async (req, res) => {
  const trades = await Trade
    .find({ userEmail: req.params.email })
    .sort({ time: -1 });
  res.json(trades);
});

/* ─── Wallet Routes ───────────────────────────────────────────── */

// POST /api/wallet — upsert full wallet balances
app.post('/api/wallet', async (req, res) => {
  const { userEmail, balances } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    await Wallet.findOneAndUpdate(
      { userEmail },
      { userEmail, balances, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/wallet/:email
app.get('/api/wallet/:email', async (req, res) => {
  const w = await Wallet.findOne({ userEmail: req.params.email });
  res.json({ balances: w?.balances || { USDT: 10000 } });
});

/* ─── Positions Routes ────────────────────────────────────────── */

// POST /api/positions — upsert full positions array
app.post('/api/positions', async (req, res) => {
  const { userEmail, positions } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    // Delete all existing positions for user and replace with new array
    await Position.deleteMany({ userEmail });
    if (positions?.length > 0) {
      await Position.insertMany(positions.map(p => ({ ...p, userEmail })));
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/positions/:email
app.get('/api/positions/:email', async (req, res) => {
  const positions = await Position.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
  res.json({ positions: positions.map(p => {
    const obj = p.toObject();
    delete obj._id; delete obj.__v; delete obj.userEmail; delete obj.updatedAt;
    return obj;
  })});
});

/* ─── Transaction Routes ──────────────────────────────────────── */

// POST /api/txns — upsert full txns array
app.post('/api/txns', async (req, res) => {
  const { userEmail, txns } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    await Txn.deleteMany({ userEmail });
    if (txns?.length > 0) {
      await Txn.insertMany(txns.map(t => ({ ...t, userEmail })));
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/txns/:email
app.get('/api/txns/:email', async (req, res) => {
  const txns = await Txn.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
  res.json({ txns: txns.map(t => {
    const obj = t.toObject();
    delete obj._id; delete obj.__v; delete obj.userEmail; delete obj.createdAt;
    return obj;
  })});
});

/* ─── Watchlist Routes ────────────────────────────────────────── */

// POST /api/watchlist — upsert user watchlist
app.post('/api/watchlist', async (req, res) => {
  const { userEmail, symbols } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    await Watchlist.findOneAndUpdate(
      { userEmail },
      { userEmail, symbols: symbols || [], updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/watchlist/:email
app.get('/api/watchlist/:email', async (req, res) => {
  const wl = await Watchlist.findOne({ userEmail: req.params.email });
  res.json({ symbols: wl?.symbols || [] });
});

/* ─── Chat Session Routes ─────────────────────────────────────── */

// POST /api/chat/message — Smart AI response engine (no API key needed)
app.post('/api/chat/message', (req, res) => {
  const { messages, system } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'messages required' });

  const userMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';

  const coins = { btc:'Bitcoin', eth:'Ethereum', bnb:'BNB', sol:'Solana', xrp:'XRP',
    doge:'Dogecoin', ada:'Cardano', avax:'Avalanche', dot:'Polkadot', matic:'Polygon' };
  const detectedCoin = Object.keys(coins).find(k => userMsg.includes(k)) || 'btc';
  const coinName = coins[detectedCoin];
  const symbol = detectedCoin.toUpperCase();

  const posMatch = system?.match(/Open Positions:[\s\S]*?(?=\n[A-Z]|$)/);

  const basePrice = { btc:65000, eth:3200, bnb:580, sol:145, xrp:0.52, doge:0.12, ada:0.45, avax:35, dot:7.2, matic:0.85 };
  const price  = basePrice[detectedCoin] || 100;
  const isBull = Math.random() > 0.4;
  const decimals = ['xrp','doge','ada','matic'].includes(detectedCoin) ? 4 : 2;
  const entry = price.toFixed(decimals);
  const tp    = (price * (isBull ? 1.055 : 0.945)).toFixed(decimals);
  const sl    = (price * (isBull ? 0.972 : 1.028)).toFixed(decimals);
  const conf  = Math.floor(60 + Math.random() * 25);
  const action = isBull ? 'BUY' : 'SELL';

  let reply = '';

  if (userMsg.includes('signal') || userMsg.includes('trade') || userMsg.includes('entry') || userMsg.includes('tp') || userMsg.includes('sl')) {
    const reasoning = isBull
      ? coinName + ' showing bullish momentum with increasing volume. RSI at 52 (neutral-bullish), MACD positive crossover. Price above 20-day MA.'
      : coinName + ' facing selling pressure. RSI at 68 (overbought), MACD histogram declining. Short-term pullback likely.';
    reply = [
      '## AI Trade Signal — ' + symbol + '/USDT',
      '',
      '**Action:** ' + (isBull ? 'BUY' : 'SELL'),
      '**Confidence:** ' + conf + '%',
      '',
      '| Parameter | Value |',
      '|-----------|-------|',
      '| Entry Price | $' + entry + ' |',
      '| Take Profit | $' + tp + ' (' + (isBull ? '+5.5%' : '-5.5%') + ') |',
      '| Stop Loss | $' + sl + ' (' + (isBull ? '-2.8%' : '+2.8%') + ') |',
      '| Risk/Reward | 1:2.0 |',
      '',
      '**Reasoning:** ' + reasoning,
      '',
      '**Agent Verdicts:**',
      '- Quant Agent: ' + action + ' (' + Math.floor(60 + Math.random()*20) + '%)',
      '- Technical Agent: ' + (isBull ? 'BUY' : 'HOLD') + ' (' + Math.floor(55 + Math.random()*20) + '%)',
      '- Risk Agent: HOLD (' + Math.floor(50 + Math.random()*20) + '%)',
      '- Sentiment Agent: ' + action + ' (' + Math.floor(60 + Math.random()*20) + '%)',
      '',
      '> Not financial advice. Always do your own research.',
    ].join('\n');

  } else if (userMsg.includes('portfolio') || userMsg.includes('my position') || userMsg.includes('p&l') || userMsg.includes('balance')) {
    const hasPos = posMatch && posMatch[0].length > 20;
    const posText = hasPos
      ? ['Based on your open positions:', '', '- Monitor positions with tight stop losses', '- Consider partial profits at +5% unrealised PnL', '- Keep each trade under 5-10% of portfolio value'].join('\n')
      : ['No open positions found.', '', '**Getting Started:**', '1. Go to Dashboard and pick a coin', '2. Click AI Signal for an entry recommendation', '3. Set TP/SL before entering', '4. Start with 1-3% of portfolio per trade'].join('\n');
    reply = [
      '## Portfolio Analysis',
      '',
      posText,
      '',
      '**General Tips:**',
      '- Never risk more than 2% per trade',
      '- Always set a Stop Loss',
      '- Review win rate in the Analytics page',
    ].join('\n');

  } else if (userMsg.includes('rsi') || userMsg.includes('macd') || userMsg.includes('indicator') || userMsg.includes('technical')) {
    reply = [
      '## Technical Indicators Guide',
      '',
      '**RSI (Relative Strength Index)**',
      '- Below 30: Oversold — potential BUY',
      '- Above 70: Overbought — potential SELL',
      '',
      '**MACD**',
      '- MACD crosses above signal line: Bullish',
      '- MACD crosses below signal line: Bearish',
      '',
      '**Moving Averages**',
      '- Price above 20-day MA: Short-term bullish',
      '- Golden Cross (50MA > 200MA): Strong long-term bullish',
      '',
      'Our Technical Agent uses RSI, MACD and MAs alongside the other 3 agents before the Judge gives the final verdict.',
    ].join('\n');

  } else if (userMsg.includes('risk') || userMsg.includes('manage') || userMsg.includes('strategy') || userMsg.includes('safe')) {
    reply = [
      '## Risk Management Strategy',
      '',
      '**The Golden Rules:**',
      '1. 2% Rule — Never risk more than 2% per trade',
      '2. Always set a Stop Loss before entering',
      '3. Risk/Reward minimum 1:2',
      '4. Do not chase pumps — buy on dips',
      '',
      '**Position Sizing:**',
      'Position Size = (Portfolio x Risk%) / (Entry - Stop Loss)',
      'Example: ($10,000 x 2%) / $200 SL = 1 unit',
      '',
      '**Tips:**',
      '- Avoid leverage until 6+ months experience',
      '- Keep 20-30% in USDT as dry powder',
      '- Crypto runs 24/7 — set alerts, do not watch screens all day',
    ].join('\n');

  } else if (userMsg.includes('agent') || userMsg.includes('how does') || userMsg.includes('how it work')) {
    reply = [
      '## The 4-Agent AI System',
      '',
      '**1. Quant Agent**',
      'Analyses momentum, volume trends, price position within recent high/low range.',
      '',
      '**2. Technical Agent**',
      'Studies RSI, MACD, moving averages, support and resistance levels.',
      '',
      '**3. Risk Agent**',
      'Evaluates risk/reward ratio, drawdown risk and portfolio exposure.',
      '',
      '**4. Sentiment Agent**',
      'Reads market mood from 24h price change and volume patterns.',
      '',
      '**Judge Agent**',
      'Synthesises all 4 verdicts and outputs: Action, Entry, Take Profit, Stop Loss, Confidence %.',
    ].join('\n');

  } else if (userMsg.includes('defi') || userMsg.includes('cefi') || userMsg.includes('what is')) {
    reply = [
      '## DeFi vs CeFi',
      '',
      '**CeFi (Centralized Finance)**',
      '- Examples: Binance, Coinbase',
      '- Exchange holds your keys',
      '- Easier UX, fiat on-ramp',
      '- Risk: hacks, regulation',
      '',
      '**DeFi (Decentralized Finance)**',
      '- Examples: Uniswap, Aave',
      '- You control your keys',
      '- Yield farming, permissionless',
      '- Risk: smart contract bugs, gas fees',
      '',
      'Best approach: CeFi for active trading, DeFi for earning yield on idle assets.',
    ].join('\n');

  } else if (userMsg.includes('best') || userMsg.includes('potential') || userMsg.includes('which coin') || userMsg.includes('recommend')) {
    const picks = ['SOL','ETH','AVAX'].sort(() => Math.random() - 0.5);
    reply = [
      '## Top Coin Picks Right Now',
      '',
      '1. ' + picks[0] + '/USDT — Strong volume uptick, RSI healthy at 48-52. Good entry zone.',
      '2. ' + picks[1] + '/USDT — Consolidating near key support. High probability bounce.',
      '3. ' + picks[2] + '/USDT — Breaking out of 2-week range with above-average volume.',
      '',
      'Use the coin picker to get a detailed signal for any specific coin!',
    ].join('\n');

  } else {
    reply = [
      '## CryptoAI Assistant',
      '',
      'I can help with:',
      '- Type a coin name for a trade signal (e.g. "BTC signal")',
      '- "Analyze my portfolio" for personalised advice',
      '- "Explain RSI" or "What is MACD" for education',
      '- "Risk management tips" for trading strategies',
      '- "How do agents work" to learn about the AI system',
      '',
      'Or use the quick prompts below to get started!',
    ].join('\n');
  }

  res.json({ reply });
});



// POST /api/chat/sessions — upsert all sessions for a user
app.post('/api/chat/sessions', async (req, res) => {
  const { userEmail, sessions } = req.body;
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });
  try {
    await ChatSession.findOneAndUpdate(
      { userEmail },
      { userEmail, sessions: sessions || [], updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/chat/sessions/:email — load sessions for a user
app.get('/api/chat/sessions/:email', async (req, res) => {
  try {
    const doc = await ChatSession.findOne({ userEmail: req.params.email });
    res.json({ sessions: doc?.sessions || [] });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

/* ─── AI Signal proxy (mock — no API key needed) ──────────────── */
// Returns a mock signal so AI button always works without any API key
app.post('/api/ai-signal', (req, res) => {
  const messages = req.body.messages || [];
  const prompt   = messages[0]?.content || '';

  // Extract price and 24h change from the prompt
  const priceMatch  = prompt.match(/Price: \$([\d.]+)/);
  const changeMatch = prompt.match(/24h Change: ([+-]?[\d.]+)%/);
  const coinMatch   = prompt.match(/analyzing (\w+)\/USDT/);

  const price  = parseFloat(priceMatch?.[1]  || '100');
  const change = parseFloat(changeMatch?.[1] || '0');
  const coin   = coinMatch?.[1] || 'BTC';
  const isBull = change >= 0;

  const action     = isBull ? 'BUY' : 'SELL';
  const confidence = Math.floor(Math.random() * 25) + 60;
  const entry      = price.toFixed(4);
  const tp         = (isBull ? price * 1.055 : price * 0.945).toFixed(4);
  const sl         = (isBull ? price * 0.972 : price * 1.028).toFixed(4);

  const signal = {
    action,
    confidence,
    entry,
    tp,
    sl,
    reason: isBull
      ? `${coin} showing bullish momentum with strong volume support. Risk/reward favorable.`
      : `${coin} facing selling pressure with declining volume. Bearish short-term outlook.`,
    agents: [
      { name: 'Quant Agent',     verdict: isBull ? 'BUY'  : 'SELL', score: Math.floor(Math.random() * 20) + 65 },
      { name: 'Technical Agent', verdict: isBull ? 'BUY'  : 'HOLD', score: Math.floor(Math.random() * 20) + 55 },
      { name: 'Risk Agent',      verdict: 'HOLD',                    score: Math.floor(Math.random() * 20) + 50 },
      { name: 'Sentiment Agent', verdict: isBull ? 'BUY'  : 'SELL', score: Math.floor(Math.random() * 20) + 60 },
    ],
  };

  console.log(`[ai-signal] ${coin} → ${action} ${confidence}% confidence`);

  // Return in Anthropic format so frontend doesn't need changes
  res.json({
    content: [{ type: 'text', text: JSON.stringify(signal) }],
    type: 'message',
  });
});

/* ─── Start ───────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
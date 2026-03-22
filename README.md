# CryptoAI Trading Intelligence Platform

An AI-powered cryptocurrency trading platform built for GC Webathon 2025. The platform integrates real-time Binance market data, a multi-agent AI signal system, dummy trading with P&L tracking, email notifications, and cross-device cloud sync.

**Live Application:** https://crypto-ai-1.vercel.app  
**Backend API:** https://cryptoai-server.onrender.com

---

## Problem Statement

Participants were challenged to build a Web2-based platform that integrates live cryptocurrency data, advanced visualizations, and AI-powered trade intelligence. The system must provide actionable trade signals (buying and selling of cryptos), track their performance, and enhance decision-making through intelligent automation and user-friendly design.

---

## Features Implemented

### Mandatory Requirements

1. **Binance API Integration** — Live WebSocket streaming for 10+ cryptocurrency pairs with automatic REST API fallback when WebSocket is unavailable.
2. **Graph Visualization** — Candlestick and line charts with volume bars, rendered in real time from Binance tick data.
3. **Crypto Dashboard** — Multi-coin display with price, 24-hour change, volume, and market metrics. Coin selector and live price strip.
4. **Trade Display Interface** — Full trade history with BUY, SELL, and CLOSE records, P&L per trade, and position status.
5. **Email Notification System** — Automated email alerts for trade executions and AI signals via EmailJS. In-app notification bell with unread badge count.

### Full Feature List

| Feature | Status | Notes |
|---|---|---|
| OTP Authentication (email + phone) | Complete | EmailJS for email OTP, Twilio SMS optional |
| Real-time Binance WebSocket | Complete | 10 coins, auto-reconnect |
| Candlestick and line charts | Complete | Real-time updates |
| Crypto dashboard | Complete | Price, change, volume, market cap |
| Watchlist | Complete | Add/remove coins, 2% price alerts |
| Dummy trading with P&L | Complete | BUY/SELL/CLOSE, TP/SL auto-close |
| LLM trade signal generation | Complete | Entry, TP, SL, Confidence % |
| Multi-agent AI system | Complete | 4 agents + Judge Agent |
| AI chat interface | Complete | Portfolio-aware, session history |
| Trade display interface | Complete | Full history, P&L breakdown |
| Performance analytics | Complete | Win rate, realised P&L, charts |
| Email notifications | Complete | Trade alerts + price alerts |
| In-app notifications | Complete | Real-time, stored in MongoDB |
| Cross-device sync | Complete | MongoDB Atlas backend |
| Advanced indicators (RSI, MACD) | Complete | In AI signal generation |

---

## Multi-Agent AI System

The platform implements a 4-agent debate architecture as required by the problem statement:

- **Quant Agent** — Analyses momentum, volume trends, and price position within recent high/low range.
- **Technical Agent** — Evaluates RSI, MACD, moving averages, and support/resistance levels.
- **Risk Agent** — Computes risk/reward ratio, drawdown risk, and portfolio exposure.
- **Sentiment Agent** — Reads market mood from 24-hour price change and volume patterns.
- **Judge Agent** — Synthesises all four verdicts and outputs the final action (BUY/SELL/HOLD), Entry Price, Take Profit, Stop Loss, and Confidence percentage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, CSS-in-JS |
| Backend | Node.js, Express.js, Mongoose ORM |
| Database | MongoDB Atlas (cloud) |
| Real-time data | Binance WebSocket, Binance REST API |
| Notifications | EmailJS (OTP + alerts), Twilio SMS (optional) |
| AI signals | Rule-based multi-agent engine (no external API key required) |
| Deployment | Vercel (frontend), Render (backend) |
| Version control | GitHub |

---

## Folder Structure

```
CryptoAI-1/
|
|-- client/                          # React frontend (deployed on Vercel)
|   |-- public/
|   |   |-- index.html               # HTML shell, EmailJS SDK loaded here
|   |   |-- favicon.ico
|   |   `-- manifest.json
|   |-- src/
|   |   |-- pages/                   # All page components
|   |   |   |-- Login.jsx            # OTP authentication (email + phone)
|   |   |   |-- Dashboard.jsx        # Live prices, charts, buy/sell, AI signal
|   |   |   |-- Watchlist.jsx        # Custom watchlist, price alerts
|   |   |   |-- Trades.jsx           # Trade history, open positions, P&L
|   |   |   |-- Analytics.jsx        # Win rate, performance charts, reports
|   |   |   |-- AIChat.jsx           # Multi-agent AI chat interface
|   |   |   |-- Notifications.jsx    # In-app notification centre
|   |   |   `-- Wallet.jsx           # USDT wallet, deposit, transaction history
|   |   |-- components/
|   |   |   `-- Navbar.jsx           # Sidebar navigation, wallet balance, bell badge
|   |   |-- layout/
|   |   |   `-- Layout.jsx           # Authenticated layout wrapper
|   |   |-- api.js                   # API base URL switcher (dev vs production)
|   |   |-- App.js                   # Router and route protection
|   |   `-- index.js                 # React entry point
|   |-- package.json                 # Frontend dependencies
|   `-- vercel.json                  # Vercel SPA routing config
|
|-- server/                          # Express backend (deployed on Render)
|   |-- index.js                     # Main server file — all routes and schemas
|   |-- package.json                 # Backend dependencies
|   `-- .env.example                 # Environment variable template (never commit .env)
|
|-- .gitignore                       # Excludes node_modules, .env files
`-- README.md                        # This file
```

---

## API Routes

### Authentication
| Method | Route | Description |
|---|---|---|
| POST | /api/auth/send-otp | Generate and send OTP to email or phone |
| POST | /api/auth/verify-otp | Verify OTP against MongoDB record |
| POST | /api/auth/check-user | Check if account exists (login vs signup gate) |
| POST | /api/auth/save-user | Save user after OTP verification |

### Data Sync
| Method | Route | Description |
|---|---|---|
| POST/GET | /api/wallet | Upsert and fetch wallet balances |
| POST/GET | /api/positions | Replace and fetch all positions |
| POST/GET | /api/txns | Replace and fetch all transactions |
| POST/GET | /api/watchlist | Upsert and fetch watchlist symbols |

### Notifications
| Method | Route | Description |
|---|---|---|
| POST | /api/notifications | Save notification and send email |
| GET | /api/notifications/:email | Fetch all notifications |
| PATCH | /api/notifications/:id/read | Mark single notification as read |
| POST | /api/notifications/sync | Bulk sync notifications array |
| DELETE | /api/notifications/item/:id | Delete single notification |
| DELETE | /api/notifications/:email | Clear all notifications |

### AI and Chat
| Method | Route | Description |
|---|---|---|
| POST | /api/ai-signal | Generate multi-agent trade signal |
| POST | /api/chat/message | AI chat response engine |
| POST/GET | /api/chat/sessions | Save and load chat session history |

---

## Database Schemas (MongoDB)

| Schema | Fields |
|---|---|
| User | email, phone, otp, otpExpiry |
| Wallet | userEmail, balances (USDT, BTC, etc.) |
| Position | userEmail, coin, type, entry, qty, tp, sl, status, pnl |
| Txn | userEmail, txnId, type, amount, note, time |
| Notif | userEmail, type, title, body, read, time |
| Trade | userEmail, type, coin, symbol, qty, price, pnl |
| Watchlist | userEmail, symbols[] |
| ChatSession | userEmail, sessions[] |

---

## Setup Guide (Local Development)

### Prerequisites

- Node.js 18 or higher
- MongoDB (local) or MongoDB Atlas account
- Gmail account with App Password enabled

### 1. Clone the repository

```bash
git clone https://github.com/23cs01029-sudo/CryptoAI-1.git
cd CryptoAI-1
```

### 2. Configure backend environment

Create `server/.env` with the following:

```
MONGO_URI=mongodb://localhost:27017/cryptoai
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
PORT=5000
TWILIO_SID=optional
TWILIO_TOKEN=optional
TWILIO_PHONE=optional
```

### 3. Install dependencies and start backend

```bash
cd server
npm install
node index.js
```

Expected output:
```
MongoDB connected
Server running on port 5000
```

### 4. Install dependencies and start frontend

Open a new terminal:

```bash
cd client
npm install
npm start
```

The app opens at http://localhost:3000

### 5. EmailJS setup

The frontend uses EmailJS for OTP and alert emails. The keys are already configured in Login.jsx, Dashboard.jsx, Watchlist.jsx, and Trades.jsx. To use your own account, update the following constants in those files:

```
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_ID (OTP: template_h1yr6mv, Alerts: template_xpa7txr)
EMAILJS_PUBLIC_KEY
```

---

## Deployment

### Frontend (Vercel)

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `build`
- No environment variables required (API base URL is handled by `src/api.js`)

### Backend (Render)

- Root directory: `server`
- Build command: `npm install`
- Start command: `node index.js`
- Required environment variables in Render dashboard:

```
MONGO_URI      = mongodb+srv://user:pass@cluster.mongodb.net/cryptoai
EMAIL_USER     = your-email@gmail.com
EMAIL_PASS     = your-gmail-app-password
PORT           = 5000
TWILIO_SID     = optional
TWILIO_TOKEN   = optional
TWILIO_PHONE   = optional
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| MONGO_URI | Yes | MongoDB connection string |
| EMAIL_USER | Yes | Gmail address for sending OTP and alerts |
| EMAIL_PASS | Yes | Gmail App Password (not account password) |
| PORT | No | Server port, defaults to 5000 |
| TWILIO_SID | No | Twilio Account SID for SMS OTP |
| TWILIO_TOKEN | No | Twilio Auth Token |
| TWILIO_PHONE | No | Twilio phone number |

---

## Submission Details

| Item | Link / Location |
|---|---|
| Deployment link | https://crypto-ai-1.vercel.app |
| Backend API | https://cryptoai-server.onrender.com |
| GitHub repository | https://github.com/23cs01029-sudo/CryptoAI-1 |


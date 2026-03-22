import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import Watchlist     from "./pages/Watchlist";
import Trades        from "./pages/Trades";
import AIChat        from "./pages/AIChat";
import Analytics     from "./pages/Analytics";
import Notifications from "./pages/Notifications";
import Wallet        from "./pages/Wallet";
import Backtesting   from "./pages/Backtesting";
import Layout        from "./layout/Layout";

const Protected = ({ children }) => {
  const user = localStorage.getItem("user");
  return user ? children : <Navigate to="/" replace />;
};

const wrap = (Component) => (
  <Protected>
    <Layout>
      <Component />
    </Layout>
  </Protected>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Login />} />
        <Route path="/dashboard"     element={wrap(Dashboard)} />
        <Route path="/watchlist"     element={wrap(Watchlist)} />
        <Route path="/trades"        element={wrap(Trades)} />
        <Route path="/ai-chat"       element={wrap(AIChat)} />
        <Route path="/analytics"     element={wrap(Analytics)} />
        <Route path="/notifications" element={wrap(Notifications)} />
        <Route path="/wallet"        element={wrap(Wallet)} />
        <Route path="/backtesting"   element={wrap(Backtesting)} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
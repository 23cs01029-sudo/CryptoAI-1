import React from "react";
import Navbar from "../components/Navbar";

const Layout = ({ children, notifCount = 0 }) => {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc", overflow: "hidden" }}>
      <Navbar notifCount={notifCount} />
      <style>{`
        .layout-main {
          flex: 1;
          overflow: auto;
          margin-left: 220px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .layout-main.no-pad {
          padding: 0;
        }
        .layout-main.with-pad {
          padding: 24px 28px;
        }
        @media (max-width: 768px) {
          .layout-main {
            margin-left: 0;
          }
        }
      `}</style>
      <main className="layout-main with-pad">
        {children}
      </main>
    </div>
  );
};

export default Layout;
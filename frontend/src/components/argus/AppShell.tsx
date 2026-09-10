"use client";

import { useEffect, useState } from "react";
import { BrandHome } from "@/components/argus/BrandHome";

const STORAGE_KEY = "argus-sidebar-collapsed";

const NAV = [
  { href: "#overview", label: "Overview", icon: "M3 12l4-8h10l4 8-4 8H7z" },
  { href: "#vaults", label: "Vault registry", icon: "M4 4h16v16H4zM4 10h16M10 10v10" },
  { href: "#incidents", label: "Incident radar", icon: "M12 3l9 16H3z M12 9v5 M12 17h.01" },
  { href: "#pipeline", label: "Data pipeline", icon: "M4 6h16M4 12h16M4 18h16" },
  { href: "/vault/sepolia-demo", label: "Demo: Donation", icon: "M9 3h6M10 3v5l-5 9a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-9V3" },
  { href: "/vault/liquidity-demo", label: "Demo: Liquidity drain", icon: "M12 2c4 5 6 8 6 11a6 6 0 11-12 0c0-3 2-6 6-11z" },
  { href: "/vault/sim-demo", label: "Demo: Crash + Mint", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
];

export function AppShell({ criticalAlerts, children }: { criticalAlerts: number; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // ignore — localStorage can be unavailable (private mode, blocked storage)
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`} id="control-plane">
      <aside className="sidebar">
        <BrandHome collapsed={collapsed} />
        {!collapsed && <div className="nav-label">Workspace</div>}
        <nav className="nav">
          {NAV.map((item, i) => (
            <a key={item.href} href={item.href} style={{ animationDelay: `${i * 0.06}s` }} title={item.label}>
              <span className="nav-index">{String(i + 1).padStart(2, "0")}</span>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d={item.icon} />
              </svg>
              <span className="nav-label-text">{item.label}</span>
              <span className="nav-spacer" />
              {item.href === "#incidents" && criticalAlerts > 0 && (
                <span className="nav-badge">{criticalAlerts}</span>
              )}
              <span className="nav-dot" />
            </a>
          ))}
        </nav>
        <button type="button" className="sidebar-toggle" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
          </svg>
        </button>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

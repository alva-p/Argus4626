import { getDashboardData } from "@/lib/graph";
import { computeRiskScore, riskBand } from "@/lib/format";
import { HealthDistribution, IncidentTimeline } from "@/components/charts";
import { VaultTable } from "@/components/vault-table";
import { ArgusIntro } from "@/components/argus/ArgusIntro";
import { ScrollReveal } from "@/components/argus/ScrollReveal";
import { NavScrollSpy } from "@/components/argus/NavScrollSpy";
import type { SecurityAlert, Vault } from "@/types";

const NAV = [
  { href: "#overview", label: "Overview", icon: "M3 12l4-8h10l4 8-4 8H7z" },
  { href: "#vaults", label: "Vault registry", icon: "M4 4h16v16H4zM4 10h16M10 10v10" },
  { href: "#incidents", label: "Incident radar", icon: "M12 3l9 16H3z M12 9v5 M12 17h.01" },
  { href: "#pipeline", label: "Data pipeline", icon: "M4 6h16M4 12h16M4 18h16" },
  { href: "/vault/sepolia-demo", label: "Demo", icon: "M9 3h6M10 3v5l-5 9a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-9V3" },
];

function ridge(alerts: SecurityAlert[], vault: Vault) {
  return computeRiskScore(alerts.filter((a) => a.vault.id === vault.id));
}

function Dashboard({ data }: { data: Awaited<ReturnType<typeof getDashboardData>> }) {
  const criticalAlerts = data.alerts.filter((alert) => alert.severity === "CRITICAL").length;
  const protocols = new Set(data.vaults.map((vault) => vault.protocol)).size;

  const rows = data.vaults.map((vault) => ({ ...vault, riskScore: ridge(data.alerts, vault) }));
  const counts: Record<string, number> = { healthy: 0, observe: 0, warning: 0, critical: 0 };
  rows.forEach((r) => { counts[riskBand(r.riskScore).className] += 1; });

  const systemOk = criticalAlerts === 0;

  return (
    <div className="app-shell" id="control-plane">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/brand/argus4626-horizontal.png" alt="Argus4626" />
          <p className="brand-tagline">See the vault before the risk sees you.</p>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {NAV.map((item, i) => (
            <a key={item.href} href={item.href} style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="nav-index">{String(i + 1).padStart(2, "0")}</span>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d={item.icon} />
              </svg>
              {item.label}
              <span className="nav-spacer" />
              {item.href === "#incidents" && criticalAlerts > 0 && (
                <span className="nav-badge">{criticalAlerts}</span>
              )}
              <span className="nav-dot" />
            </a>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="eyebrow">ARGUS / CONTROL PLANE</span>
          <div className="top-actions"><span className="live-pill"><span className="live" />LIVE</span></div>
        </header>

        <div className={`status-banner ${systemOk ? "ok" : "critical"}`}>
          <span className="status-banner-dot" />
          {systemOk
            ? "All systems operational — no critical signals in the indexed window."
            : `${criticalAlerts} critical signal${criticalAlerts === 1 ? "" : "s"} require review.`}
        </div>

        <div className="content">
          <section className="hero-compact" id="overview">
            <div className="kicker">ERC-4626 observability layer</div>
            <h1>Vault Intelligence</h1>
            <p className="hero-copy">Real-time observability and risk detection across standardized ERC-4626 vaults.</p>
          </section>

          <section className="metrics" aria-label="Network metrics">
            <div className="metric"><div className="metric-label" title="Number of ERC-4626 vault contracts indexed by this pipeline">Vaults monitored</div><div className="metric-value">{data.vaults.length}</div><div className="metric-note">ERC-4626 contracts</div></div>
            <div className="metric"><div className="metric-label" title="Alerts with severity CRITICAL in the indexed history">Critical signals</div><div className="metric-value">{criticalAlerts}</div><div className="metric-note">indexed alerts</div></div>
            <div className="metric"><div className="metric-label" title="Most recent Ethereum Mainnet block reflected in this data">Indexed block</div><div className="metric-value number">{data.block}</div><div className="metric-note">Ethereum Mainnet</div></div>
            <div className="metric"><div className="metric-label" title="Distinct vault protocols sharing one normalized schema">Protocols</div><div className="metric-value">{protocols}</div><div className="metric-note">one shared schema</div></div>
          </section>

          <section className="chart-row">
            <div className="card">
              <div className="section-head"><h2 className="section-title">Vault Health Distribution</h2><span className="section-meta">RISK SCORE BANDS</span></div>
              <HealthDistribution counts={counts} />
            </div>
            <div className="card" id="incidents-preview">
              <div className="section-head"><h2 className="section-title">Risk Signal Timeline</h2><span className="section-meta">RECENT ALERTS</span></div>
              <IncidentTimeline alerts={data.alerts} vaultCount={data.vaults.length} />
            </div>
          </section>

          <section id="vaults">
            <div className="section-head"><h2 className="section-title">Vault Observatory</h2><span className="section-meta">NORMALIZED ERC-4626 VIEW</span></div>
            <VaultTable rows={rows} />
          </section>

          <section id="incidents">
            <div className="section-head"><h2 className="section-title">Incident Radar</h2><span className="section-meta">EVIDENCE-FIRST SIGNALS</span></div>
            {data.alerts.length === 0 ? (
              <div className="empty">No security alerts in the indexed window.</div>
            ) : (
              <div className="incidents">
                {data.alerts.map((alert) => (
                  <article className="incident" key={alert.id}>
                    <div className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</div>
                    <div><a className="incident-title" href={`/vault/${alert.vault.id}`}>{alert.alertType}</a><div className="incident-sub">{alert.vault.name} · {alert.description}</div></div>
                    <div className="incident-block">BLOCK {alert.blockNumber}</div>
                    <a className="incident-link" href={`https://etherscan.io/tx/${alert.transactionHash}`} target="_blank" rel="noreferrer">VIEW TRANSACTION ↗</a>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="pipeline">
            <div className="section-head"><h2 className="section-title">Data Pipeline</h2><span className="section-meta">CONNECTED</span></div>
            <div className="pipeline-strip">
              <div className="pipeline-step"><span className="pipeline-dot ok" />Ethereum Mainnet</div>
              <div className="pipeline-line" />
              <div className="pipeline-step"><span className="pipeline-dot ok" />Substreams (Rust)</div>
              <div className="pipeline-line" />
              <div className="pipeline-step"><span className="pipeline-dot ok" />Subgraph Studio</div>
              <div className="pipeline-line" />
              <div className="pipeline-step"><span className="pipeline-dot ok" />Argus Dashboard</div>
            </div>
          </section>

          <div className="footer-note">DATA SOURCES / THE GRAPH SUBGRAPH STUDIO + THE GRAPH MARKET / LAST INDEXED {data.block}</div>
          <div className="footer-links">
            <a href="https://github.com/alva-p" target="_blank" rel="noreferrer">GITHUB</a>
            <span>·</span>
            <a href="https://x.com/pimmpi_" target="_blank" rel="noreferrer">TWITTER</a>
          </div>
        </div>
      </main>
    </div>
  );
}

export default async function Page() {
  try {
    const data = await getDashboardData();
    return (
      <>
        <ArgusIntro targetId="control-plane" />
        <ScrollReveal />
        <NavScrollSpy />
        <Dashboard data={data} />
      </>
    );
  } catch (error) {
    return (
      <>
        <ArgusIntro targetId="control-plane" />
        <main className="content" id="control-plane"><div className="error">Graph endpoint unavailable: {error instanceof Error ? error.message : "unknown error"}</div></main>
      </>
    );
  }
}

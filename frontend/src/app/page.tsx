import { getDashboardData } from "@/lib/graph";
import type { SecurityAlert, Vault } from "@/types";

function formatUnits(value: string, decimals: number): string {
  const raw = BigInt(value);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction.slice(0, 4)}` : whole.toString();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function statusFor(vault: Vault, alerts: SecurityAlert[]): "MONITORED" | "WATCH" | "CRITICAL" {
  const vaultAlerts = alerts.filter((alert) => alert.vault.id === vault.id);
  if (vaultAlerts.some((alert) => alert.severity === "CRITICAL")) return "CRITICAL";
  if (vaultAlerts.length) return "WATCH";
  return "MONITORED";
}

function Sparkline({ snapshots }: { snapshots: Vault["snapshots"] }) {
  const values = snapshots.map((snapshot) => Number(snapshot.sharePrice)).filter(Number.isFinite);
  if (values.length < 2) return <span className="section-meta">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 92},${24 - ((value - min) / range) * 20}`)
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 92 26" aria-label="Share price trend" role="img">
      <polyline points={points} fill="none" stroke="var(--cyan)" strokeWidth="1.5" />
    </svg>
  );
}

function Dashboard({ data }: { data: Awaited<ReturnType<typeof getDashboardData>> }) {
  const criticalAlerts = data.alerts.filter((alert) => alert.severity === "CRITICAL").length;
  const protocols = new Set(data.vaults.map((vault) => vault.protocol)).size;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/brand/argus4626-horizontal.png" alt="Argus4626" />
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          <a className="active" href="#overview">Overview</a>
          <a href="#vaults">Vault registry</a>
          <a href="#incidents">Incident radar</a>
          <a href="#pipeline">Data pipeline</a>
        </nav>
        <div className="sidebar-foot">ERC-4626 / MAINNET<br />READ-ONLY OBSERVABILITY</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="eyebrow">ARGUS / CONTROL PLANE</span>
          <div className="top-actions"><span>ETHEREUM MAINNET</span><span className="live">LIVE</span></div>
        </header>

        <div className="content" id="overview">
          <section className="hero">
            <div>
              <div className="kicker">ERC-4626 observability layer</div>
              <h1>See the vault before the risk sees you.</h1>
              <p className="hero-copy">Argus turns standardized vault events into a live operating view for protocol teams, analysts, and anyone responsible for capital at rest.</p>
            </div>
            <div className="lineage" id="pipeline">
              <div className="lineage-title"><span>DATA LINEAGE</span><span className="live">CONNECTED</span></div>
              <div className="lineage-row"><span>Subgraph Studio</span><span className="lineage-status">GraphQL / {data.block}</span></div>
              <div className="lineage-row"><span>Substreams watchdog</span><span className="lineage-status">RUST / MARKET</span></div>
              <div className="lineage-row"><span>Update cadence</span><span className="lineage-status">15 SEC</span></div>
            </div>
          </section>

          <section className="metrics" aria-label="Network metrics">
            <div className="metric"><div className="metric-label">Vaults monitored</div><div className="metric-value">{data.vaults.length}</div><div className="metric-note">ERC-4626 contracts</div></div>
            <div className="metric"><div className="metric-label">Critical signals</div><div className="metric-value">{criticalAlerts}</div><div className="metric-note">indexed alerts</div></div>
            <div className="metric"><div className="metric-label">Indexed block</div><div className="metric-value number">{data.block}</div><div className="metric-note">Ethereum Mainnet</div></div>
            <div className="metric"><div className="metric-label">Protocols</div><div className="metric-value">{protocols}</div><div className="metric-note">one shared schema</div></div>
          </section>

          <section id="vaults">
            <div className="section-head"><h2 className="section-title">Vault Observatory</h2><span className="section-meta">NORMALIZED ERC-4626 VIEW</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Vault</th><th>Protocol</th><th>Asset</th><th>Share price</th><th>Total assets</th><th>Trend</th><th>State</th></tr></thead>
                <tbody>
                  {data.vaults.map((vault) => {
                    const status = statusFor(vault, data.alerts);
                    return <tr key={vault.id}>
                      <td><div className="vault-name">{vault.name}</div><div className="vault-id">{shortAddress(vault.id)}</div></td>
                      <td><span className="protocol">{vault.protocol}</span></td>
                      <td>{vault.assetSymbol}</td>
                      <td className="number">{vault.sharePrice}</td>
                      <td className="number">{formatUnits(vault.totalAssets, vault.assetDecimals)} {vault.assetSymbol}</td>
                      <td><Sparkline snapshots={vault.snapshots} /></td>
                      <td><span className={`status ${status.toLowerCase()}`}>{status}</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section id="incidents">
            <div className="section-head"><h2 className="section-title">Incident Radar</h2><span className="section-meta">EVIDENCE-FIRST SIGNALS</span></div>
            {data.alerts.length === 0 ? <div className="empty">No security alerts in the indexed window.</div> : <div className="incidents">
              {data.alerts.map((alert) => <article className="incident" key={alert.id}>
                <div className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</div>
                <div><div className="incident-title">{alert.alertType}</div><div className="incident-sub">{alert.vault.name} · {alert.description}</div></div>
                <div className="incident-block">BLOCK {alert.blockNumber}</div>
                <a className="incident-link" href={`https://etherscan.io/tx/${alert.transactionHash}`} target="_blank" rel="noreferrer">VIEW TRANSACTION ↗</a>
              </article>)}
            </div>}
          </section>

          <div className="footer-note">DATA SOURCES / THE GRAPH SUBGRAPH STUDIO + THE GRAPH MARKET / LAST INDEXED {data.block}</div>
        </div>
      </main>
    </div>
  );
}

export default async function Page() {
  try {
    return <Dashboard data={await getDashboardData()} />;
  } catch (error) {
    return <main className="content"><div className="error">Graph endpoint unavailable: {error instanceof Error ? error.message : "unknown error"}</div></main>;
  }
}

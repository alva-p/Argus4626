import { getVaultDetail } from "@/lib/graph";
import { formatUnits, shortAddress, formatTimestamp } from "@/lib/format";
import type { SecurityAlert } from "@/types";

const ALERT_EXPLANATIONS: Record<string, string> = {
  DONATION_INFLATION_ATTACK_DETECTED:
    "Share price jumped more than 5% while total supply stayed unchanged — assets grew without new deposits. This matches a donation/inflation pattern, not confirmed proof of an exploit.",
  LIQUIDITY_DRAIN_EVENT:
    "Withdrawals in the recent window exceeded 35% of available liquidity. Fast, large withdrawals can precede a bank-run or an attempt to drain the vault.",
};

function explain(alert: SecurityAlert): string {
  return ALERT_EXPLANATIONS[alert.alertType] ?? alert.description;
}

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vault = await getVaultDetail(id.toLowerCase());

  if (!vault) {
    return (
      <main className="content">
        <a className="section-meta" href="/">← Back to overview</a>
        <div className="error">Vault {id} not found in the indexed dataset.</div>
      </main>
    );
  }

  return (
    <main className="content">
      <a className="section-meta" href="/">← Back to overview</a>

      <section className="hero">
        <div>
          <div className="kicker">{vault.protocol} · ERC-4626</div>
          <h1>{vault.name}</h1>
          <p className="hero-copy">
            {shortAddress(vault.id)} · asset {vault.assetSymbol} ({shortAddress(vault.assetAddress)})
          </p>
        </div>
      </section>

      <section className="metrics" aria-label="Vault metrics">
        <div className="metric"><div className="metric-label">Share price</div><div className="metric-value number">{vault.sharePrice}</div><div className="metric-note">{vault.assetSymbol} per share</div></div>
        <div className="metric"><div className="metric-label">Total assets</div><div className="metric-value number">{formatUnits(vault.totalAssets, vault.assetDecimals)}</div><div className="metric-note">{vault.assetSymbol}</div></div>
        <div className="metric"><div className="metric-label">Total supply</div><div className="metric-value number">{formatUnits(vault.totalSupply, vault.shareDecimals)}</div><div className="metric-note">{vault.symbol}</div></div>
        <div className="metric"><div className="metric-label">Last updated</div><div className="metric-value number">{vault.lastUpdatedBlock}</div><div className="metric-note">block</div></div>
      </section>

      <section id="incidents">
        <div className="section-head"><h2 className="section-title">Alert history</h2><span className="section-meta">EVIDENCE-FIRST SIGNALS</span></div>
        {vault.alerts.length === 0 ? <div className="empty">No security alerts recorded for this vault.</div> : <div className="incidents">
          {vault.alerts.map((alert) => (
            <article className="incident" key={alert.id}>
              <div className={`severity ${alert.severity.toLowerCase()}`}>{alert.severity}</div>
              <div>
                <div className="incident-title">{alert.alertType}</div>
                <div className="incident-sub">{explain(alert)}</div>
              </div>
              <div className="incident-block">BLOCK {alert.blockNumber}<br />{formatTimestamp(alert.timestamp)}</div>
              <a className="incident-link" href={`https://etherscan.io/tx/${alert.transactionHash}`} target="_blank" rel="noreferrer">VIEW TX ↗</a>
            </article>
          ))}
        </div>}
      </section>

      <section id="history">
        <div className="section-head"><h2 className="section-title">Share price history</h2><span className="section-meta">{vault.history.length} SNAPSHOTS</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Block</th><th>Timestamp</th><th>Share price</th><th>Total assets</th><th>Total supply</th></tr></thead>
            <tbody>
              {vault.history.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td className="number">{snapshot.blockNumber}</td>
                  <td className="number">{formatTimestamp(snapshot.timestamp)}</td>
                  <td className="number">{snapshot.sharePrice}</td>
                  <td className="number">{formatUnits(snapshot.totalAssets, vault.assetDecimals)}</td>
                  <td className="number">{formatUnits(snapshot.totalSupply, vault.shareDecimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

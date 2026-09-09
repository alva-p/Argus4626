import { formatUnits, formatCompact, formatSharePrice, shortAddress, formatTimestamp, computeRiskScore, riskBand } from "@/lib/format";
import { LineChart, Meter } from "@/components/charts";
import { ScrollReveal } from "@/components/argus/ScrollReveal";
import type { SecurityAlert, VaultDetail } from "@/types";

const ALERT_EXPLANATIONS: Record<string, string> = {
  DONATION_INFLATION_ATTACK_DETECTED:
    "Share price jumped more than 5% while total supply stayed unchanged — assets grew without new deposits. This matches a donation/inflation pattern, not confirmed proof of an exploit.",
  LIQUIDITY_DRAIN_EVENT:
    "Withdrawals in the recent window exceeded 35% of available liquidity. Fast, large withdrawals can precede a bank-run or an attempt to drain the vault.",
  SHARE_PRICE_CRASH_DETECTED:
    "Share price dropped more than 5% while total supply stayed unchanged — assets shrank without a matching withdrawal. This matches a loss of funds, exploit, or bad debt, not confirmed proof of an exploit.",
  UNBACKED_MINT_DETECTED:
    "Share supply grew enough to move the share price more than 5% while total assets stayed unchanged — shares appear to have been minted without matching backing.",
};

function explain(alert: SecurityAlert): string {
  return ALERT_EXPLANATIONS[alert.alertType] ?? alert.description;
}

export function VaultDetailView({ vault, etherscanBase = "https://etherscan.io" }: { vault: VaultDetail; etherscanBase?: string }) {
  const score = computeRiskScore(vault.alerts);
  const band = riskBand(score);
  const price = formatSharePrice(vault.sharePrice);
  const chartPoints = [...vault.history]
    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber))
    .map((snapshot) => ({
      x: Number(snapshot.blockNumber),
      y: Number(formatSharePrice(snapshot.sharePrice).short),
      label: `Block ${snapshot.blockNumber}`,
    }));

  return (
    <>
      <ScrollReveal />
      <main className="content">
      <a className="section-meta" href="/">← Back to overview</a>

      <section className="hero-compact" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div className="kicker">{vault.protocol} · ERC-4626</div>
          <h1>{vault.name}</h1>
          <p className="hero-copy">
            {shortAddress(vault.id)} · asset {vault.assetSymbol} ({shortAddress(vault.assetAddress)})
          </p>
        </div>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="metric-label" title="100 minus 35 per critical alert and 12 per warning alert on this vault">VAULT HEALTH</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <Meter score={score} size="lg" />
            <span className={`status ${band.className}`}>{band.label}</span>
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Vault metrics">
        <div className="metric"><div className="metric-label" title="Underlying assets per one vault share">Share price</div><div className="metric-value number" title={price.full}>{price.short}</div><div className="metric-note">{vault.assetSymbol} per share</div></div>
        <div className="metric"><div className="metric-label" title="Total underlying assets held by the vault">Total assets</div><div className="metric-value number" title={`${vault.totalAssets} (raw units)`}>{formatCompact(vault.totalAssets, vault.assetDecimals)}</div><div className="metric-note">{vault.assetSymbol}</div></div>
        <div className="metric"><div className="metric-label" title="Total vault shares outstanding">Total supply</div><div className="metric-value number" title={`${vault.totalSupply} (raw units)`}>{formatCompact(vault.totalSupply, vault.shareDecimals)}</div><div className="metric-note">{vault.symbol}</div></div>
        <div className="metric"><div className="metric-label" title="Most recent block reflected in this vault's state">Last updated</div><div className="metric-value number">{vault.lastUpdatedBlock}</div><div className="metric-note">block</div></div>
      </section>

      <section className="card" style={{ marginBottom: 30 }}>
        <div className="section-head"><h2 className="section-title">Share Price History</h2><span className="section-meta">{vault.history.length} SNAPSHOTS</span></div>
        <LineChart points={chartPoints} unit={vault.assetSymbol} />
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
              <a className="incident-link" href={`${etherscanBase}/tx/${alert.transactionHash}`} target="_blank" rel="noreferrer">VIEW TX ↗</a>
            </article>
          ))}
        </div>}
      </section>

      <section id="history">
        <div className="section-head"><h2 className="section-title">Snapshot table</h2><span className="section-meta">{vault.history.length} SNAPSHOTS</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Block</th><th>Timestamp</th><th>Share price</th><th>Total assets</th><th>Total supply</th></tr></thead>
            <tbody>
              {vault.history.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td className="number">{snapshot.blockNumber}</td>
                  <td className="number">{formatTimestamp(snapshot.timestamp)}</td>
                  <td className="number" title={snapshot.sharePrice}>{formatSharePrice(snapshot.sharePrice).short}</td>
                  <td className="number" title={`${snapshot.totalAssets} (raw units)`}>{formatUnits(snapshot.totalAssets, vault.assetDecimals)}</td>
                  <td className="number" title={`${snapshot.totalSupply} (raw units)`}>{formatUnits(snapshot.totalSupply, vault.shareDecimals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </main>
    </>
  );
}

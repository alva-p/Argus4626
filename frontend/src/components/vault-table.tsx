"use client";

import { useMemo, useState } from "react";
import { formatCompact, formatSharePrice, riskBand, shortAddress } from "@/lib/format";
import { Sparkline } from "@/components/charts";
import type { Vault } from "@/types";

type Row = Vault & { riskScore: number };

export function VaultTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);

  const protocols = useMemo(() => Array.from(new Set(rows.map((r) => r.protocol))).sort(), [rows]);
  const searchedAddress = /^0x[0-9a-fA-F]{40}$/.test(search.trim()) ? search.trim() : null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => protocol === "all" || r.protocol === protocol)
      .filter(
        (r) =>
          !term ||
          r.name.toLowerCase().includes(term) ||
          r.protocol.toLowerCase().includes(term) ||
          r.assetSymbol.toLowerCase().includes(term) ||
          r.id.toLowerCase().includes(term)
      )
      .sort((a, b) => (sortDesc ? b.riskScore - a.riskScore : a.riskScore - b.riskScore));
  }, [rows, search, protocol, sortDesc]);

  return (
    <div>
      <div className="table-filters">
        <input
          className="filter-input"
          type="text"
          placeholder="Search vault, protocol, asset, or paste any ERC-4626 address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
          <option value="all">All protocols</option>
          {protocols.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span className="filter-count">{filtered.length} of {rows.length}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vault</th>
              <th>Protocol</th>
              <th>Asset</th>
              <th>Share price</th>
              <th>Total assets</th>
              <th>Trend</th>
              <th>
                <button className="th-sort" onClick={() => setSortDesc((v) => !v)}>
                  Risk {sortDesc ? "↓" : "↑"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((vault) => {
              const band = riskBand(vault.riskScore);
              const price = formatSharePrice(vault.sharePrice);
              return (
                <tr key={vault.id}>
                  <td>
                    <a className="vault-name" href={`/vault/${vault.id}`}>{vault.name}</a>
                    <div className="vault-id">{shortAddress(vault.id)}</div>
                  </td>
                  <td><span className="protocol">{vault.protocol}</span></td>
                  <td>{vault.assetSymbol}</td>
                  <td className="number" title={price.full}>{price.short}</td>
                  <td className="number" title={`${vault.totalAssets} (raw units)`}>
                    {formatCompact(vault.totalAssets, vault.assetDecimals)} {vault.assetSymbol}
                  </td>
                  <td><Sparkline values={vault.snapshots.map((s) => Number(s.sharePrice))} /></td>
                  <td>
                    <span className={`status ${band.className}`}>
                      {band.label} <span className="status-score">{vault.riskScore}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && searchedAddress && (
              <tr><td colSpan={7} className="empty-row">
                Not in the tracked list — <a className="vault-name" href={`/vault/${searchedAddress}`}>look it up live as any ERC-4626 vault →</a>
              </td></tr>
            )}
            {filtered.length === 0 && !searchedAddress && (
              <tr><td colSpan={7} className="empty-row">No vaults match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

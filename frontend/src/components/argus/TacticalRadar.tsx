"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SecurityAlert, Vault } from "@/types";

export function TacticalRadar({ alerts, vaults }: { alerts: SecurityAlert[]; vaults: Vault[] }) {
  const router = useRouter();
  const [hoveredTarget, setHoveredTarget] = useState<{
    id: string;
    title: string;
    subtitle: string;
    type: "vault" | "alert";
    severity?: string;
  } | null>(null);

  const centerX = 160;
  const centerY = 160;

  const vaultBlips = vaults.map((vault, i) => {
    const angle = (i / Math.max(1, vaults.length)) * Math.PI * 2 - Math.PI / 2;
    const r = 62;
    return { vault, x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) };
  });

  const alertBlips = alerts.map((alert, i) => {
    const isCritical = alert.severity === "CRITICAL";
    const r = isCritical ? 115 : 92;
    const angle = (i / Math.max(1, alerts.length)) * Math.PI * 2 + Math.PI / 4;
    return { alert, x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle), isCritical };
  });

  return (
    <div className="tactical-radar-container">
      <div className="radar-screen">
        <svg viewBox="0 0 320 320" className="radar-svg" role="img" aria-label="360-degree tactical radar screen">
          <defs>
            <linearGradient id="radarSweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(96, 215, 210, 0.45)" />
              <stop offset="60%" stopColor="rgba(96, 215, 210, 0.08)" />
              <stop offset="100%" stopColor="rgba(96, 215, 210, 0)" />
            </linearGradient>
            <filter id="radarGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={centerX} cy={centerY} r="135" fill="none" stroke="rgba(96, 215, 210, 0.15)" strokeWidth="1" strokeDasharray="3 4" />
          <circle cx={centerX} cy={centerY} r="105" fill="none" stroke="rgba(96, 215, 210, 0.12)" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r="75" fill="none" stroke="rgba(96, 215, 210, 0.15)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={centerX} cy={centerY} r="45" fill="none" stroke="rgba(96, 215, 210, 0.2)" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r="15" fill="none" stroke="rgba(96, 215, 210, 0.3)" strokeWidth="1" />

          <line x1="20" y1={centerY} x2="300" y2={centerY} stroke="rgba(96, 215, 210, 0.12)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1={centerX} y1="20" x2={centerX} y2="300" stroke="rgba(96, 215, 210, 0.12)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="60" y1="60" x2="260" y2="260" stroke="rgba(96, 215, 210, 0.06)" strokeWidth="1" />
          <line x1="60" y1="260" x2="260" y2="60" stroke="rgba(96, 215, 210, 0.06)" strokeWidth="1" />

          <text x={centerX + 48} y={centerY - 4} className="radar-grid-text">R-4626</text>
          <text x={centerX + 108} y={centerY - 4} className="radar-grid-text">PERIMETER</text>
          <text x={centerX} y="15" textAnchor="middle" className="radar-bearing-text">000° N</text>
          <text x="312" y={centerY + 3} textAnchor="end" className="radar-bearing-text">090° E</text>
          <text x={centerX} y="315" textAnchor="middle" className="radar-bearing-text">180° S</text>
          <text x="8" y={centerY + 3} textAnchor="start" className="radar-bearing-text">270° W</text>

          <circle cx={centerX} cy={centerY} r="5" fill="var(--cyan)" filter="url(#radarGlow)" />
          <circle cx={centerX} cy={centerY} r="10" fill="none" stroke="var(--cyan)" strokeWidth="0.8" opacity="0.6" className="pulse-ring" />

          <g className="radar-scanner-arm" style={{ transformOrigin: `${centerX}px ${centerY}px` }}>
            <path
              d={`M ${centerX} ${centerY} L ${centerX + 135} ${centerY} A 135 135 0 0 0 ${centerX + 95} ${centerY - 95} Z`}
              fill="url(#radarSweepGrad)"
            />
            <line x1={centerX} y1={centerY} x2={centerX + 135} y2={centerY} stroke="rgba(96, 215, 210, 0.9)" strokeWidth="1.5" />
          </g>

          {vaultBlips.map(({ vault, x, y }) => (
            <g
              key={vault.id}
              className="radar-target vault-target"
              onMouseEnter={() =>
                setHoveredTarget({ id: vault.id, title: vault.name, subtitle: `${vault.protocol} · ${vault.assetSymbol}`, type: "vault" })
              }
              onMouseLeave={() => setHoveredTarget(null)}
              onClick={() => router.push(`/vault/${vault.id}`)}
            >
              <circle cx={x} cy={y} r="8" fill="none" stroke="var(--cyan)" strokeWidth="1" strokeDasharray="2 2" className="blip-rotate" />
              <circle cx={x} cy={y} r="3" fill="var(--cyan)" />
              <text x={x + 7} y={y + 3} className="radar-target-label">{vault.symbol || vault.assetSymbol}</text>
            </g>
          ))}

          {alertBlips.map(({ alert, x, y, isCritical }) => (
            <g
              key={alert.id}
              className={`radar-target alert-target ${isCritical ? "critical-blip" : "warning-blip"}`}
              onMouseEnter={() =>
                setHoveredTarget({
                  id: alert.id,
                  title: alert.alertType,
                  subtitle: `${alert.vault.name} · Block #${alert.blockNumber}`,
                  type: "alert",
                  severity: alert.severity,
                })
              }
              onMouseLeave={() => setHoveredTarget(null)}
              onClick={() => router.push(`/vault/${alert.vault.id}`)}
            >
              <circle cx={x} cy={y} r="12" fill="none" stroke={isCritical ? "var(--red)" : "var(--amber)"} strokeWidth="1.2" className="blip-ping" />
              <circle cx={x} cy={y} r="4.5" fill={isCritical ? "var(--red)" : "var(--amber)"} />
              <polygon points={`${x},${y - 8} ${x + 7},${y + 4} ${x - 7},${y + 4}`} fill="none" stroke={isCritical ? "var(--red)" : "var(--amber)"} strokeWidth="0.8" />
            </g>
          ))}
        </svg>

        {hoveredTarget && (
          <div className="radar-target-hud">
            <div className="hud-target-badge">
              <span className={`status-dot ${hoveredTarget.severity?.toLowerCase() || "ok"}`} />
              <span>{hoveredTarget.type === "alert" ? `THREAT: ${hoveredTarget.severity}` : "MONITORED VAULT"}</span>
            </div>
            <div className="hud-target-title">{hoveredTarget.title}</div>
            <div className="hud-target-sub">{hoveredTarget.subtitle}</div>
          </div>
        )}
      </div>

      <div className="radar-telemetry-strip">
        <div className="telemetry-readout">
          <span className="readout-label">SWEEP FREQUENCY</span>
          <span className="readout-value">4.50s // 0.22 Hz</span>
        </div>
        <div className="telemetry-readout">
          <span className="readout-label">TARGETS TRACKED</span>
          <span className="readout-value">{vaults.length} VAULTS // {alerts.length} ALERTS</span>
        </div>
        <div className="telemetry-readout">
          <span className="readout-label">RADAR APERTURE</span>
          <span className="readout-value">360° PANOPTIC</span>
        </div>
      </div>
    </div>
  );
}

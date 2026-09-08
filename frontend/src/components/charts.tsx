import { relativeTime } from "@/lib/format";
import type { SecurityAlert } from "@/types";

export function Sparkline({ values }: { values: number[] }) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return <span className="section-meta">—</span>;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const points = clean
    .map((value, index) => `${(index / (clean.length - 1)) * 92},${24 - ((value - min) / range) * 20}`)
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 92 26" aria-label="Share price trend" role="img">
      <polyline points={points} fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SeriesPoint = { x: number; y: number; label: string };

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return value.toFixed(value < 10 ? 4 : 2);
}

export function LineChart({ points, unit }: { points: SeriesPoint[]; unit: string }) {
  if (points.length < 2) {
    return <div className="empty">Not enough snapshots yet to plot a trend.</div>;
  }
  const width = 760;
  const height = 240;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const dataMinY = Math.min(...ys);
  const dataMaxY = Math.max(...ys);
  const yPad = (dataMaxY - dataMinY || dataMaxY || 1) * 0.15;
  const minY = dataMinY - yPad;
  const maxY = dataMaxY + yPad;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const toX = (x: number) => padLeft + ((x - minX) / spanX) * plotW;
  const toY = (y: number) => padTop + plotH - ((y - minY) / spanY) * plotH;

  const scaled = points.map((p) => ({ ...p, sx: toX(p.x), sy: toY(p.y) }));
  const line = scaled.map((p) => `${p.sx},${p.sy}`).join(" ");
  const area = `${toX(minX)},${padTop + plotH} ${line} ${toX(maxX)},${padTop + plotH}`;
  const step = Math.max(1, Math.floor(scaled.length / 60));

  const yTicks = niceTicks(minY, maxY, 4);
  const xTicks = points.length > 2 ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]] : points;

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Share price history">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={toY(t)} y2={toY(t)} stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : "3 4"} />
          <text x={padLeft - 8} y={toY(t)} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
            {formatTick(t)}
          </text>
        </g>
      ))}

      <line x1={padLeft} x2={padLeft} y1={padTop} y2={padTop + plotH} stroke="var(--line)" strokeWidth="1" />

      {xTicks.map((p, i) => (
        <text key={i} x={toX(p.x)} y={height - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="chart-axis-label">
          {`#${p.x}`}
        </text>
      ))}

      <polygon points={area} fill="url(#lineFill)" stroke="none" />
      <polyline points={line} fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scaled.filter((_, i) => i % step === 0 || i === scaled.length - 1).map((p, i) => (
        <circle key={i} cx={p.sx} cy={p.sy} r="3.5" fill="var(--bg)" stroke="var(--cyan)" strokeWidth="2">
          <title>{`${p.label}\n${p.y} ${unit}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function Meter({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const band = score >= 90 ? "healthy" : score >= 70 ? "observe" : score >= 40 ? "warning" : "critical";
  return (
    <div
      className={`meter meter-${size} meter-${band}`}
      title="Risk score: 100 minus 35 per critical alert and 12 per warning alert recorded on-chain for this vault."
    >
      <div className="meter-track"><div className="meter-fill" style={{ width: `${score}%` }} /></div>
      <span className="meter-value">{score}</span>
    </div>
  );
}

export function HealthDistribution({ counts }: { counts: Record<string, number> }) {
  const order: { key: string; label: string; className: string }[] = [
    { key: "healthy", label: "Healthy", className: "healthy" },
    { key: "observe", label: "Observe", className: "observe" },
    { key: "warning", label: "Warning", className: "warning" },
    { key: "critical", label: "Critical", className: "critical" },
  ];
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;
  const segments = order.filter((entry) => counts[entry.key] > 0);

  return (
    <div className="health-distribution">
      <div className="stack-bar">
        {segments.map((entry) => (
          <div
            key={entry.key}
            className={`stack-segment ${entry.className}`}
            style={{ width: `${(counts[entry.key] / total) * 100}%` }}
            title={`${counts[entry.key]} ${entry.label}`}
          />
        ))}
      </div>
      <div className="stack-legend">
        {order.map((entry) => (
          <div key={entry.key} className="stack-legend-item">
            <span className={`legend-dot ${entry.className}`} />
            {entry.label} <strong>{counts[entry.key] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IncidentTimeline({ alerts, vaultCount }: { alerts: SecurityAlert[]; vaultCount: number }) {
  if (alerts.length === 0) {
    return (
      <div className="all-clear">
        <div className="all-clear-mark">✓</div>
        <div className="all-clear-title">ALL SYSTEMS NORMAL</div>
        <p className="all-clear-copy">
          No anomalous ERC-4626 behavior detected across {vaultCount} monitored vault{vaultCount === 1 ? "" : "s"}.
        </p>
        <div className="all-clear-meta">Live feed · refreshes every 15s</div>
      </div>
    );
  }

  const times = alerts.map((a) => Number(a.timestamp));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min;

  return (
    <div className="timeline">
      <div className="timeline-track">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`timeline-dot ${alert.severity.toLowerCase()}`}
            style={{ left: span > 0 ? `${((Number(alert.timestamp) - min) / span) * 100}%` : "50%" }}
            title={`${alert.severity} · ${alert.vault.name} · ${alert.alertType} · ${relativeTime(alert.timestamp)}`}
          />
        ))}
      </div>
      {span > 0 ? (
        <div className="timeline-range">
          <span>{relativeTime(String(min))}</span>
          <span>{relativeTime(String(max))}</span>
        </div>
      ) : (
        <div className="timeline-range timeline-range-single">
          <span>{relativeTime(String(min))}</span>
        </div>
      )}
    </div>
  );
}

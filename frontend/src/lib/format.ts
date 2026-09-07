export function formatUnits(value: string, decimals: number): string {
  const raw = BigInt(value);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction.slice(0, 4)}` : whole.toString();
}

export function formatCompact(value: string, decimals: number): string {
  const num = Number(value) / 10 ** decimals;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(num);
}

export function formatSharePrice(value: string): { short: string; full: string } {
  const num = Number(value);
  if (!Number.isFinite(num)) return { short: value, full: value };
  return { short: num.toFixed(6), full: value };
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTimestamp(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function relativeTime(unixSeconds: string): string {
  const deltaMs = Date.now() - Number(unixSeconds) * 1000;
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export type RiskBand = { label: string; className: string };

export function computeRiskScore(alerts: { severity: string }[]): number {
  let score = 100;
  for (const alert of alerts) {
    if (alert.severity === "CRITICAL") score -= 35;
    else if (alert.severity === "WARNING") score -= 12;
  }
  return Math.max(0, Math.min(100, score));
}

export function riskBand(score: number): RiskBand {
  if (score >= 90) return { label: "HEALTHY", className: "healthy" };
  if (score >= 70) return { label: "OBSERVE", className: "observe" };
  if (score >= 40) return { label: "WARNING", className: "warning" };
  return { label: "CRITICAL", className: "critical" };
}

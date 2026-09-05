export function formatUnits(value: string, decimals: number): string {
  const raw = BigInt(value);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction.slice(0, 4)}` : whole.toString();
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTimestamp(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

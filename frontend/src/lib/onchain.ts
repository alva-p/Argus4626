import type { VaultDetail } from "@/types";

const RPC_URL = process.env.ARGUS_RPC_URL ?? "https://ethereum-rpc.publicnode.com";

// ERC-4626 / ERC-20 read selectors — all zero-argument calls, so no ABI encoding needed.
const SELECTOR = {
  totalAssets: "0x01e1d114",
  totalSupply: "0x18160ddd",
  asset: "0x38d52e0f",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
  name: "0x06fdde03",
};

function ethCall(to: string, data: string) {
  return { method: "eth_call", params: [{ to, data }, "latest"] };
}

async function rpcBatch(requests: { method: string; params: unknown[] }[]): Promise<(string | null)[]> {
  const body = requests.map((r, id) => ({ jsonrpc: "2.0", id, ...r }));
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC request failed: ${response.status}`);
  const payload: Array<{ id: number; result?: string }> = await response.json();
  const byId = new Map(payload.map((p) => [p.id, p.result ?? null]));
  return requests.map((_, id) => byId.get(id) ?? null);
}

function decodeUint(hex: string | null): bigint {
  return !hex || hex === "0x" ? 0n : BigInt(hex);
}

function decodeAddress(hex: string | null): string {
  if (!hex || hex === "0x") return "0x0000000000000000000000000000000000000000";
  return "0x" + hex.slice(2).padStart(64, "0").slice(24);
}

function decodeString(hex: string | null): string {
  if (!hex) return "";
  const clean = hex.slice(2);
  if (clean.length < 128) return "";
  const len = parseInt(clean.slice(64, 128), 16);
  return Buffer.from(clean.slice(128, 128 + len * 2), "hex").toString("utf8");
}

// ponytail: no signature validation beyond "these calls returned data" — a
// non-ERC-4626 contract that happens to expose the same selectors would pass.
// Good enough for a demo lookup, not for anything security-relevant.
export async function getOnChainVaultSnapshot(address: string): Promise<VaultDetail | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  let vaultResults: (string | null)[];
  try {
    vaultResults = await rpcBatch([
      ethCall(address, SELECTOR.totalAssets),
      ethCall(address, SELECTOR.totalSupply),
      ethCall(address, SELECTOR.asset),
      ethCall(address, SELECTOR.decimals),
      ethCall(address, SELECTOR.symbol),
      ethCall(address, SELECTOR.name),
    ]);
  } catch {
    return null;
  }

  const [totalAssetsHex, totalSupplyHex, assetHex, decimalsHex, symbolHex, nameHex] = vaultResults;
  if (!totalAssetsHex || totalAssetsHex === "0x" || !totalSupplyHex || !assetHex || assetHex === "0x") {
    return null;
  }

  const totalAssets = decodeUint(totalAssetsHex);
  const totalSupply = decodeUint(totalSupplyHex);
  const assetAddress = decodeAddress(assetHex);
  const shareDecimals = decimalsHex ? Number(decodeUint(decimalsHex)) : 18;

  const [assetDecimalsHex, assetSymbolHex, blockHex] = await rpcBatch([
    ethCall(assetAddress, SELECTOR.decimals),
    ethCall(assetAddress, SELECTOR.symbol),
    { method: "eth_blockNumber", params: [] },
  ]).catch(() => [null, null, null]);

  const assetDecimals = assetDecimalsHex ? Number(decodeUint(assetDecimalsHex)) : 18;
  const sharePrice =
    totalSupply === 0n
      ? "0"
      : (Number(totalAssets) / 10 ** assetDecimals / (Number(totalSupply) / 10 ** shareDecimals)).toString();

  return {
    id: address.toLowerCase(),
    protocol: "Unindexed",
    name: decodeString(nameHex) || "Unindexed vault",
    symbol: decodeString(symbolHex) || "VAULT",
    assetAddress,
    assetSymbol: decodeString(assetSymbolHex) || "ASSET",
    assetDecimals,
    shareDecimals,
    totalAssets: totalAssets.toString(),
    totalSupply: totalSupply.toString(),
    sharePrice,
    lastUpdatedBlock: blockHex ? decodeUint(blockHex).toString() : "0",
    history: [],
    alerts: [],
  };
}

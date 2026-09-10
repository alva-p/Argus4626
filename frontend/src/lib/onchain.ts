import type { VaultDetail, VaultSnapshot } from "@/types";

const RPC_URL = process.env.ARGUS_RPC_URL ?? "https://ethereum-rpc.publicnode.com";

// 6 historical points plus the live one, spread over ~the last 7 days
// (12s/block on mainnet) — enough for a real trend line without hammering
// the public RPC with dozens of calls.
const HISTORY_POINTS = 6;
const HISTORY_LOOKBACK_BLOCKS = 50_000;

// ERC-4626 / ERC-20 read selectors — all zero-argument calls, so no ABI encoding needed.
const SELECTOR = {
  totalAssets: "0x01e1d114",
  totalSupply: "0x18160ddd",
  asset: "0x38d52e0f",
  decimals: "0x313ce567",
  symbol: "0x95d89b41",
  name: "0x06fdde03",
};

function ethCall(to: string, data: string, blockTag: string = "latest") {
  return { method: "eth_call", params: [{ to, data }, blockTag] };
}

async function rpcBatch(requests: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  const body = requests.map((r, id) => ({ jsonrpc: "2.0", id, ...r }));
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC request failed: ${response.status}`);
  const payload: Array<{ id: number; result?: unknown }> = await response.json();
  const byId = new Map(payload.map((p) => [p.id, p.result ?? null]));
  return requests.map((_, id) => byId.get(id) ?? null);
}

function decodeUint(hex: unknown): bigint {
  return typeof hex !== "string" || hex === "0x" ? 0n : BigInt(hex);
}

function decodeAddress(hex: unknown): string {
  if (typeof hex !== "string" || hex === "0x") return "0x0000000000000000000000000000000000000000";
  return "0x" + hex.slice(2).padStart(64, "0").slice(24);
}

function decodeString(hex: unknown): string {
  if (typeof hex !== "string") return "";
  const clean = hex.slice(2);
  if (clean.length < 128) return "";
  const len = parseInt(clean.slice(64, 128), 16);
  return Buffer.from(clean.slice(128, 128 + len * 2), "hex").toString("utf8");
}

function sharePriceOf(totalAssets: bigint, totalSupply: bigint, assetDecimals: number, shareDecimals: number): string {
  if (totalSupply === 0n) return "0";
  return (Number(totalAssets) / 10 ** assetDecimals / (Number(totalSupply) / 10 ** shareDecimals)).toString();
}

// ponytail: no signature validation beyond "these calls returned data" — a
// non-ERC-4626 contract that happens to expose the same selectors would pass.
// Good enough for a demo lookup, not for anything security-relevant.
export async function getOnChainVaultSnapshot(address: string): Promise<VaultDetail | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  let vaultResults: unknown[];
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
  if (typeof totalAssetsHex !== "string" || totalAssetsHex === "0x" || typeof totalSupplyHex !== "string" || typeof assetHex !== "string" || assetHex === "0x") {
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
  const currentBlock = decodeUint(blockHex);
  const sharePrice = sharePriceOf(totalAssets, totalSupply, assetDecimals, shareDecimals);

  const history = await getSharePriceHistory(address, currentBlock, assetDecimals, shareDecimals);
  history.unshift({
    id: `${address}-${currentBlock}`,
    blockNumber: currentBlock.toString(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
    totalAssets: totalAssets.toString(),
    totalSupply: totalSupply.toString(),
    sharePrice,
  });

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
    lastUpdatedBlock: currentBlock.toString(),
    history,
    alerts: [],
  };
}

// Reconstructs a share-price trend for a vault with no indexer behind it, by
// re-reading totalAssets/totalSupply at a handful of past blocks. A point at a
// block before the vault existed comes back empty and is dropped, not zeroed.
async function getSharePriceHistory(
  address: string,
  currentBlock: bigint,
  assetDecimals: number,
  shareDecimals: number
): Promise<VaultSnapshot[]> {
  if (currentBlock === 0n) return [];
  const step = BigInt(Math.floor(HISTORY_LOOKBACK_BLOCKS / (HISTORY_POINTS - 1)));
  const blocks = Array.from({ length: HISTORY_POINTS - 1 }, (_, i) => {
    const target = currentBlock - step * BigInt(HISTORY_POINTS - 1 - i);
    return target > 0n ? target : 0n;
  }).filter((b, i, arr) => b > 0n && arr.indexOf(b) === i);

  if (blocks.length === 0) return [];

  let results: unknown[];
  try {
    results = await rpcBatch(
      blocks.flatMap((block) => {
        const tag = "0x" + block.toString(16);
        return [
          ethCall(address, SELECTOR.totalAssets, tag),
          ethCall(address, SELECTOR.totalSupply, tag),
          { method: "eth_getBlockByNumber", params: [tag, false] },
        ];
      })
    );
  } catch {
    return [];
  }

  const points: VaultSnapshot[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const [assetsHex, supplyHex, blockInfo] = results.slice(i * 3, i * 3 + 3);
    if (typeof assetsHex !== "string" || assetsHex === "0x" || typeof supplyHex !== "string") continue;
    const timestampHex = (blockInfo as { timestamp?: string } | null)?.timestamp;
    if (!timestampHex) continue;

    const totalAssets = decodeUint(assetsHex);
    const totalSupply = decodeUint(supplyHex);
    points.push({
      id: `${address}-${blocks[i]}`,
      blockNumber: blocks[i].toString(),
      timestamp: decodeUint(timestampHex).toString(),
      totalAssets: totalAssets.toString(),
      totalSupply: totalSupply.toString(),
      sharePrice: sharePriceOf(totalAssets, totalSupply, assetDecimals, shareDecimals),
    });
  }
  return points.reverse();
}

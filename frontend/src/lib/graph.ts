import type { DashboardData, VaultDetail } from "@/types";

const endpoint =
  process.env.ARGUS_GRAPH_ENDPOINT ??
  "https://api.studio.thegraph.com/query/1758674/argus-4626-ethereum-mainnet/0.1.2";

const query = `
  query Dashboard {
    _meta { block { number } }
    vaults(first: 10, orderBy: protocol, orderDirection: asc) {
      id
      protocol
      name
      symbol
      assetSymbol
      assetDecimals
      shareDecimals
      totalAssets
      totalSupply
      sharePrice
      lastUpdatedBlock
      snapshots(first: 12, orderBy: timestamp, orderDirection: asc) {
        sharePrice
        timestamp
      }
    }
    securityAlerts(first: 20, orderBy: blockNumber, orderDirection: desc) {
      id
      severity
      alertType
      description
      blockNumber
      timestamp
      transactionHash
      vault { id name }
    }
  }
`;

export async function getDashboardData(): Promise<DashboardData> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: 15 },
  });

  if (!response.ok) throw new Error(`Graph request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);

  return {
    block: payload.data._meta.block.number,
    vaults: payload.data.vaults,
    alerts: payload.data.securityAlerts,
  };
}

const vaultQuery = `
  query VaultDetail($id: ID!) {
    vault(id: $id) {
      id
      protocol
      name
      symbol
      assetAddress
      assetSymbol
      assetDecimals
      shareDecimals
      totalAssets
      totalSupply
      sharePrice
      lastUpdatedBlock
      snapshots(first: 200, orderBy: blockNumber, orderDirection: desc) {
        id
        blockNumber
        timestamp
        totalAssets
        totalSupply
        sharePrice
      }
      alerts(first: 50, orderBy: blockNumber, orderDirection: desc) {
        id
        severity
        alertType
        description
        blockNumber
        timestamp
        transactionHash
        vault { id name }
      }
    }
  }
`;

export async function getVaultDetail(id: string): Promise<VaultDetail | null> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: vaultQuery, variables: { id } }),
    next: { revalidate: 15 },
  });

  if (!response.ok) throw new Error(`Graph request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  if (!payload.data.vault) return null;

  const { snapshots, alerts, ...vault } = payload.data.vault;
  return { ...vault, history: snapshots, alerts };
}

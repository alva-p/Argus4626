export type Snapshot = {
  sharePrice: string;
  timestamp: string;
};

export type Vault = {
  id: string;
  protocol: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  assetDecimals: number;
  shareDecimals: number;
  totalAssets: string;
  totalSupply: string;
  sharePrice: string;
  lastUpdatedBlock: string;
  snapshots: Snapshot[];
};

export type SecurityAlert = {
  id: string;
  severity: string;
  alertType: string;
  description: string;
  blockNumber: string;
  timestamp: string;
  transactionHash: string;
  vault: { id: string; name: string };
};

export type DashboardData = {
  block: string;
  vaults: Vault[];
  alerts: SecurityAlert[];
};

export type VaultSnapshot = {
  id: string;
  blockNumber: string;
  timestamp: string;
  totalAssets: string;
  totalSupply: string;
  sharePrice: string;
};

export type VaultDetail = Omit<Vault, "snapshots"> & {
  assetAddress: string;
  history: VaultSnapshot[];
  alerts: SecurityAlert[];
};

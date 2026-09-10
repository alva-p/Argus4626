import { getVaultDetail } from "@/lib/graph";
import { VaultDetailView } from "@/components/vault-detail-view";

const VAULT_ID = "0x18c5a7ab3602680dd18fb5f074c3662f473c93f1";
const SEPOLIA_ENDPOINT =
  process.env.ARGUS_SEPOLIA_GRAPH_ENDPOINT ??
  "https://api.studio.thegraph.com/query/1758674/argus-4626-sepolia-demo/v0.2.0";

export default async function LiquidityDemoPage() {
  const vault = await getVaultDetail(VAULT_ID, SEPOLIA_ENDPOINT);

  if (!vault) {
    return (
      <main className="content">
        <a className="section-meta" href="/">← Back to overview</a>
        <div className="error">Liquidity drain demo vault not found — check ARGUS_SEPOLIA_GRAPH_ENDPOINT.</div>
      </main>
    );
  }

  return <VaultDetailView vault={vault} etherscanBase="https://sepolia.etherscan.io" />;
}

import { getVaultDetail } from "@/lib/graph";
import { VaultDetailView } from "@/components/vault-detail-view";

const SEPOLIA_VAULT = "0x099cab8f6b806b99cdab9fb120ae8d684f8e6ddd";
const SEPOLIA_ENDPOINT =
  process.env.ARGUS_SEPOLIA_GRAPH_ENDPOINT ??
  "https://api.studio.thegraph.com/query/1758674/argus-4626-sepolia-demo/v0.1.0";

export default async function SepoliaDemoPage() {
  const vault = await getVaultDetail(SEPOLIA_VAULT, SEPOLIA_ENDPOINT);

  if (!vault) {
    return (
      <main className="content">
        <a className="section-meta" href="/">← Back to overview</a>
        <div className="error">Sepolia demo vault not found — check ARGUS_SEPOLIA_GRAPH_ENDPOINT.</div>
      </main>
    );
  }

  return <VaultDetailView vault={vault} etherscanBase="https://sepolia.etherscan.io" />;
}

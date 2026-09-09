import { getVaultDetail } from "@/lib/graph";
import { getOnChainVaultSnapshot } from "@/lib/onchain";
import { VaultDetailView } from "@/components/vault-detail-view";

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lowerId = id.toLowerCase();
  const vault = await getVaultDetail(lowerId);

  if (vault) return <VaultDetailView vault={vault} />;

  const liveVault = await getOnChainVaultSnapshot(lowerId);
  if (liveVault) return <VaultDetailView vault={liveVault} live />;

  return (
    <main className="content">
      <a className="section-meta" href="/">← Back to overview</a>
      <div className="error">Vault {id} is not indexed and doesn&apos;t look like a live ERC-4626 vault.</div>
    </main>
  );
}

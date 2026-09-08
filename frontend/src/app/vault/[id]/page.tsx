import { getVaultDetail } from "@/lib/graph";
import { VaultDetailView } from "@/components/vault-detail-view";

export default async function VaultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vault = await getVaultDetail(id.toLowerCase());

  if (!vault) {
    return (
      <main className="content">
        <a className="section-meta" href="/">← Back to overview</a>
        <div className="error">Vault {id} not found in the indexed dataset.</div>
      </main>
    );
  }

  return <VaultDetailView vault={vault} />;
}

import { supabase } from '@/lib/supabaseClient'
import PageShell from '@/components/ui/PageShell'
import FabricsSettings, { type FabricRow } from '@/components/FabricsSettings'
import PartyKindSettings from '@/components/PartyKindSettings'
import { fetchParties } from '@/lib/queries'

export const revalidate = 0

async function getFabrics(): Promise<FabricRow[]> {
  const { data, error } = await supabase
    .from('fabrics')
    .select('id, name, unit')
    .order('name')

  if (error) {
    console.error('fabrics settings:', error.message)
    return []
  }
  return (data as FabricRow[]) ?? []
}

export default async function AyarlarPage() {
  const [parties, fabrics] = await Promise.all([fetchParties(), getFabrics()])

  return (
    <PageShell
      narrow
      title="Ayarlar"
      subtitle="Kumaş, tedarikçi ve müşteri tanımları"
    >
      <FabricsSettings initialFabrics={fabrics} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PartyKindSettings
          kind="tedarikci"
          title="Tedarikçiler"
          subtitle="Stok girişi · borç · başlangıç bakiyesi"
          initialParties={parties}
        />
        <PartyKindSettings
          kind="musteri"
          title="Müşteriler"
          subtitle="Stok çıkışı · alacak · başlangıç bakiyesi"
          initialParties={parties}
        />
      </div>
    </PageShell>
  )
}

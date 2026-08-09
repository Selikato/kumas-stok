import { supabase } from '@/lib/supabaseClient'
import PageHeader from '@/components/PageHeader'
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
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ayarlar</h1>
          <p className="text-sm text-gray-500 mt-1">Kumaş, tedarikçi ve müşteri tanımları</p>
        </div>

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
      </main>
    </div>
  )
}

import { supabase } from '@/lib/supabaseClient'
import PageHeader from '@/components/PageHeader'
import FabricTypesSettings, { type FabricType } from '@/components/FabricTypesSettings'
import FabricsSettings, { type FabricRow } from '@/components/FabricsSettings'
import PartyKindSettings from '@/components/PartyKindSettings'
import { fetchParties } from '@/lib/queries'

export const revalidate = 0

async function getFabricTypes(): Promise<{ types: FabricType[]; error: string | null }> {
  const { data, error } = await supabase
    .from('fabric_types')
    .select('id, name')
    .order('name')

  if (error) {
    console.error('fabric_types error:', error.message)
    return { types: [], error: error.message }
  }
  return { types: (data as FabricType[]) ?? [], error: null }
}

async function getFabrics(): Promise<FabricRow[]> {
  const { data, error } = await supabase
    .from('fabrics')
    .select('id, name, fabric_type, unit')
    .order('name')

  if (error) {
    console.error('fabrics settings:', error.message)
    return []
  }
  return (data as FabricRow[]) ?? []
}

export default async function AyarlarPage() {
  const [{ types, error }, parties, fabrics] = await Promise.all([
    getFabricTypes(),
    fetchParties(),
    getFabrics(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ayarlar</h1>
          <p className="text-sm text-gray-500 mt-1">Kumaş, tip, tedarikçi ve müşteri tanımları</p>
        </div>
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Veritabanı güncellemesi gerekli</p>
            <p className="text-amber-800 text-xs leading-relaxed">
              <code className="bg-amber-100 px-1 rounded">supabase/migrations/</code> altındaki SQL dosyalarını çalıştırın.
            </p>
            <p className="text-amber-700 text-xs font-mono break-all">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FabricTypesSettings initialTypes={types} />
          <FabricsSettings initialFabrics={fabrics} fabricTypes={types} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PartyKindSettings
            kind="tedarikci"
            title="Tedarikçiler"
            subtitle="Stok girişi ve borç carisi"
            initialParties={parties}
          />
          <PartyKindSettings
            kind="musteri"
            title="Müşteriler"
            subtitle="Stok çıkışı ve alacak carisi"
            initialParties={parties}
          />
        </div>
      </main>
    </div>
  )
}

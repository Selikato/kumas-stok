import { supabase } from '@/lib/supabaseClient'
import FabricList from '@/components/FabricList'
import PageHeader from '@/components/PageHeader'

export const revalidate = 0

export type Roll = {
  id: string
  roll_number: string | null
  lot_number: string | null
  quantity: number
  unit_price: number | null
  location: string | null
}

export type Variant = {
  id: string
  color_name: string
  color_code: string | null
  rolls: Roll[]
}

export type Fabric = {
  id: string
  name: string
  fabric_type: string | null
  unit: string | null
  variants: Variant[]
}

async function getFabrics(): Promise<Fabric[]> {
  const { data, error } = await supabase
    .from('fabrics')
    .select(`
      id,
      name,
      fabric_type,
      unit,
      variants (
        id,
        color_name,
        color_code,
        rolls (
          id,
          roll_number,
          lot_number,
          quantity,
          unit_price,
          location
        )
      )
    `)
    .order('name')

  if (error) {
    console.error('Supabase error:', error.message)
    return []
  }

  return (data as Fabric[]) ?? []
}

export default async function Home() {
  const fabrics = await getFabrics()

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FabricList fabrics={fabrics} />
      </main>
    </div>
  )
}

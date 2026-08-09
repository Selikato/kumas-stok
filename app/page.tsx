import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import FabricList from '@/components/FabricList'
import PageHeader from '@/components/PageHeader'
import PeriodSummary from '@/components/PeriodSummary'
import { totalValue } from '@/lib/fabricStats'
import { fetchMovements } from '@/lib/queries'
import { monthRange, summarizeMovements } from '@/lib/movements'
import type { Fabric, Roll } from '@/app/page-types'

export type { Fabric, Variant, Roll } from '@/app/page-types'

export const revalidate = 0

async function getFabrics(): Promise<Fabric[]> {
  const fullSelect = `
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
          location,
          received_at
        )
      )
    `

  const { data, error } = await supabase.from('fabrics').select(fullSelect).order('name')

  if (!error) return (data as Fabric[]) ?? []

  if (error.message.includes('received_at')) {
    const fallback = await supabase
      .from('fabrics')
      .select(`
      id, name, fabric_type, unit,
      variants (
        id, color_name, color_code,
        rolls ( id, roll_number, lot_number, quantity, unit_price, location )
      )
    `)
      .order('name')

    if (fallback.error) {
      console.error('Supabase error:', fallback.error.message)
      return []
    }

    const rows = (fallback.data ?? []) as Array<{
      id: string
      name: string
      fabric_type: string | null
      unit: string | null
      variants: Array<{
        id: string
        color_name: string
        color_code: string | null
        rolls: Array<Omit<Roll, 'received_at'>>
      }>
    }>

    return rows.map((f) => ({
      ...f,
      variants: f.variants.map((v) => ({
        ...v,
        rolls: v.rolls.map((r) => ({ ...r, received_at: null })),
      })),
    }))
  }

  console.error('Supabase error:', error.message)
  return []
}

export default async function Home() {
  const fabrics = await getFabrics()
  const { from, to } = monthRange()
  const movements = await fetchMovements({ from, to })
  const summary = summarizeMovements(movements)
  const stockValue = fabrics.reduce((s, f) => s + totalValue(f), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader fabrics={fabrics} showActions />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <PeriodSummary
          title="Bu ay özeti"
          girisTutar={summary.girisTutar}
          cikisMaliyet={summary.cikisMaliyet}
          girisQty={summary.girisQty}
          cikisQty={summary.cikisQty}
          movementCount={summary.count}
          stockValue={stockValue}
        />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-900">Stok durumu</h2>
          <Link href="/hareketler" className="text-xs font-medium text-gray-500 hover:text-gray-800">
            Tüm hareketler →
          </Link>
        </div>

        <FabricList fabrics={fabrics} />
      </main>
    </div>
  )
}

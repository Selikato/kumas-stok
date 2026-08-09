import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import FabricList from '@/components/FabricList'
import PageShell from '@/components/ui/PageShell'
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
      id, name, unit,
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
    <PageShell
      fabrics={fabrics}
      showActions
      title="Stok"
      subtitle="Bu ayın özeti ve güncel kumaş stokları"
    >
      <PeriodSummary
        title="Bu ay özeti"
        girisTutar={summary.girisTutar}
        cikisMaliyet={summary.cikisMaliyet}
        cikisSatis={summary.cikisSatis}
        girisQty={summary.girisQty}
        cikisQty={summary.cikisQty}
        movementCount={summary.count}
        stockValue={stockValue}
      />

      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h2 className="font-display text-2xl text-ink">Stok durumu</h2>
          <p className="text-xs text-muted mt-1">Kumaş bazında miktar ve değer</p>
        </div>
        <Link
          href="/hareketler"
          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          Tüm hareketler →
        </Link>
      </div>

      <FabricList fabrics={fabrics} />
    </PageShell>
  )
}

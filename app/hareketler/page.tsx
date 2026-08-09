import { Suspense } from 'react'
import PageHeader from '@/components/PageHeader'
import PeriodSummary from '@/components/PeriodSummary'
import MovementsTable from '@/components/MovementsTable'
import { fetchMovements } from '@/lib/queries'
import { monthRange, summarizeMovements } from '@/lib/movements'
import { totalValue } from '@/lib/fabricStats'
import { supabase } from '@/lib/supabaseClient'
import type { Fabric } from '@/app/page-types'

export const revalidate = 0

async function stockValueNow(): Promise<number> {
  const { data } = await supabase
    .from('fabrics')
    .select(`id, variants ( rolls ( quantity, unit_price ) )`)
  const fabrics = (data as Fabric[]) ?? []
  return fabrics.reduce((s, f) => s + totalValue(f), 0)
}

export default async function HareketlerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>
}) {
  const sp = await searchParams
  const defaults = monthRange()
  const from = sp.from || defaults.from
  const to = sp.to || defaults.to
  const type = sp.type || ''

  const movements = await fetchMovements({
    from,
    to,
    type: type || undefined,
  })
  const summary = summarizeMovements(movements)
  const stockValue = await stockValueNow()

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Hareket defteri</h1>
          <p className="text-sm text-gray-500 mt-1">Giriş / çıkış fişleri, maliyet ve tutarlar</p>
        </div>

        <PeriodSummary
          title="Filtrelenen dönem"
          girisTutar={summary.girisTutar}
          cikisMaliyet={summary.cikisMaliyet}
          girisQty={summary.girisQty}
          cikisQty={summary.cikisQty}
          movementCount={summary.count}
          stockValue={stockValue}
        />

        <Suspense fallback={<p className="text-sm text-gray-400">Yükleniyor…</p>}>
          <MovementsTable movements={movements} from={from} to={to} type={type} />
        </Suspense>
      </main>
    </div>
  )
}

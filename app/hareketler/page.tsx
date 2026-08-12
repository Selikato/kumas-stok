import { Suspense } from 'react'
import PageShell from '@/components/ui/PageShell'
import PeriodSummary from '@/components/PeriodSummary'
import MovementsTable from '@/components/MovementsTable'
import { fetchMovements } from '@/lib/queries'
import { monthRange, summarizeMovements, summarizeGirisEntries } from '@/lib/movements'
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
  const girisSummary = summarizeGirisEntries(movements)
  const stockValue = await stockValueNow()

  return (
    <PageShell
      title="Hareket defteri"
      subtitle="Giriş / çıkış fişleri, maliyet ve tutarlar"
    >
      <PeriodSummary
        title="Filtrelenen dönem"
        girisTutar={summary.girisTutar}
        cikisMaliyet={summary.cikisMaliyet}
        cikisSatis={summary.cikisSatis}
        girisQty={summary.girisQty}
        cikisQty={summary.cikisQty}
        movementCount={summary.count}
        stockValue={stockValue}
        girisSummary={girisSummary}
      />

      <Suspense fallback={<p className="text-sm text-muted">Yükleniyor…</p>}>
        <MovementsTable movements={movements} from={from} to={to} type={type} />
      </Suspense>
    </PageShell>
  )
}

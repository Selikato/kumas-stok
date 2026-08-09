import { formatMoney } from '@/lib/movements'
import { fmtQty } from '@/lib/helpers'

type Props = {
  title?: string
  girisTutar: number
  cikisMaliyet: number
  cikisSatis?: number
  girisQty: number
  cikisQty: number
  movementCount: number
  stockValue: number
}

export default function PeriodSummary({
  title = 'Bu ay',
  girisTutar,
  cikisMaliyet,
  cikisSatis = 0,
  girisQty,
  cikisQty,
  movementCount,
  stockValue,
}: Props) {
  const brutKar = cikisSatis - cikisMaliyet

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{movementCount} hareket · stok değeri anlık</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card label="Giriş tutarı" value={formatMoney(girisTutar)} />
        <Card label="Çıkış maliyeti" value={formatMoney(cikisMaliyet)} />
        <Card label="Çıkış satış" value={formatMoney(cikisSatis)} />
        <Card label="Brüt kâr (satış−maliyet)" value={formatMoney(brutKar)} highlight={brutKar >= 0} danger={brutKar < 0} />
        <Card label="Miktar G / Ç" value={`${fmtQty(girisQty)} / ${fmtQty(cikisQty)}`} />
        <Card label="Stok değeri" value={formatMoney(stockValue)} dark />
      </div>
    </section>
  )
}

function Card({
  label,
  value,
  dark,
  highlight,
  danger,
}: {
  label: string
  value: string
  dark?: boolean
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        dark
          ? 'bg-gray-900 border-gray-900'
          : 'bg-white border-gray-200'
      }`}
    >
      <p className={`text-[11px] uppercase tracking-wide ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
        {label}
      </p>
      <p
        className={`text-lg font-semibold mt-1 tabular-nums ${
          dark
            ? 'text-white'
            : danger
              ? 'text-red-600'
              : highlight
                ? 'text-emerald-700'
                : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

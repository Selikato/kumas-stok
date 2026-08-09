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
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          <p className="text-xs text-muted mt-0.5">{movementCount} hareket · stok değeri anlık</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card label="Giriş tutarı" value={formatMoney(girisTutar)} />
        <Card label="Çıkış maliyeti" value={formatMoney(cikisMaliyet)} />
        <Card label="Çıkış satış" value={formatMoney(cikisSatis)} />
        <Card
          label="Brüt kâr (satış−maliyet)"
          value={formatMoney(brutKar)}
          highlight={brutKar >= 0}
          danger={brutKar < 0}
        />
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
          ? 'bg-ink border-ink'
          : 'bg-surface border-line shadow-[0_1px_2px_rgba(15,28,46,0.04)]'
      }`}
    >
      <p
        className={`text-[10px] uppercase tracking-[0.12em] font-medium ${
          dark ? 'text-white/55' : 'text-muted'
        }`}
      >
        {label}
      </p>
      <p
        className={`text-lg font-semibold mt-1.5 tabular-nums tracking-tight ${
          dark
            ? 'text-white'
            : danger
              ? 'text-danger'
              : highlight
                ? 'text-ok'
                : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

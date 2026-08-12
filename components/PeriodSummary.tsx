import { formatMoney, type GirisEntrySummary } from '@/lib/movements'
import { fmtQty, formatTRDate, formatQtyWithUnit } from '@/lib/helpers'

type Props = {
  title?: string
  girisTutar: number
  cikisMaliyet: number
  cikisSatis?: number
  girisQty: number
  cikisQty: number
  movementCount: number
  stockValue: number
  girisSummary?: GirisEntrySummary
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
  girisSummary,
}: Props) {
  const brutKar = cikisSatis - cikisMaliyet

  return (
    <section className="space-y-4">
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

      {girisSummary && girisSummary.lines.length > 0 && (
        <GirisCalculationTable summary={girisSummary} />
      )}
    </section>
  )
}

function GirisCalculationTable({ summary }: { summary: GirisEntrySummary }) {
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
      <div className="px-4 py-3 border-b border-line bg-paper/50">
        <h3 className="text-sm font-medium text-ink">Giriş hesaplama</h3>
        <p className="text-[11px] text-muted mt-0.5">
          Miktar × fiyat = ara toplam · {summary.lines.length} giriş kaydı
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[32rem]">
          <thead>
            <tr className="border-b border-line bg-paper/40 text-left">
              <th className="px-4 py-2.5 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium">
                Kumaş / Tarih
              </th>
              <th className="px-4 py-2.5 font-mono-ui text-[11px] uppercase tracking-wider text-ok font-medium text-right w-28">
                Miktar
              </th>
              <th className="px-4 py-2.5 font-mono-ui text-[11px] uppercase tracking-wider text-danger font-medium text-right w-28">
                Fiyat
              </th>
              <th className="px-4 py-2.5 font-mono-ui text-[11px] uppercase tracking-wider text-out font-medium text-right w-36">
                Ara toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.lines.map((line) => (
              <tr key={line.id} className="hover:bg-paper/30 transition-colors">
                <td className="px-4 py-2.5 text-ink-soft">
                  <span className="font-medium text-ink block truncate max-w-[14rem]">
                    {line.fabric_name || 'Kumaş'}
                  </span>
                  <span className="text-[11px] text-muted">
                    {formatTRDate(line.occurred_at)}
                    {line.voucher_number ? ` · ${line.voucher_number}` : ''}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-ink">
                  {formatQtyWithUnit(line.amount, line.fabric_unit)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                  {line.unit_price != null ? formatMoney(line.unit_price) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-ink">
                  {formatMoney(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-paper/60">
              <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Özet
              </td>
              <td className="px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                  {summary.qtyLabel}
                </p>
                <p className="text-base font-bold tabular-nums text-ink mt-0.5">
                  {fmtQty(summary.totalQty)}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                  Ortalama fiyat
                </p>
                <p className="text-base font-bold tabular-nums text-ink mt-0.5">
                  {summary.avgPrice != null ? formatMoney(summary.avgPrice) : '—'}
                </p>
              </td>
              <td className="px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                  Genel toplam
                </p>
                <p className="text-base font-bold tabular-nums text-ink mt-0.5">
                  {formatMoney(summary.totalAmount)}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
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

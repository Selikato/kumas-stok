'use client'

import { formatBalance, type PartyStatementRow } from '@/lib/cari'
import { formatTRDate } from '@/lib/helpers'
import { formatMoneyKdv } from '@/lib/vat'
import { inputCls } from '@/lib/stockHelpers'

type Props = {
  rows: PartyStatementRow[]
  totalBorc: number
  totalAlacak: number
  closingBalance: number
  from: string
  to: string
  onRangeChange: (from: string, to: string) => void
}

function moneyCell(n: number) {
  if (!(n > 0.005)) return <span className="text-line">—</span>
  return formatMoneyKdv(n)
}

export default function CariStatementTable({
  rows,
  totalBorc,
  totalAlacak,
  closingBalance,
  from,
  to,
  onRangeChange,
}: Props) {
  const closing = formatBalance(closingBalance)

  return (
    <div>
      <form
        className="px-4 py-3 border-b border-line grid grid-cols-2 sm:grid-cols-4 gap-2 items-end bg-paper/30"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Baş. tarihi</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onRangeChange(e.target.value, to)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Bitiş tarihi</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onRangeChange(from, e.target.value)}
            className={inputCls}
          />
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted p-6 text-center">Bu dönemde hareket yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="border-b border-line bg-paper/60 text-left">
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                  Tarih
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                  İşlem
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                  Fiş
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                  Açıklama
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                  Borç
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                  Alacak
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                  Bakiye
                </th>
                <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-center w-10">
                  B/A
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const b = formatBalance(r.balance)
                const ba =
                  Math.abs(r.balance) < 0.005 ? '—' : r.balance > 0 ? 'A' : 'B'
                return (
                  <tr
                    key={r.id}
                    className={r.isOpening ? 'bg-paper/40 italic' : 'hover:bg-paper/30'}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-ink-soft">
                      {r.occurred_at ? formatTRDate(r.occurred_at) : '—'}
                    </td>
                    <td className="px-3 py-2 text-ink font-medium">{r.label}</td>
                    <td className="px-3 py-2 font-mono-ui text-xs text-muted">{r.voucher || '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted max-w-[14rem] truncate" title={r.notes || ''}>
                      {r.notes || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-danger">
                      {moneyCell(r.borc)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ok">
                      {moneyCell(r.alacak)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-ink">
                      {formatMoneyKdv(b.amount)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center text-xs font-semibold ${
                        ba === 'A' ? 'text-ok' : ba === 'B' ? 'text-danger' : 'text-muted'
                      }`}
                    >
                      {ba}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink/20 bg-paper/70 font-medium">
                <td colSpan={4} className="px-3 py-2.5 text-ink">
                  Genel toplam ({rows.filter((r) => !r.isOpening).length} kayıt)
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-danger">
                  {formatMoneyKdv(totalBorc)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ok">
                  {formatMoneyKdv(totalAlacak)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {closing.amount === 0 ? formatMoneyKdv(0) : formatMoneyKdv(closing.amount)}
                </td>
                <td
                  className={`px-3 py-2.5 text-center text-xs font-semibold ${
                    closing.label === 'Alacak' ? 'text-ok' : closing.label === 'Borç' ? 'text-danger' : 'text-muted'
                  }`}
                >
                  {closing.amount === 0 ? '—' : closing.label === 'Alacak' ? 'A' : 'B'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

'use client'

import type { Fabric } from '@/app/page'
import type { MovementRow } from '@/lib/movements'
import {
  isGiris,
  movementMoney,
  movementTypeLabel,
  formatMovementMoney,
} from '@/lib/movements'
import { groupStockByLot } from '@/lib/fabricStats'
import { formatQtyWithUnit, formatTRDate } from '@/lib/helpers'
import { formatMoneyStock, KDV_LABEL } from '@/lib/vat'
import Badge from '@/components/ui/Badge'
import { sortRollsFifo } from '@/lib/fifo'

type Props = {
  fabric: Fabric
  movements: MovementRow[]
}

export default function FabricStockDetail({ fabric, movements }: Props) {
  const fabricMovements = movements
    .filter((m) => m.fabric_id === fabric.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))

  const lotGroups = groupStockByLot(fabric)
  const fifoRolls = sortRollsFifo(
    fabric.variants.flatMap((v) => v.rolls).filter((r) => (r.quantity ?? 0) > 0)
  )

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h4 className="text-[11px] uppercase tracking-wider text-muted font-medium">
            Kalan stok · parti bazında
          </h4>
          <span className="text-[10px] text-muted">Giriş maliyeti KDV hariç</span>
        </div>

        {lotGroups.length === 0 ? (
          <p className="text-sm text-muted italic">Aktif stok yok.</p>
        ) : (
          <div className="rounded-lg border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/50 text-left">
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                    Parti / Nereden
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                    Miktar
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                    Birim maliyet
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                    Stok değeri
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lotGroups.map((g) => (
                  <tr key={g.lotLabel} className="hover:bg-paper/30">
                    <td className="px-3 py-2.5 text-ink">
                      <span className="font-medium">{g.lotLabel}</span>
                      {g.rollCount > 1 && (
                        <span className="text-[11px] text-muted ml-1.5">· {g.rollCount} kayıt</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">
                      {formatQtyWithUnit(g.totalQty, fabric.unit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {g.avgUnitPrice != null ? formatMoneyStock(g.avgUnitPrice) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">
                      {g.totalValue > 0 ? formatMoneyStock(g.totalValue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fifoRolls.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted font-medium">
              Kayıt detayı (FIFO)
            </p>
            {fifoRolls.map((r, idx) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border px-3 py-2 bg-paper/30 border-line/80 text-muted"
              >
                <span className="w-5 h-5 rounded-full bg-surface border border-line text-[10px] font-mono-ui flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium text-ink">{r.lot_number || 'Parti yok'}</span>
                <span className="tabular-nums text-ink">{formatQtyWithUnit(r.quantity ?? 0, fabric.unit)}</span>
                {r.unit_price != null && (
                  <span className="tabular-nums">{formatMoneyStock(r.unit_price)}/birim</span>
                )}
                {r.received_at && (
                  <span className="tabular-nums">{formatTRDate(r.received_at)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h4 className="text-[11px] uppercase tracking-wider text-muted font-medium">
            Giriş / çıkış hareketleri
          </h4>
          <span className="text-[10px] text-muted">
            {fabricMovements.length} kayıt · alış/satış {KDV_LABEL.toLowerCase()}
          </span>
        </div>

        {fabricMovements.length === 0 ? (
          <p className="text-sm text-muted italic">Bu kumaş için hareket kaydı yok.</p>
        ) : (
          <div className="rounded-lg border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[36rem]">
              <thead>
                <tr className="border-b border-line bg-paper/50 text-left">
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                    Tarih
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                    Fiş
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                    Tür
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium">
                    Cari
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                    Miktar
                  </th>
                  <th className="px-3 py-2 font-mono-ui text-[10px] uppercase tracking-wider text-muted font-medium text-right">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fabricMovements.map((m) => {
                  const giris = isGiris(m.movement_type)
                  const money = movementMoney(m)
                  return (
                    <tr key={m.id} className="hover:bg-paper/30">
                      <td className="px-3 py-2.5 text-ink-soft whitespace-nowrap">
                        {formatTRDate(m.occurred_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono-ui text-xs text-muted">
                        {m.voucher_number || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={giris ? 'ok' : 'out'}>{movementTypeLabel(m.movement_type)}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted max-w-[8rem] truncate">
                        {m.party_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                        {formatQtyWithUnit(m.amount, fabric.unit)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">
                        {formatMovementMoney(m, money)}
                        {!giris && m.unit_cost != null && (
                          <div className="text-[10px] font-normal text-muted">
                            maliyet {formatMoneyStock(m.unit_cost)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

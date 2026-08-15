'use client'

import {
  formatBalance,
  creditAppliedOnSale,
  creditAppliedOnPurchase,
  netDueAfterSale,
  netDueAfterPurchase,
} from '@/lib/cari'
import { formatMoneyKdv } from '@/lib/vat'

type Props = {
  balance: number | null
  loading?: boolean
  mode: 'sale' | 'purchase'
  /** TRY cinsinden işlem tutarı; null ise özet gösterilmez */
  transactionTotal: number | null
}

/** Cari bakiye ve satış/alış sonrası net ödeme/tahsilat özeti (KDV dahil) */
export default function PartyBalanceHint({ balance, loading, mode, transactionTotal }: Props) {
  if (loading) {
    return (
      <p className="text-xs text-muted bg-paper/60 border border-line rounded-lg px-3 py-2">
        Cari bakiye yükleniyor…
      </p>
    )
  }

  if (balance == null) return null

  const { label, amount } = formatBalance(balance)
  const hasTx = transactionTotal != null && transactionTotal > 0.005

  const creditApplied =
    hasTx && mode === 'sale'
      ? creditAppliedOnSale(balance, transactionTotal!)
      : hasTx && mode === 'purchase'
        ? creditAppliedOnPurchase(balance, transactionTotal!)
        : 0

  const netDue =
    hasTx && mode === 'sale'
      ? netDueAfterSale(balance, transactionTotal!)
      : hasTx && mode === 'purchase'
        ? netDueAfterPurchase(balance, transactionTotal!)
        : null

  return (
    <div className="text-xs bg-paper/60 border border-line rounded-lg px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-muted">Mevcut cari:</span>
        {Math.abs(amount) < 0.005 ? (
          <span className="font-medium text-ink">Bakiye yok</span>
        ) : (
          <span className="font-medium text-ink tabular-nums">
            {label} {formatMoneyKdv(amount)}
          </span>
        )}
      </div>

      {hasTx && creditApplied > 0.005 && (
        <div className="flex flex-wrap items-baseline gap-x-2 text-accent">
          <span>Mahsup (alacak):</span>
          <span className="font-medium tabular-nums">{formatMoneyKdv(creditApplied)}</span>
        </div>
      )}

      {hasTx && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">{mode === 'sale' ? 'Satış tutarı:' : 'Alış tutarı:'}</span>
            <span className="font-medium text-ink tabular-nums">{formatMoneyKdv(transactionTotal!)}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 pt-1 border-t border-line/80">
            <span className="text-muted font-medium">
              {mode === 'sale' ? 'Tahsil edilecek:' : 'Ödenecek:'}
            </span>
            <span className="font-semibold text-ink tabular-nums">{formatMoneyKdv(netDue ?? 0)}</span>
          </div>
        </>
      )}
    </div>
  )
}

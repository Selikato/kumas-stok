'use client'

import { useEffect, useRef, useState } from 'react'
import type { MoneyCurrency } from '@/lib/money'
import { currencyLabel } from '@/lib/money'
import { inputCls } from '@/lib/stockHelpers'

type Props = {
  currency: MoneyCurrency
  fxRate: string
  onCurrencyChange: (c: MoneyCurrency) => void
  onFxRateChange: (v: string) => void
  disabled?: boolean
}

type FxMeta = {
  date?: string
  source?: string
  cached?: boolean
}

export default function CurrencyFields({
  currency,
  fxRate,
  onCurrencyChange,
  onFxRateChange,
  disabled,
}: Props) {
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError, setFxError] = useState<string | null>(null)
  const [fxMeta, setFxMeta] = useState<FxMeta | null>(null)

  const onFxRateChangeRef = useRef(onFxRateChange)
  onFxRateChangeRef.current = onFxRateChange

  const fetchingRef = useRef(false)

  async function loadFxRate() {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setFxLoading(true)
    setFxError(null)

    try {
      const res = await fetch('/api/fx/usd-try')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kur alınamadı.')
      onFxRateChangeRef.current(String(data.rateFormatted ?? data.rate))
      setFxMeta({ date: data.date, source: data.source, cached: data.cached })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kur alınamadı.'
      setFxError(msg)
      setFxMeta(null)
    } finally {
      fetchingRef.current = false
      setFxLoading(false)
    }
  }

  useEffect(() => {
    if (currency !== 'USD' || disabled) {
      setFxError(null)
      setFxMeta(null)
      return
    }

    let cancelled = false

    ;(async () => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      setFxLoading(true)
      setFxError(null)

      try {
        const res = await fetch('/api/fx/usd-try')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Kur alınamadı.')
        onFxRateChangeRef.current(String(data.rateFormatted ?? data.rate))
        setFxMeta({ date: data.date, source: data.source, cached: data.cached })
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Kur alınamadı.'
        setFxError(msg)
        setFxMeta(null)
      } finally {
        if (!cancelled) {
          fetchingRef.current = false
          setFxLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currency, disabled])

  return (
    <div className="rounded-lg border border-line bg-paper/40 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Para birimi</label>
          <select
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value as MoneyCurrency)}
            className={inputCls}
            disabled={disabled}
          >
            <option value="TRY">TL (₺)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        {currency === 'USD' ? (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-medium text-muted">
                Kur (1 USD = ? TL) <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                onClick={() => void loadFxRate()}
                disabled={disabled || fxLoading}
                className="text-[10px] text-accent hover:text-accent-hover font-medium disabled:opacity-50"
                title="Kuru yenile"
              >
                {fxLoading ? 'Çekiliyor…' : 'Yenile'}
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              step="any"
              value={fxRate}
              onChange={(e) => {
                onFxRateChange(e.target.value)
                setFxError(null)
              }}
              placeholder={fxLoading ? 'Kur çekiliyor…' : 'ör. 34.50'}
              className={inputCls}
              disabled={disabled}
            />
          </div>
        ) : (
          <div className="flex items-end pb-2">
            <p className="text-[11px] text-muted">Tutarlar TL olarak kaydedilir.</p>
          </div>
        )}
      </div>
      {currency === 'USD' && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted">
            Girilen fiyat {currencyLabel('USD')} cinsinden; sistem TL’ye çevirir ({currencyLabel('TRY')}).
            {fxMeta && !fxLoading && (
              <span className="text-ink-soft">
                {' '}
                · Kur internetten otomatik çekildi
                {fxMeta.cached ? ' (önbellek)' : ''}
                {fxMeta.source ? ` · ${fxMeta.source}` : ''}
              </span>
            )}
          </p>
          {fxError && (
            <p className="text-[11px] text-danger">
              {fxError} Gerekirse kuru elle girebilirsiniz.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

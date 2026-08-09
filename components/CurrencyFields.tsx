'use client'

import type { MoneyCurrency } from '@/lib/money'
import { currencyLabel } from '@/lib/money'
import { inputCls } from '@/lib/stockHelpers'

type Props = {
  currency: MoneyCurrency
  fxRate: string
  onCurrencyChange: (c: MoneyCurrency) => void
  onFxRateChange: (v: string) => void
  disabled?: boolean
  /** Fiyat alanı etiketine eklenecek birim ipucu için */
  priceLabel?: string
}

/** Para birimi + (USD ise) kur alanı */
export default function CurrencyFields({
  currency,
  fxRate,
  onCurrencyChange,
  onFxRateChange,
  disabled,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Para birimi</label>
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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Kur (1 USD = ? TL) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0.01"
            step="any"
            value={fxRate}
            onChange={(e) => onFxRateChange(e.target.value)}
            placeholder="ör. 34.50"
            className={inputCls}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="flex items-end pb-2">
          <p className="text-[11px] text-gray-400">Tutarlar TL olarak kaydedilir.</p>
        </div>
      )}
      {currency === 'USD' && (
        <p className="col-span-2 text-[11px] text-gray-400 -mt-1">
          Girilen fiyat {currencyLabel('USD')} cinsinden; sistem TL’ye çevirir ({currencyLabel('TRY')}).
        </p>
      )}
    </div>
  )
}

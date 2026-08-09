import { parsePositiveNumber } from '@/lib/helpers'

export type MoneyCurrency = 'TRY' | 'USD'

export function currencyLabel(c: MoneyCurrency): string {
  return c === 'USD' ? 'USD' : 'TL'
}

export function currencySymbol(c: MoneyCurrency): string {
  return c === 'USD' ? '$' : '₺'
}

/** Orijinal tutarı TRY’ye çevir. USD ise kur > 0 zorunlu. */
export function toTry(
  amount: number,
  currency: MoneyCurrency,
  fxRate: number | null | undefined
): { tryAmount: number; fxRate: number } {
  if (!(amount >= 0) || Number.isNaN(amount)) {
    throw new Error('Geçersiz tutar.')
  }
  if (currency === 'TRY') {
    return { tryAmount: amount, fxRate: 1 }
  }
  const fx = Number(fxRate)
  if (!(fx > 0) || Number.isNaN(fx)) {
    throw new Error('USD için geçerli kur giriniz.')
  }
  return { tryAmount: amount * fx, fxRate: fx }
}

export function parseFxRate(raw: string): number | null {
  const n = parsePositiveNumber(raw)
  return n
}

export function fxNote(currency: MoneyCurrency, fxRate: number, original: number): string {
  if (currency === 'TRY') return ''
  return `USD ${original} × kur ${fxRate}`
}

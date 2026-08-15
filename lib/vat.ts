import { fmt } from '@/lib/helpers'

/** Türkiye tekstil için varsayılan KDV */
export const KDV_RATE = 0.1

export const KDV_LABEL = 'KDV dahil (%10)'

/** Net tutara %10 KDV ekler */
export function withKdv(net: number): number {
  return net * (1 + KDV_RATE)
}

/** Alış/satış satır tutarı — birim fiyat KDV hariç, cari ve hareket tutarı KDV dahil (%10) */
export function grossLineTotal(netUnitPrice: number, qty: number): number {
  return withKdv(netUnitPrice * qty)
}

/** Stok envanter fiyatları — KDV hariç */
export function formatMoneyStock(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `₺${fmt(n)}`
}

/** Cari ve alış/satış tutarları — DB'de KDV dahil saklanır */
export function formatMoneyKdv(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `₺${fmt(n)}`
}

export function formatEntryAmount(amount: number, _movementId?: string | null): string {
  return formatMoneyKdv(amount)
}

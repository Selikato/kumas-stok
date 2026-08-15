import { fmt } from '@/lib/helpers'
import { formatMoneyKdv, grossLineTotal } from '@/lib/vat'

export type MovementRow = {
  id: string
  roll_id: string
  occurred_at: string
  movement_type: string
  amount: number
  notes: string | null
  voucher_number: string | null
  unit_price: number | null
  unit_cost: number | null
  line_total: number | null
  party_id: string | null
  party_name?: string | null
  fabric_id?: string | null
  fabric_name?: string | null
  fabric_unit?: string | null
  roll_number?: string | null
}

export function movementTypeLabel(t: string): string {
  const u = t.toUpperCase()
  if (u === 'GIRIS' || u === 'IN') return 'Giriş'
  if (u === 'CIKIS' || u === 'OUT') return 'Çıkış'
  return t
}

export function isGiris(t: string): boolean {
  const u = t.toUpperCase()
  return u === 'GIRIS' || u === 'IN'
}

export function movementMoney(m: MovementRow): number | null {
  if (m.line_total != null) return Number(m.line_total)
  if (m.unit_price == null) return null
  // Birim fiyat KDV hariç; alış ve satış tutarı aynı şekilde KDV dahil
  return grossLineTotal(Number(m.unit_price), Number(m.amount))
}

/** Çıkış satırının stok maliyeti (alış birim fiyatı × miktar) */
export function movementCost(m: MovementRow): number | null {
  if (isGiris(m.movement_type)) return null
  if (m.unit_cost != null) return Number(m.amount) * Number(m.unit_cost)
  return null
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `₺${fmt(n)}`
}

/** Giriş/çıkış hareket tutarı — DB'de KDV dahil saklanır */
export function formatMovementMoney(m: MovementRow, money: number | null | undefined): string {
  if (money == null || Number.isNaN(money)) return '—'
  return formatMoneyKdv(money)
}

/** Ayın ilk ve son günü (local) */
export function monthRange(d = new Date()): { from: string; to: string } {
  const y = d.getFullYear()
  const m = d.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export function summarizeMovements(rows: MovementRow[]) {
  let girisQty = 0
  let cikisQty = 0
  let girisTutar = 0
  let cikisMaliyet = 0
  let cikisSatis = 0
  for (const m of rows) {
    if (isGiris(m.movement_type)) {
      girisQty += Number(m.amount)
      const money = movementMoney(m)
      if (money != null) girisTutar += money
    } else {
      cikisQty += Number(m.amount)
      const cost = movementCost(m)
      if (cost != null) cikisMaliyet += cost
      const sale = movementMoney(m)
      if (sale != null) cikisSatis += sale
    }
  }
  return { girisQty, cikisQty, girisTutar, cikisMaliyet, cikisSatis, count: rows.length }
}

export type GirisEntryLine = {
  id: string
  occurred_at: string
  fabric_name: string | null
  fabric_unit: string | null
  amount: number
  unit_price: number | null
  line_total: number
  voucher_number: string | null
}

export type GirisEntrySummary = {
  lines: GirisEntryLine[]
  totalQty: number
  totalAmount: number
  avgPrice: number | null
  qtyLabel: string
}

/** Bu ay girişleri — miktar × fiyat = ara toplam; dönem özeti tablosu */
export function summarizeGirisEntries(rows: MovementRow[]): GirisEntrySummary {
  const lines: GirisEntryLine[] = rows
    .filter((m) => isGiris(m.movement_type))
    .map((m) => {
      const amount = Number(m.amount)
      const unit_price = m.unit_price != null ? Number(m.unit_price) : null
      const line_total = unit_price != null ? amount * unit_price : 0
      return {
        id: m.id,
        occurred_at: m.occurred_at,
        fabric_name: m.fabric_name ?? null,
        fabric_unit: m.fabric_unit ?? null,
        amount,
        unit_price,
        line_total,
        voucher_number: m.voucher_number,
      }
    })
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id))

  let totalQty = 0
  let totalAmount = 0
  for (const line of lines) {
    totalQty += line.amount
    totalAmount += line.line_total
  }

  const units = new Set(lines.map((l) => l.fabric_unit).filter(Boolean))
  let qtyLabel = 'Toplam miktar'
  if (units.size === 1 && units.has('metre')) qtyLabel = 'Toplam metre'
  else if (units.size === 1 && units.has('kg')) qtyLabel = 'Toplam kg'

  return {
    lines,
    totalQty,
    totalAmount,
    avgPrice: totalQty > 0.005 ? totalAmount / totalQty : null,
    qtyLabel,
  }
}

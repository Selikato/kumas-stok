import { fmt } from '@/lib/helpers'

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
  // Giriş: alış tutarı; çıkış: satış tutarı (line_total)
  if (m.line_total != null) return Number(m.line_total)
  if (isGiris(m.movement_type) && m.unit_price != null) {
    return Number(m.amount) * Number(m.unit_price)
  }
  if (!isGiris(m.movement_type) && m.unit_price != null) {
    return Number(m.amount) * Number(m.unit_price)
  }
  return null
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

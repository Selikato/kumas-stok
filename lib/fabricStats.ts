import type { Fabric } from '@/app/page'

export function activeRolls(fabric: Fabric) {
  return fabric.variants.flatMap((v) => v.rolls).filter((r) => (r.quantity ?? 0) > 0)
}

export function totalRolls(fabric: Fabric): number {
  return activeRolls(fabric).length
}

export function totalQty(fabric: Fabric): number {
  return activeRolls(fabric).reduce((sum, r) => sum + r.quantity, 0)
}

export function totalValue(fabric: Fabric): number {
  return activeRolls(fabric).reduce(
    (sum, r) => sum + r.quantity * (r.unit_price ?? 0),
    0
  )
}

export function avgPrice(fabric: Fabric): number | null {
  const rolls = activeRolls(fabric).filter((r) => r.unit_price != null)
  if (rolls.length === 0) return null
  const totalQtyPriced = rolls.reduce((s, r) => s + r.quantity, 0)
  const totalVal = rolls.reduce((s, r) => s + r.quantity * (r.unit_price ?? 0), 0)
  return totalQtyPriced > 0 ? totalVal / totalQtyPriced : null
}

/** Aktif stok için "Nereden / Depo" özeti */
export function fabricRouteSummary(fabric: Fabric): string | null {
  const rolls = activeRolls(fabric)
  if (rolls.length === 0) return null

  const sources = [...new Set(rolls.map((r) => r.lot_number?.trim()).filter(Boolean))] as string[]
  const warehouses = [...new Set(rolls.map((r) => r.location?.trim()).filter(Boolean))] as string[]

  if (rolls.length === 1) {
    const r = rolls[0]
    const parts = [r.lot_number?.trim(), r.location?.trim()].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const parts: string[] = []
  if (sources.length === 1) parts.push(sources[0])
  else if (sources.length > 1) parts.push(`${sources.length} kaynak`)
  if (warehouses.length === 1) parts.push(warehouses[0])
  else if (warehouses.length > 1) parts.push(`${warehouses.length} depo`)
  return parts.length > 0 ? parts.join(' · ') : `${rolls.length} kayıt`
}

export type LotStockGroup = {
  lotLabel: string
  totalQty: number
  avgUnitPrice: number | null
  totalValue: number
  rollCount: number
}

/** Kalan stok — parti (lot/nereden) bazında miktar ve giriş maliyeti */
export function groupStockByLot(fabric: Fabric): LotStockGroup[] {
  const rolls = activeRolls(fabric)
  const map = new Map<string, { qty: number; value: number; pricedQty: number; rolls: number }>()

  for (const r of rolls) {
    const key = r.lot_number?.trim() || 'Parti belirtilmemiş'
    const qty = r.quantity ?? 0
    const price = r.unit_price ?? 0
    const cur = map.get(key) ?? { qty: 0, value: 0, pricedQty: 0, rolls: 0 }
    cur.qty += qty
    cur.rolls += 1
    if (r.unit_price != null) {
      cur.value += qty * price
      cur.pricedQty += qty
    }
    map.set(key, cur)
  }

  return [...map.entries()]
    .map(([lotLabel, g]) => ({
      lotLabel,
      totalQty: g.qty,
      avgUnitPrice: g.pricedQty > 0 ? g.value / g.pricedQty : null,
      totalValue: g.value,
      rollCount: g.rolls,
    }))
    .sort((a, b) => a.lotLabel.localeCompare(b.lotLabel, 'tr'))
}

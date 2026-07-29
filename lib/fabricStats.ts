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

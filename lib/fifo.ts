export type FifoRoll = {
  id: string
  quantity: number
  received_at?: string | null
  roll_number?: string | null
}

export function sortRollsFifo<T extends FifoRoll>(rolls: T[]): T[] {
  return [...rolls].sort((a, b) => {
    const da = a.received_at || ''
    const db = b.received_at || ''
    if (da && db && da !== db) return da.localeCompare(db)
    if (da && !db) return -1
    if (!da && db) return 1
    return (a.roll_number || a.id).localeCompare(b.roll_number || b.id, 'tr')
  })
}

export type FifoAllocation = {
  lines: { rollId: string; amount: number }[]
  /** Dağıtılamayan kalan miktar (stok yetersiz) */
  shortfall: number
}

/** Eski önce (FIFO) kuralıyla toplam miktarı rollere böler */
export function allocateFifo(rolls: FifoRoll[], totalAmount: number): FifoAllocation {
  const sorted = sortRollsFifo(rolls.filter((r) => (r.quantity ?? 0) > 0))
  let remaining = totalAmount
  const lines: { rollId: string; amount: number }[] = []

  for (const roll of sorted) {
    if (remaining <= 1e-9) break
    const take = Math.min(roll.quantity, remaining)
    if (take > 0) {
      lines.push({ rollId: roll.id, amount: take })
      remaining -= take
    }
  }

  return { lines, shortfall: remaining > 1e-9 ? remaining : 0 }
}

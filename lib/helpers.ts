export function generateRollNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `TOP-${date}-${time}-${rand}`
}

export function generateFabricCode(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12)
  const suffix = Date.now().toString().slice(-4)
  return `${slug || 'KUMAS'}-${suffix}`
}

export function fmt(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtQty(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

export type FabricUnit = 'metre' | 'kg'

export function unitLabel(unit: string | null | undefined): string {
  if (unit === 'kg') return 'kg'
  if (unit === 'metre') return 'm'
  return unit?.trim() || ''
}

export function formatQtyWithUnit(n: number, unit: string | null | undefined): string {
  const label = unitLabel(unit)
  return label ? `${fmtQty(n)} ${label}` : fmtQty(n)
}

/** YYYY-MM-DD for date inputs (local timezone) */
export function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTRDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

export function parsePositiveNumber(value: string): number | null {
  const n = parseFloat(value)
  if (!value.trim() || isNaN(n) || n <= 0) return null
  return n
}

export function parseNonNegativeNumber(value: string): number | null {
  const n = parseFloat(value)
  if (!value.trim() || isNaN(n) || n < 0) return null
  return n
}

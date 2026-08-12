/** USD/TRY döviz kuru — harici kaynaklardan (sunucu tarafı) */

export type FxQuote = {
  rate: number
  date?: string
  source: string
}

function parseRate(value: unknown): number | null {
  const n = Number(value)
  return n > 0 && !Number.isNaN(n) ? n : null
}

async function fromFrankfurter(): Promise<FxQuote | null> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as { rates?: { TRY?: number }; date?: string }
  const rate = parseRate(data.rates?.TRY)
  if (rate == null) return null
  return { rate, date: data.date, source: 'Frankfurter (ECB)' }
}

async function fromOpenErApi(): Promise<FxQuote | null> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    result?: string
    rates?: { TRY?: number }
    time_last_update_utc?: string
  }
  if (data.result !== 'success') return null
  const rate = parseRate(data.rates?.TRY)
  if (rate == null) return null
  return { rate, date: data.time_last_update_utc, source: 'open.er-api.com' }
}

export async function fetchUsdTryRate(): Promise<FxQuote> {
  const openEr = await fromOpenErApi().catch(() => null)
  if (openEr) return openEr

  const frankfurter = await fromFrankfurter().catch(() => null)
  if (frankfurter) return frankfurter

  throw new Error('Döviz kuru şu an alınamadı. Lütfen kuru elle girin.')
}

/** Input alanı için kur formatı (gereksiz sıfırları kırpar) */
export function formatFxRateInput(rate: number): string {
  const rounded = Math.round(rate * 10000) / 10000
  return String(rounded)
}

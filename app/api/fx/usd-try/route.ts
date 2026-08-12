import { NextResponse } from 'next/server'
import { fetchUsdTryRate, formatFxRateInput } from '@/lib/fxFetch'

let cache: { rate: number; date?: string; source: string; fetchedAt: number } | null = null
const CACHE_MS = 30 * 60 * 1000 // 30 dk

export async function GET() {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
      return NextResponse.json({
        rate: cache.rate,
        rateFormatted: formatFxRateInput(cache.rate),
        date: cache.date,
        source: cache.source,
        cached: true,
      })
    }

    const quote = await fetchUsdTryRate()
    cache = {
      rate: quote.rate,
      date: quote.date,
      source: quote.source,
      fetchedAt: Date.now(),
    }

    return NextResponse.json({
      rate: quote.rate,
      rateFormatted: formatFxRateInput(quote.rate),
      date: quote.date,
      source: quote.source,
      cached: false,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Kur alınamadı.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

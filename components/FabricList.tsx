'use client'

import { useState, useMemo } from 'react'
import type { Fabric } from '@/app/page'
import { fmt, formatQtyWithUnit, formatTRDate, unitLabel } from '@/lib/helpers'
import {
  totalRolls,
  totalQty,
  totalValue,
  avgPrice,
  fabricRouteSummary,
} from '@/lib/fabricStats'
import { inputCls } from '@/lib/stockHelpers'
import { sortRollsFifo } from '@/lib/fifo'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion'

export default function FabricList({ fabrics }: { fabrics: Fabric[] }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return fabrics
    return fabrics.filter((f) => f.name.toLowerCase().includes(q))
  }, [query, fabrics])

  const globalTotalValue = fabrics.reduce((s, f) => s + totalValue(f), 0)
  const metreTotal = fabrics
    .filter((f) => f.unit === 'metre')
    .reduce((s, f) => s + totalQty(f), 0)
  const kgTotal = fabrics
    .filter((f) => f.unit === 'kg')
    .reduce((s, f) => s + totalQty(f), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Kumaş" value={fabrics.length} />
        <StatCard label="Stok Topu" value={fabrics.reduce((s, f) => s + totalRolls(f), 0)} />
        <StatCard label="Toplam Metre" value={formatQtyWithUnit(metreTotal, 'metre')} />
        <StatCard label="Toplam Kg" value={formatQtyWithUnit(kgTotal, 'kg')} />
        <StatCard label="Toplam Stok Değeri" value={`₺${fmt(globalTotalValue)}`} highlight />
      </div>

      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Kumaş adı ile ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputCls} pl-9 pr-9`}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {query && (
        <p className="text-sm text-muted">
          <span className="text-ink font-medium">{filtered.length}</span> kumaş bulundu
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState hasQuery={!!query} hasAny={fabrics.length > 0} />
      ) : (
        <>
          <div className="hidden lg:grid grid-cols-[1.4fr_0.6fr_1fr_0.5fr_0.7fr_0.7fr_0.8fr] gap-3 px-5 py-2 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium">
            <span>Kumaş Adı</span>
            <span>Birim</span>
            <span>Nereden / Depo</span>
            <span className="text-right">Kayıt</span>
            <span className="text-right">Miktar</span>
            <span className="text-right">Ort. Fiyat</span>
            <span className="text-right pr-9">Toplam</span>
          </div>

          <Accordion value={expanded} onValueChange={setExpanded}>
            {filtered.map((fabric) => {
              const ap = avgPrice(fabric)
              const tv = totalValue(fabric)
              const route = fabricRouteSummary(fabric)

              return (
                <AccordionItem key={fabric.id} value={fabric.id}>
                  <AccordionTrigger>
                    {/* Mobil özet */}
                    <div className="lg:hidden">
                      <p className="font-semibold text-ink truncate">{fabric.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {unitLabel(fabric.unit) || '—'}
                        {tv > 0 ? ` · ₺${fmt(tv)}` : ''}
                      </p>
                      {route && <p className="text-xs text-muted mt-1.5 truncate">{route}</p>}
                      <p className="text-sm font-semibold text-ink tabular-nums mt-2">
                        {formatQtyWithUnit(totalQty(fabric), fabric.unit)}
                      </p>
                    </div>

                    {/* Masaüstü tablo satırı */}
                    <div className="hidden lg:grid grid-cols-[1.4fr_0.6fr_1fr_0.5fr_0.7fr_0.7fr_0.8fr] gap-3 items-center w-full text-sm pr-1">
                      <span className="font-semibold text-ink truncate">{fabric.name}</span>
                      <span className="text-xs text-muted">{unitLabel(fabric.unit) || '—'}</span>
                      <span className="text-xs text-muted truncate">{route || '—'}</span>
                      <span className="text-right font-semibold text-ink tabular-nums">
                        {totalRolls(fabric)}
                      </span>
                      <span className="text-right text-ink-soft tabular-nums">
                        {formatQtyWithUnit(totalQty(fabric), fabric.unit)}
                      </span>
                      <span className="text-right text-muted tabular-nums">
                        {ap != null ? `₺${fmt(ap)}` : '—'}
                      </span>
                      <span className="text-right font-medium text-ink tabular-nums">
                        {tv > 0 ? `₺${fmt(tv)}` : '—'}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-3">
                      Stok kayıtları · giriş tarihine göre
                    </p>
                    <VariantDetail variants={fabric.variants} unit={fabric.unit} />
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        highlight
          ? 'bg-ink border-ink'
          : 'bg-surface border-line shadow-[0_1px_2px_rgba(15,28,46,0.04)]'
      }`}
    >
      <p className={`text-[10px] uppercase tracking-[0.12em] font-medium ${highlight ? 'text-white/55' : 'text-muted'}`}>
        {label}
      </p>
      <p className={`text-xl font-semibold mt-1.5 tabular-nums ${highlight ? 'text-white' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function VariantDetail({
  variants,
  unit,
}: {
  variants: Fabric['variants']
  unit: string | null
}) {
  const rolls = sortRollsFifo(
    variants
      .flatMap((v) => v.rolls)
      .filter((r) => (r.quantity ?? 0) > 0)
  )

  if (rolls.length === 0) {
    return <p className="text-sm text-muted italic">Aktif stok kaydı yok.</p>
  }

  return (
    <div className="space-y-2">
      {rolls.map((r, idx) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border px-3 py-2.5 bg-paper/40 border-line/80 text-muted"
        >
          <span
            className="shrink-0 w-5 h-5 rounded-full bg-surface border border-line text-[10px] font-mono-ui flex items-center justify-center text-muted"
            title="Giriş sırası (eski önce)"
          >
            {idx + 1}
          </span>
          {r.received_at && (
            <span className="font-medium text-ink tabular-nums">{formatTRDate(r.received_at)}</span>
          )}
          {r.roll_number && <span className="font-mono-ui text-ink-soft">{r.roll_number}</span>}
          <span className="font-medium text-ink tabular-nums">{formatQtyWithUnit(r.quantity ?? 0, unit)}</span>
          {r.unit_price != null && <span className="tabular-nums">₺{fmt(r.unit_price)}</span>}
          {r.lot_number && <span>Nereden: {r.lot_number}</span>}
          {r.location && <span>Depo: {r.location}</span>}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ hasQuery, hasAny }: { hasQuery: boolean; hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-surface rounded-xl border border-line">
      <div className="w-10 h-10 bg-paper-deep rounded-full flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </div>
      {hasQuery ? (
        <>
          <p className="text-sm font-medium text-ink-soft">Arama sonucu yok</p>
          <p className="text-xs text-muted mt-1">Farklı bir kumaş adı deneyin.</p>
        </>
      ) : hasAny ? (
        <>
          <p className="text-sm font-medium text-ink-soft">Kumaş bulunamadı</p>
          <p className="text-xs text-muted mt-1">Liste boş görünüyor.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-soft">Henüz stok yok</p>
          <p className="text-xs text-muted mt-1">Başlamak için stok girişi yapın.</p>
        </>
      )}
    </div>
  )
}

'use client'

import React, { useState, useMemo } from 'react'
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

      <div className="hidden md:block bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
        {filtered.length === 0 ? (
          <EmptyState hasQuery={!!query} hasAny={fabrics.length > 0} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left bg-paper/60">
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium">
                  Kumaş Adı
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium">
                  Birim
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium">
                  Nereden / Depo
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                  Kayıt
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                  Toplam Miktar
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                  Ort. Fiyat
                </th>
                <th className="px-5 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                  Toplam Tutar
                </th>
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((fabric) => {
                const ap = avgPrice(fabric)
                const tv = totalValue(fabric)
                const route = fabricRouteSummary(fabric)
                const isOpen = expanded === fabric.id
                return (
                  <React.Fragment key={fabric.id}>
                    <tr
                      className={`transition-colors cursor-pointer ${isOpen ? 'bg-paper/50' : 'hover:bg-paper/40'}`}
                      onClick={() => setExpanded(isOpen ? null : fabric.id)}
                    >
                      <td className="px-5 py-3.5 font-medium text-ink">{fabric.name}</td>
                      <td className="px-5 py-3.5 text-xs text-muted">
                        {unitLabel(fabric.unit) || <span className="text-line">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {route ? (
                          <span className="text-muted text-xs">{route}</span>
                        ) : (
                          <span className="text-line">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums">
                        {totalRolls(fabric)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-ink-soft tabular-nums">
                        {formatQtyWithUnit(totalQty(fabric), fabric.unit)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted tabular-nums">
                        {ap != null ? `₺${fmt(ap)}` : <span className="text-line">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-ink tabular-nums">
                        {tv > 0 ? `₺${fmt(tv)}` : <span className="text-line">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-muted">
                        <svg
                          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-accent' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="bg-paper/40 px-5 py-4 border-b border-line">
                          <VariantDetail variants={fabric.variants} unit={fabric.unit} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <EmptyState hasQuery={!!query} hasAny={fabrics.length > 0} />
        ) : (
          filtered.map((fabric) => {
            const route = fabricRouteSummary(fabric)
            const isOpen = expanded === fabric.id
            return (
              <div
                key={fabric.id}
                className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]"
              >
                <button className="w-full text-left px-4 py-4" onClick={() => setExpanded(isOpen ? null : fabric.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{fabric.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {unitLabel(fabric.unit) || '—'}
                        {totalValue(fabric) > 0 ? ` · ₺${fmt(totalValue(fabric))}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted">Miktar</p>
                        <p className="font-semibold text-ink text-sm tabular-nums">
                          {formatQtyWithUnit(totalQty(fabric), fabric.unit)}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180 text-accent' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {route && (
                    <div className="mt-2.5">
                      <span className="text-xs text-muted">{route}</span>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-3 bg-paper/50">
                    <VariantDetail variants={fabric.variants} unit={fabric.unit} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
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
  const rolls = variants
    .flatMap((v) => v.rolls)
    .filter((r) => (r.quantity ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0))

  if (rolls.length === 0) {
    return <p className="text-sm text-muted italic">Aktif stok kaydı yok.</p>
  }

  return (
    <div className="space-y-2">
      {rolls.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border px-3 py-2 bg-surface border-line text-muted"
        >
          {r.roll_number && <span className="font-mono-ui text-ink-soft">{r.roll_number}</span>}
          <span className="font-medium text-ink tabular-nums">{formatQtyWithUnit(r.quantity ?? 0, unit)}</span>
          {r.unit_price != null && <span className="tabular-nums">₺{fmt(r.unit_price)}</span>}
          {r.lot_number && <span>Nereden: {r.lot_number}</span>}
          {r.location && <span>Depo: {r.location}</span>}
          {r.received_at && <span>Tarih: {formatTRDate(r.received_at)}</span>}
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

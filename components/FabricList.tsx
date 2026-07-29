'use client'

import React, { useState, useMemo, useCallback } from 'react'
import type { Fabric } from '@/app/page'
import StockInModal from './StockInModal'
import StockOutModal from './StockOutModal'
import ToastContainer, { type ToastData } from './Toast'
import { fmt, fmtQty } from '@/lib/helpers'
import {
  totalRolls,
  totalQty,
  totalValue,
  avgPrice,
  fabricRouteSummary,
  activeRolls,
} from '@/lib/fabricStats'

export default function FabricList({ fabrics }: { fabrics: Fabric[] }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [stockIn, setStockIn] = useState<Fabric | null>(null)
  const [stockOut, setStockOut] = useState<Fabric | null>(null)
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((message: string, type: ToastData['type']) => {
    setToasts((prev) => [...prev, { id: Date.now(), message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return fabrics
    return fabrics.filter((f) => f.name.toLowerCase().includes(q))
  }, [query, fabrics])

  const globalTotalValue = fabrics.reduce((s, f) => s + totalValue(f), 0)
  const pricedRolls = fabrics.flatMap((f) => activeRolls(f)).filter((r) => r.unit_price != null)
  const globalAvgPrice =
    pricedRolls.length > 0
      ? pricedRolls.reduce((s, r) => s + r.quantity * (r.unit_price ?? 0), 0) /
        pricedRolls.reduce((s, r) => s + r.quantity, 0)
      : null

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Kumaş" value={fabrics.length} />
          <StatCard label="Stok Topu" value={fabrics.reduce((s, f) => s + totalRolls(f), 0)} />
          <StatCard label="Toplam Miktar" value={fmtQty(fabrics.reduce((s, f) => s + totalQty(f), 0))} />
          <StatCard
            label="Toplam Stok Değeri"
            value={`₺${fmt(globalTotalValue)}`}
            highlight
          />
          <StatCard
            label="Ort. Fiyat / Adet"
            value={globalAvgPrice != null ? `₺${fmt(globalAvgPrice)}` : '—'}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Kumaş adı ile ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {query && (
          <p className="text-sm text-gray-400">
            <span className="text-gray-700 font-medium">{filtered.length}</span> kumaş bulundu
          </p>
        )}

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState hasQuery={!!query} hasAny={fabrics.length > 0} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-gray-50">
                  <th className="px-5 py-3 font-medium text-gray-500">Kumaş Adı</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Nereden / Depo</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Kayıt</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Toplam Miktar</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Ort. Fiyat</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">Toplam Tutar</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-right">İşlem</th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((fabric) => {
                  const ap = avgPrice(fabric)
                  const tv = totalValue(fabric)
                  const route = fabricRouteSummary(fabric)
                  return (
                    <React.Fragment key={fabric.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td
                          className="px-5 py-3.5 font-medium text-gray-900 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {fabric.name}
                        </td>
                        <td
                          className="px-5 py-3.5 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {route ? (
                            <span className="text-gray-600 text-xs">{route}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right font-semibold text-gray-900 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {totalRolls(fabric)}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right text-gray-700 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {totalQty(fabric)}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right text-gray-600 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {ap != null ? `₺${fmt(ap)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right font-medium text-gray-900 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          {tv > 0 ? `₺${fmt(tv)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ActionButton
                              variant="in"
                              onClick={() => setStockIn(fabric)}
                              title="Stok Girişi"
                            />
                            <ActionButton
                              variant="out"
                              onClick={() => setStockOut(fabric)}
                              title="Stok Çıkışı"
                              disabled={totalQty(fabric) <= 0}
                            />
                          </div>
                        </td>
                        <td
                          className="px-3 py-3.5 text-gray-300 cursor-pointer"
                          onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${expanded === fabric.id ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>

                      {expanded === fabric.id && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 px-5 py-4 border-b border-gray-100">
                            <VariantDetail variants={fabric.variants} />
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

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <EmptyState hasQuery={!!query} hasAny={fabrics.length > 0} />
          ) : (
            filtered.map((fabric) => {
              const route = fabricRouteSummary(fabric)
              return (
              <div key={fabric.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full text-left px-4 py-4"
                  onClick={() => setExpanded(expanded === fabric.id ? null : fabric.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{fabric.name}</p>
                      {totalValue(fabric) > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">₺{fmt(totalValue(fabric))}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Kayıt</p>
                        <p className="font-semibold text-gray-900 text-sm">{totalRolls(fabric)}</p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expanded === fabric.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {route && (
                      <span className="text-xs text-gray-500">{route}</span>
                    )}
                  </div>
                </button>

                <div className="flex items-center justify-end gap-3 px-4 pb-3">
                  <ActionButton variant="in" onClick={() => setStockIn(fabric)} title="Stok Girişi" />
                  <ActionButton
                    variant="out"
                    onClick={() => setStockOut(fabric)}
                    title="Stok Çıkışı"
                    disabled={totalQty(fabric) <= 0}
                  />
                </div>

                {expanded === fabric.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <VariantDetail variants={fabric.variants} />
                  </div>
                )}
              </div>
              )
            })
          )}
        </div>
      </div>

      {stockIn && (
        <StockInModal
          fabric={stockIn}
          onClose={() => setStockIn(null)}
          onSuccess={(msg) => addToast(msg, 'success')}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}
      {stockOut && (
        <StockOutModal
          fabric={stockOut}
          onClose={() => setStockOut(null)}
          onSuccess={(msg) => addToast(msg, 'success')}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
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
    <div className={`rounded-xl border px-4 py-4 ${highlight ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}>
      <p className={`text-xs uppercase tracking-wide ${highlight ? 'text-gray-400' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-xl font-semibold mt-1 ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function ActionButton({
  variant,
  onClick,
  title,
  disabled = false,
}: {
  variant: 'in' | 'out'
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={disabled ? 'Stok yok' : title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 hover:bg-gray-700 active:bg-black text-white transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        {variant === 'in' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
        )}
      </svg>
    </button>
  )
}

function VariantDetail({ variants }: { variants: Fabric['variants'] }) {
  const rolls = variants
    .flatMap((v) => v.rolls)
    .slice()
    .sort((a, b) => {
      const aActive = (a.quantity ?? 0) > 0 ? 1 : 0
      const bActive = (b.quantity ?? 0) > 0 ? 1 : 0
      return bActive - aActive
    })

  if (rolls.length === 0) {
    return <p className="text-sm text-gray-400 italic">Kayıt bulunmuyor.</p>
  }

  return (
    <div className="space-y-2">
      {rolls.map((r) => {
        const depleted = (r.quantity ?? 0) <= 0
        return (
          <div
            key={r.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg border px-3 py-2 ${
              depleted
                ? 'bg-gray-100 border-gray-100 text-gray-400'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {r.roll_number && <span className="font-mono">{r.roll_number}</span>}
            <span className={`font-medium ${depleted ? 'text-gray-400' : 'text-gray-900'}`}>
              {fmtQty(r.quantity ?? 0)}
            </span>
            {r.unit_price != null && <span>₺{fmt(r.unit_price)}</span>}
            {r.lot_number && <span>Nereden: {r.lot_number}</span>}
            {r.location && <span>Depo: {r.location}</span>}
            {depleted && <span className="ml-auto text-[10px] uppercase tracking-wide">Tükendi</span>}
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ hasQuery, hasAny }: { hasQuery: boolean; hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>
      {hasQuery ? (
        <>
          <p className="text-sm font-medium text-gray-600">Arama sonucu yok</p>
          <p className="text-xs text-gray-400 mt-1">Farklı bir kumaş adı deneyin.</p>
        </>
      ) : hasAny ? (
        <>
          <p className="text-sm font-medium text-gray-600">Kumaş bulunamadı</p>
          <p className="text-xs text-gray-400 mt-1">Liste boş görünüyor.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-600">Henüz kayıt yok</p>
          <p className="text-xs text-gray-400 mt-1">Başlamak için “Yeni Kayıt Ekle” butonunu kullanın.</p>
        </>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fmt, parsePositiveNumber, parseNonNegativeNumber, todayISODate, unitLabel, formatTRDate } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import type { Fabric, Roll } from '@/app/page'
import { totalQty } from '@/lib/fabricStats'
import type { Party } from '@/lib/cari'
import QuickPartyAdd from '@/components/QuickPartyAdd'

type Props = {
  open: boolean
  fabrics: Fabric[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

type FlatRoll = Roll & { variantName: string }

export default function StockOutModal({ open, fabrics, onClose, onSuccess, onError }: Props) {
  const router = useRouter()
  const stockedFabrics = useMemo(() => fabrics.filter((f) => totalQty(f) > 0), [fabrics])

  const [fabricId, setFabricId] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [partyId, setPartyId] = useState('')
  const [destination, setDestination] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISODate())
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const fabric = stockedFabrics.find((f) => f.id === fabricId) ?? null
  const customers = parties
    .filter((p) => p.kind === 'musteri' || p.kind === 'her_ikisi')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const allRolls: FlatRoll[] = useMemo(
    () =>
      fabric
        ? fabric.variants
            .flatMap((v) => v.rolls.map((r) => ({ ...r, variantName: v.color_name })))
            .filter((r) => (r.quantity ?? 0) > 0)
            .sort((a, b) => {
              // FIFO: eski giriş tarihi önce
              const da = a.received_at || ''
              const db = b.received_at || ''
              if (da && db && da !== db) return da.localeCompare(db)
              if (da && !db) return -1
              if (!da && db) return 1
              return (a.roll_number || '').localeCompare(b.roll_number || '', 'tr')
            })
        : [],
    [fabric]
  )

  const unit = unitLabel(fabric?.unit)
  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  useEffect(() => {
    if (!open) return
    setFabricId('')
    setSelected({})
    setAmounts({})
    setPartyId('')
    setDestination('')
    setSalePrice('')
    setOccurredAt(todayISODate())
    setError(null)
    setLoading(false)
    supabase
      .from('parties')
      .select('id, name, kind, phone, notes')
      .order('name')
      .then(({ data }) => setParties((data as Party[]) ?? []))
  }, [open])

  useEffect(() => {
    setSelected({})
    setAmounts({})
    setError(null)
  }, [fabricId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, loading])

  function toggleRoll(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
    setAmounts((prev) => {
      if (prev[id] != null) return prev
      const roll = allRolls.find((r) => r.id === id)
      return { ...prev, [id]: roll ? String(roll.quantity) : '' }
    })
  }

  function onPartyPick(value: string) {
    const party = customers.find((p) => p.id === value)
    setPartyId(value)
    setDestination(party?.name ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fabric) { setError('Kumaş seçiniz.'); return }
    if (selectedIds.length === 0) { setError('En az bir stok kaydı seçiniz.'); return }
    const party = customers.find((p) => p.id === partyId)
    if (!party) { setError('Müşteri seçiniz.'); return }
    const dest = party.name
    if (!occurredAt) { setError('Tarih zorunludur.'); return }

    const sale = salePrice.trim() ? parseNonNegativeNumber(salePrice) : null
    if (sale == null) { setError('Geçerli satış fiyatı giriniz.'); return }

    const lines: { rollId: string; amount: number }[] = []
    for (const rollId of selectedIds) {
      const amt = parsePositiveNumber(amounts[rollId] ?? '')
      if (amt == null) { setError('Seçili her kayıt için geçerli miktar giriniz.'); return }
      const roll = allRolls.find((r) => r.id === rollId)
      if (!roll) { setError('Seçili kayıt bulunamadı.'); return }
      if (amt > roll.quantity) {
        setError(`${roll.lot_number || roll.roll_number || 'Kayıt'}: mevcut miktardan fazla çıkış yapılamaz.`)
        return
      }
      lines.push({ rollId, amount: amt })
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stock/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricName: fabric.name,
          destination: dest,
          occurredAt,
          partyId: party.id,
          salePrice: sale,
          lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Çıkış yapılamadı.')

      router.refresh()
      onClose()

      const parts = [
        data.voucher_number,
        fabric.name,
        `${data.totalAmt}${unit ? ` ${unit}` : ''}`,
        `maliyet ₺${fmt(Number(data.totalCost || 0))}`,
      ]
      if (Number(data.totalSale) > 0) parts.push(`satış ₺${fmt(Number(data.totalSale))}`)
      parts.push(`→ ${dest}`)
      onSuccess(parts.filter(Boolean).join(' · '))
      if (data.failed > 0) onError(`${data.failed} kayıt işlenemedi.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      setError(msg)
      onError(msg)
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Kumaş Çıkışı</h2>
            <p className="text-xs text-gray-400 mt-0.5">Stoklar giriş tarihine göre (eski önce)</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kumaş <span className="text-red-500">*</span></label>
            {stockedFabrics.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Stoklu kumaş bulunmuyor.</p>
            ) : (
              <select value={fabricId} onChange={(e) => setFabricId(e.target.value)} className={inputCls} disabled={loading} autoFocus>
                <option value="">Seçiniz</option>
                {stockedFabrics.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.unit ? ` (${unitLabel(f.unit)})` : ''} — {totalQty(f)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {fabric && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Stok kayıtları <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">tarihe göre · maliyet = alış</span>
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
                  {allRolls.map((r) => {
                    const isOn = !!selected[r.id]
                    return (
                      <div key={r.id} className={`rounded-lg border px-3 py-2 ${isOn ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={isOn} onChange={() => toggleRoll(r.id)} disabled={loading} className="mt-1" />
                          <span className="flex-1 text-xs text-gray-700">
                            {r.roll_number && <span className="font-mono text-gray-500 block">{r.roll_number}</span>}
                            <span>
                              {r.lot_number ? `${r.lot_number}` : 'Kayıt'}
                              {` · ${r.quantity}${unit ? ` ${unit}` : ''}`}
                              {r.unit_price != null ? ` · maliyet ₺${fmt(r.unit_price)}` : ''}
                              {r.received_at ? ` · ${formatTRDate(r.received_at)}` : ''}
                            </span>
                          </span>
                        </label>
                        {isOn && (
                          <div className="mt-2 ml-6">
                            <input
                              type="number" min="0.01" step="any" max={r.quantity}
                              value={amounts[r.id] ?? ''}
                              onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              className={inputCls} disabled={loading} placeholder="Çıkış miktarı"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Müşteri <span className="text-red-500">*</span></label>
                <select value={partyId} onChange={(e) => onPartyPick(e.target.value)} className={inputCls} disabled={loading}>
                  <option value="">Seçiniz</option>
                  {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="mt-1">
                  <QuickPartyAdd
                    kind="musteri"
                    disabled={loading}
                    onCreated={(party) => {
                      setParties((prev) => [...prev, party].sort((a, b) => a.name.localeCompare(b.name, 'tr')))
                      setPartyId(party.id)
                      setDestination(party.name)
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tarih <span className="text-red-500">*</span></label>
                  <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} disabled={loading} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Satış fiyatı (₺) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="0" step="any" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0.00" className={inputCls} disabled={loading} />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">İptal</button>
            <button
              type="submit"
              disabled={loading || !fabric || selectedIds.length === 0}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg"
            >
              {loading ? 'İşleniyor…' : 'Çıkış Yap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fmt, parsePositiveNumber, parseNonNegativeNumber, todayISODate, unitLabel } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import { insertMovement, insertAccountEntry } from '@/lib/dbWrites'
import type { Fabric, Roll } from '@/app/page'
import { totalQty } from '@/lib/fabricStats'
import type { Party } from '@/lib/cari'

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

  const fabric = stockedFabrics.find((f) => f.id === fabricId) ?? null
  const customers = parties.filter((p) => p.kind === 'musteri' || p.kind === 'her_ikisi')

  const allRolls: FlatRoll[] = useMemo(
    () =>
      fabric
        ? fabric.variants
            .flatMap((v) => v.rolls.map((r) => ({ ...r, variantName: v.color_name })))
            .filter((r) => (r.quantity ?? 0) > 0)
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
    if (party) setDestination(party.name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fabric) { setError('Kumaş seçiniz.'); return }
    if (selectedIds.length === 0) { setError('En az bir stok kaydı seçiniz.'); return }
    const dest = destination.trim() || customers.find((p) => p.id === partyId)?.name || ''
    if (!dest) { setError('Müşteri seçin veya nereye gittiğini yazın.'); return }
    if (!occurredAt) { setError('Tarih zorunludur.'); return }

    const sale = salePrice.trim() ? parseNonNegativeNumber(salePrice) : null
    if (salePrice.trim() && sale == null) { setError('Geçerli satış fiyatı giriniz.'); return }
    if (partyId && sale == null) { setError('Cari alacak için satış fiyatı zorunludur.'); return }

    const lines: { rollId: string; amt: number; unitCost: number }[] = []
    for (const rollId of selectedIds) {
      const amt = parsePositiveNumber(amounts[rollId] ?? '')
      if (amt == null) { setError('Seçili her kayıt için geçerli miktar giriniz.'); return }
      const roll = allRolls.find((r) => r.id === rollId)
      if (!roll) { setError('Seçili kayıt bulunamadı.'); return }
      if (amt > roll.quantity) {
        setError(`${roll.lot_number || roll.roll_number || 'Kayıt'}: mevcut miktardan fazla çıkış yapılamaz.`)
        return
      }
      lines.push({ rollId, amt, unitCost: Number(roll.unit_price ?? 0) })
    }

    setLoading(true)
    setError(null)

    const succeeded: string[] = []
    const failed: string[] = []
    let totalCost = 0
    let totalSale = 0
    let lastVoucher = ''

    try {
      for (const line of lines) {
        const { data: fresh, error: fetchErr } = await supabase
          .from('rolls')
          .select('quantity, unit_price')
          .eq('id', line.rollId)
          .single()

        if (fetchErr || !fresh) { failed.push(line.rollId); continue }

        const currentQty = Number(fresh.quantity)
        if (line.amt > currentQty) { failed.push(line.rollId); continue }

        const unitCost = Number(fresh.unit_price ?? line.unitCost)
        const newQty = currentQty - line.amt
        const costTotal = line.amt * unitCost
        const saleTotal = sale != null ? line.amt * sale : null

        const { data: updated, error: updateErr } = await supabase
          .from('rolls')
          .update({ quantity: newQty })
          .eq('id', line.rollId)
          .gte('quantity', line.amt)
          .select('id')
          .maybeSingle()

        if (updateErr || !updated) { failed.push(line.rollId); continue }

        try {
          const mv = await insertMovement({
            roll_id: line.rollId,
            movement_type: 'CIKIS',
            amount: line.amt,
            occurred_at: occurredAt,
            notes: `Çıkış | Nereye: ${dest}${sale != null ? ` | Satış: ₺${sale}` : ''}`,
            party_id: partyId || null,
            unit_price: sale,
            unit_cost: unitCost,
            line_total: saleTotal ?? costTotal,
          })
          lastVoucher = mv.voucher_number
          totalCost += costTotal
          if (saleTotal != null) totalSale += saleTotal

          if (partyId && saleTotal != null && saleTotal > 0) {
            try {
              await insertAccountEntry({
                party_id: partyId,
                entry_type: 'alacak',
                amount: saleTotal,
                occurred_at: occurredAt,
                notes: `${fabric.name} satış · ${mv.voucher_number}`,
                movement_id: mv.id,
                voucher_number: mv.voucher_number,
              })
            } catch (cariErr) {
              console.error('cari alacak:', cariErr)
            }
          }
        } catch {
          await supabase.from('rolls').update({ quantity: currentQty }).eq('id', line.rollId)
          failed.push(line.rollId)
          continue
        }

        succeeded.push(line.rollId)
      }

      router.refresh()

      if (succeeded.length === 0) {
        throw new Error('Hiçbir çıkış yapılamadı. Stoklar güncellenmiş olabilir.')
      }

      const totalAmt = lines.filter((l) => succeeded.includes(l.rollId)).reduce((s, l) => s + l.amt, 0)
      const parts = [
        lastVoucher,
        `${fabric.name}`,
        `${totalAmt}${unit ? ` ${unit}` : ''}`,
        `maliyet ₺${fmt(totalCost)}`,
      ]
      if (totalSale > 0) parts.push(`satış ₺${fmt(totalSale)}`)
      parts.push(`→ ${dest}`)

      onClose()
      onSuccess(parts.filter(Boolean).join(' · '))
      if (failed.length > 0) onError(`${failed.length} kayıt işlenemedi.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      setError(msg)
      onError(msg)
    } finally {
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
            <p className="text-xs text-gray-400 mt-0.5">Top maliyeti (FIFO/özel) · satış fiyatı ile alacak</p>
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
                  <span className="text-gray-400 font-normal ml-1">maliyet = top alış fiyatı</span>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Müşteri / Cari</label>
                <select value={partyId} onChange={(e) => onPartyPick(e.target.value)} className={inputCls} disabled={loading}>
                  <option value="">Seçiniz (opsiyonel)</option>
                  {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {!partyId && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nereye Gitti <span className="text-red-500">*</span></label>
                  <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="ör. Kesimhane" className={inputCls} disabled={loading} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tarih <span className="text-red-500">*</span></label>
                  <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} disabled={loading} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Satış fiyatı (₺){partyId ? <span className="text-red-500">*</span> : null}
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

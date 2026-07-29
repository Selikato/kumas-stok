'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fmt, parsePositiveNumber } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import type { Fabric, Roll } from '@/app/page'

type Props = {
  fabric: Fabric
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

type FlatRoll = Roll & { variantName: string }

export default function StockOutModal({ fabric, onClose, onSuccess, onError }: Props) {
  const router = useRouter()

  const allRolls: FlatRoll[] = fabric.variants
    .flatMap((v) => v.rolls.map((r) => ({ ...r, variantName: v.color_name })))
    .filter((r) => (r.quantity ?? 0) > 0)

  const [rollId, setRollId] = useState(allRolls[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRoll = allRolls.find((r) => r.id === rollId)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rollId) { setError('Kayıt seçiniz.'); return }
    const amt = parsePositiveNumber(amount)
    if (amt == null) { setError('Geçerli bir miktar giriniz.'); return }
    if (!selectedRoll) { setError('Seçili kayıt bulunamadı.'); return }
    if (!destination.trim()) { setError('Malın nereye gittiği zorunludur.'); return }

    setLoading(true)
    setError(null)

    try {
      // Güncel miktarı DB'den oku (ekran verisi bayat olabilir)
      const { data: fresh, error: fetchErr } = await supabase
        .from('rolls')
        .select('quantity')
        .eq('id', rollId)
        .single()

      if (fetchErr) throw new Error(fetchErr.message)
      if (!fresh) throw new Error('Kayıt bulunamadı.')

      const currentQty = Number(fresh.quantity)
      if (amt > currentQty) {
        throw new Error(`Mevcut miktardan (${currentQty}) fazla çıkış yapılamaz.`)
      }

      const newQty = currentQty - amt

      const { data: updated, error: updateErr } = await supabase
        .from('rolls')
        .update({ quantity: newQty })
        .eq('id', rollId)
        .gte('quantity', amt)
        .select('id')
        .maybeSingle()

      if (updateErr) throw new Error(updateErr.message)
      if (!updated) throw new Error('Stok güncellenemedi. Başka bir işlem aynı anda yapılmış olabilir.')

      const { error: mvErr } = await supabase.from('stock_movements').insert({
        roll_id: rollId,
        movement_type: 'CIKIS',
        amount: amt,
        notes: `Çıkış | Nereye: ${destination.trim()}`,
      })

      if (mvErr) {
        await supabase.from('rolls').update({ quantity: currentQty }).eq('id', rollId)
        throw new Error(mvErr.message)
      }

      router.refresh()
      onClose()
      onSuccess(`${fabric.name} — ${amt} adet çıkış → ${destination.trim()}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Stok Çıkışı</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fabric.name}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Stok Kaydı <span className="text-red-500">*</span>
            </label>
            {allRolls.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                Bu kumaşa ait stoklu kayıt bulunmuyor.
              </p>
            ) : (
              <select
                value={rollId}
                onChange={(e) => setRollId(e.target.value)}
                className={inputCls}
                disabled={loading}
              >
                {allRolls.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.lot_number ? `Nereden: ${r.lot_number}` : 'Kayıt'}
                    {r.location ? ` · Depo: ${r.location}` : ''}
                    {` · ${r.quantity} adet`}
                    {r.unit_price != null ? ` · ₺${fmt(r.unit_price)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedRoll && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Mevcut Stok</span>
                <span className="font-semibold text-gray-900">{selectedRoll.quantity}</span>
              </div>
              {selectedRoll.lot_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Nereden</span>
                  <span className="text-gray-700">{selectedRoll.lot_number}</span>
                </div>
              )}
              {selectedRoll.location && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Depo</span>
                  <span className="text-gray-700">{selectedRoll.location}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Çıkış Miktarı <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="0.01" step="any" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0" className={inputCls} autoFocus disabled={loading || allRolls.length === 0}
            />
            {selectedRoll && amount && parsePositiveNumber(amount) != null && parsePositiveNumber(amount)! <= selectedRoll.quantity && (
              <p className="text-xs text-gray-400 mt-1">
                Kalan: <span className="font-medium text-gray-600">{(selectedRoll.quantity - parsePositiveNumber(amount)!).toFixed(2)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nereye Gitti <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="ör. Müşteri A / Kesimhane" className={inputCls}
              disabled={loading || allRolls.length === 0}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || allRolls.length === 0}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {loading ? 'İşleniyor…' : 'Çıkış Yap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

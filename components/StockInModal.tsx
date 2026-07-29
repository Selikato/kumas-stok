'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { generateRollNumber, parsePositiveNumber, parseNonNegativeNumber } from '@/lib/helpers'
import { getOrCreateVariant, inputCls } from '@/lib/stockHelpers'
import type { Fabric } from '@/app/page'

type Props = {
  fabric: Fabric
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export default function StockInModal({ fabric, onClose, onSuccess, onError }: Props) {
  const router = useRouter()
  const [variantId, setVariantId] = useState(fabric.variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [source, setSource] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showColorSelect = fabric.variants.some((v) => v.color_name !== 'Genel')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const qty = parsePositiveNumber(quantity)
    if (qty == null) { setError('Geçerli bir miktar giriniz.'); return }
    const price = parseNonNegativeNumber(unitPrice)
    if (price == null) { setError('Geçerli bir fiyat giriniz.'); return }
    if (!source.trim()) { setError('Malın nereden geldiği zorunludur.'); return }

    const warehouseValue = warehouse.trim() || 'Depo'

    setLoading(true)
    setError(null)

    try {
      const resolvedVariantId = variantId || await getOrCreateVariant(fabric.id)

      const { data: newRoll, error: rollErr } = await supabase.from('rolls').insert({
        variant_id: resolvedVariantId,
        roll_number: generateRollNumber(),
        lot_number: source.trim(),
        quantity: qty,
        unit_price: price,
        location: warehouseValue,
      }).select('id').single()

      if (rollErr) throw new Error(rollErr.message)

      const { error: mvErr } = await supabase.from('stock_movements').insert({
        roll_id: newRoll.id,
        movement_type: 'GIRIS',
        amount: qty,
        notes: `Giriş | Nereden: ${source.trim()} | Depo: ${warehouseValue}`,
      })

      if (mvErr) {
        await supabase.from('rolls').delete().eq('id', newRoll.id)
        throw new Error(mvErr.message)
      }

      router.refresh()
      onClose()
      onSuccess(`${fabric.name} — ${qty} adet stok girişi yapıldı.`)
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
            <h2 className="text-base font-semibold text-gray-900">Stok Girişi</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fabric.name}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {showColorSelect && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Renk</label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className={inputCls}
                disabled={loading}
              >
                {fabric.variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.color_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Miktar <span className="text-red-500">*</span>
              </label>
              <input type="number" min="0.01" step="any" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0" className={inputCls} autoFocus disabled={loading} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fiyat (₺) <span className="text-red-500">*</span>
              </label>
              <input type="number" min="0" step="any" value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00" className={inputCls} disabled={loading} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nereden Geldi <span className="text-red-500">*</span>
            </label>
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="ör. Tedarikçi A" className={inputCls} disabled={loading} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Depo Konumu
            </label>
            <input type="text" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}
              placeholder="ör. A-Raf-3 (boş bırakılırsa: Depo)" className={inputCls} disabled={loading} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
              İptal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors">
              {loading ? 'Kaydediliyor…' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

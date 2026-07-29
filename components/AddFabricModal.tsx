'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { generateFabricCode, generateRollNumber, parsePositiveNumber, parseNonNegativeNumber } from '@/lib/helpers'
import { getOrCreateVariant, inputCls } from '@/lib/stockHelpers'

type FormData = {
  name: string
  quantity: string
  unit_price: string
  source: string
  warehouse: string
}

const EMPTY: FormData = {
  name: '',
  quantity: '',
  unit_price: '',
  source: '',
  warehouse: '',
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export default function AddFabricModal({ open, onClose, onSuccess, onError }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setError(null)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, loading])

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) { setError('Kumaş adı zorunludur.'); return }
    const qty = parsePositiveNumber(form.quantity)
    if (qty == null) { setError('Geçerli bir miktar giriniz.'); return }
    const price = parseNonNegativeNumber(form.unit_price)
    if (price == null) { setError('Geçerli bir fiyat giriniz.'); return }
    if (!form.source.trim()) { setError('Malın nereden geldiği zorunludur.'); return }

    const warehouse = form.warehouse.trim() || 'Depo'

    setLoading(true)
    setError(null)

    try {
      let fabricId: string
      const { data: existing } = await supabase
        .from('fabrics')
        .select('id')
        .eq('name', form.name.trim())
        .maybeSingle()

      if (existing) {
        fabricId = existing.id
      } else {
        const { data: newFabric, error: fabricErr } = await supabase
          .from('fabrics')
          .insert({
            name: form.name.trim(),
            fabric_code: generateFabricCode(form.name),
          })
          .select('id')
          .single()

        if (fabricErr) throw new Error(fabricErr.message)
        fabricId = newFabric.id
      }

      const variantId = await getOrCreateVariant(fabricId)

      const { data: newRoll, error: rollErr } = await supabase
        .from('rolls')
        .insert({
          variant_id: variantId,
          roll_number: generateRollNumber(),
          lot_number: form.source.trim(),
          quantity: qty,
          unit_price: price,
          location: warehouse,
        })
        .select('id')
        .single()

      if (rollErr) throw new Error(rollErr.message)

      const { error: mvErr } = await supabase.from('stock_movements').insert({
        roll_id: newRoll.id,
        movement_type: 'GIRIS',
        amount: qty,
        notes: `Giriş | Nereden: ${form.source.trim()} | Depo: ${warehouse}`,
      })

      if (mvErr) {
        await supabase.from('rolls').delete().eq('id', newRoll.id)
        throw new Error(mvErr.message)
      }

      router.refresh()
      onClose()
      onSuccess(`${form.name.trim()} stoka eklendi.`)
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

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Yeni Kumaş Kaydı</h2>
            <p className="text-xs text-gray-400 mt-0.5">Stoka mal girişi</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Kumaş Adı" required>
            <input
              ref={firstInputRef}
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="ör. Pamuk Poplin"
              className={inputCls}
              disabled={loading}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Miktar" required>
              <input
                type="number"
                min="0.01"
                step="any"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="0"
                className={inputCls}
                disabled={loading}
              />
            </Field>
            <Field label="Fiyat (₺)" required>
              <input
                type="number"
                min="0"
                step="any"
                value={form.unit_price}
                onChange={(e) => set('unit_price', e.target.value)}
                placeholder="0.00"
                className={inputCls}
                disabled={loading}
              />
            </Field>
          </div>

          <Field label="Nereden Geldi" required>
            <input
              type="text"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              placeholder="ör. Tedarikçi A"
              className={inputCls}
              disabled={loading}
            />
          </Field>

          <Field label="Depo Konumu">
            <input
              type="text"
              value={form.warehouse}
              onChange={(e) => set('warehouse', e.target.value)}
              placeholder="ör. A-Raf-3 (boş bırakılırsa: Depo)"
              className={inputCls}
              disabled={loading}
            />
          </Field>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

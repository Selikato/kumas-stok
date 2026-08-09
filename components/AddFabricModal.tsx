'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  parsePositiveNumber,
  parseNonNegativeNumber,
  todayISODate,
  unitLabel,
  type FabricUnit,
} from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import type { Fabric } from '@/app/page'
import type { Party } from '@/lib/cari'

type FabricTypeOption = { id: string; name: string }

type FormData = {
  fabricId: string
  name: string
  fabric_type: string
  unit: FabricUnit | ''
  quantity: string
  unit_price: string
  partyId: string
  source: string
  warehouse: string
  occurred_at: string
}

const EMPTY: FormData = {
  fabricId: '',
  name: '',
  fabric_type: '',
  unit: '',
  quantity: '',
  unit_price: '',
  partyId: '',
  source: '',
  warehouse: '',
  occurred_at: todayISODate(),
}

type Props = {
  open: boolean
  fabrics?: Fabric[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export default function AddFabricModal({ open, fabrics = [], onClose, onSuccess, onError }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(EMPTY)
  const [fabricTypes, setFabricTypes] = useState<FabricTypeOption[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLSelectElement>(null)

  const selectedFabric = fabrics.find((f) => f.id === form.fabricId)
  const pickingExisting = form.fabricId !== '' && form.fabricId !== '__new__'
  const isNew = form.fabricId === '__new__' || (form.fabricId === '' && fabrics.length === 0)
  const suppliers = parties.filter((p) => p.kind === 'tedarikci' || p.kind === 'her_ikisi')

  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY,
      occurred_at: todayISODate(),
      fabricId: fabrics.length === 0 ? '__new__' : '',
    })
    setError(null)
    setTimeout(() => firstInputRef.current?.focus(), 50)

    supabase.from('fabric_types').select('id, name').order('name').then(async ({ data, error: typeErr }) => {
      if (!typeErr && data && data.length > 0) {
        setFabricTypes(data as FabricTypeOption[])
        return
      }
      const { data: fabricRows } = await supabase.from('fabrics').select('fabric_type')
      const names = [...new Set(
        (fabricRows ?? [])
          .map((f: { fabric_type: string | null }) => f.fabric_type?.trim())
          .filter((n): n is string => !!n)
      )].sort((a, b) => a.localeCompare(b, 'tr'))
      setFabricTypes(names.map((name) => ({ id: name, name })))
    })

    supabase
      .from('parties')
      .select('id, name, kind, phone, notes')
      .order('name')
      .then(({ data }) => setParties((data as Party[]) ?? []))
  }, [open, fabrics.length])

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

  function onFabricPick(value: string) {
    if (value === '__new__') {
      setForm((prev) => ({ ...prev, fabricId: '__new__', name: '', fabric_type: '', unit: '' }))
      return
    }
    if (value === '') {
      setForm((prev) => ({ ...prev, fabricId: '', name: '', fabric_type: '', unit: '' }))
      return
    }
    const fabric = fabrics.find((f) => f.id === value)
    if (!fabric) return
    setForm((prev) => ({
      ...prev,
      fabricId: fabric.id,
      name: fabric.name,
      fabric_type: fabric.fabric_type ?? '',
      unit: (fabric.unit as FabricUnit) || '',
    }))
  }

  function onPartyPick(value: string) {
    const party = suppliers.find((p) => p.id === value)
    setForm((prev) => ({
      ...prev,
      partyId: value,
      source: party ? party.name : prev.source,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.fabricId) { setError('Kumaş seçiniz veya yeni kumaş oluşturun.'); return }
    if (!form.name.trim()) { setError('Kumaş adı zorunludur.'); return }
    if (!form.occurred_at) { setError('Tarih zorunludur.'); return }
    const qty = parsePositiveNumber(form.quantity)
    if (qty == null) { setError('Geçerli bir miktar giriniz.'); return }
    const price = parseNonNegativeNumber(form.unit_price)
    if (price == null) { setError('Geçerli bir fiyat giriniz.'); return }
    const source = form.source.trim() || suppliers.find((p) => p.id === form.partyId)?.name || ''
    if (!source) { setError('Tedarikçi seçin veya nereden geldiğini yazın.'); return }

    if (!pickingExisting) {
      if (!form.fabric_type) { setError('Kumaş tipi zorunludur.'); return }
      if (!form.unit) { setError('Birim zorunludur.'); return }
    }

    const warehouse = form.warehouse.trim() || 'Depo'

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricId: pickingExisting ? form.fabricId : null,
          name: form.name.trim(),
          fabricType: form.fabric_type || undefined,
          unit: form.unit || undefined,
          quantity: qty,
          unitPrice: price,
          partyId: form.partyId || null,
          source,
          warehouse,
          occurredAt: form.occurred_at,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Giriş kaydedilemedi.')

      const unitSuffix = data.unit === 'kg' ? 'kg' : data.unit === 'metre' ? 'm' : ''
      router.refresh()
      onClose()
      onSuccess(
        `${data.voucher_number} · ${form.name.trim()} giriş${unitSuffix ? ` (${qty} ${unitSuffix})` : ''} · ₺${Number(data.lineTotal).toFixed(2)}`
      )
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
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Kumaş Girişi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fiş kesilir · tedarikçiye borç işlenir</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Kumaş" required>
            <select ref={firstInputRef} value={form.fabricId} onChange={(e) => onFabricPick(e.target.value)} className={inputCls} disabled={loading}>
              <option value="">Seçiniz</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.unit ? ` (${unitLabel(f.unit)})` : ''}</option>
              ))}
              <option value="__new__">+ Yeni kumaş</option>
            </select>
          </Field>

          {(isNew || form.fabricId === '__new__') && (
            <>
              <Field label="Kumaş Adı" required>
                <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ör. Pamuk Poplin" className={inputCls} disabled={loading} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kumaş Tipi" required>
                  <select value={form.fabric_type} onChange={(e) => set('fabric_type', e.target.value)} className={inputCls} disabled={loading}>
                    <option value="">Seçiniz</option>
                    {fabricTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Birim" required>
                  <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={inputCls} disabled={loading}>
                    <option value="">Seçiniz</option>
                    <option value="metre">Metre</option>
                    <option value="kg">Kg</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {pickingExisting && selectedFabric && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Birim: <span className="font-medium text-gray-800">{unitLabel(selectedFabric.unit) || '—'}</span>
              {selectedFabric.fabric_type ? <> · Tip: <span className="font-medium text-gray-800">{selectedFabric.fabric_type}</span></> : null}
            </p>
          )}

          <Field label="Tedarikçi">
            <select value={form.partyId} onChange={(e) => onPartyPick(e.target.value)} className={inputCls} disabled={loading}>
              <option value="">Seçiniz (opsiyonel)</option>
              {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {!form.partyId && (
            <Field label="Nereden Geldi" required>
              <input type="text" value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="ör. Tedarikçi A" className={inputCls} disabled={loading} />
            </Field>
          )}

          <Field label="Tarih" required>
            <input type="date" value={form.occurred_at} onChange={(e) => set('occurred_at', e.target.value)} className={inputCls} disabled={loading} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Miktar${pickingExisting && selectedFabric?.unit ? ` (${unitLabel(selectedFabric.unit)})` : form.unit ? ` (${unitLabel(form.unit)})` : ''}`} required>
              <input type="number" min="0.01" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="0" className={inputCls} disabled={loading} />
            </Field>
            <Field label="Alış fiyatı (₺)" required>
              <input type="number" min="0" step="any" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} placeholder="0.00" className={inputCls} disabled={loading} />
            </Field>
          </div>

          <Field label="Depo Konumu">
            <input type="text" value={form.warehouse} onChange={(e) => set('warehouse', e.target.value)} placeholder="ör. A-Raf-3" className={inputCls} disabled={loading} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">İptal</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg">
              {loading ? 'Kaydediliyor…' : 'Giriş Yap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

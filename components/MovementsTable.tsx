'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { MovementRow } from '@/lib/movements'
import {
  formatMoney,
  isGiris,
  movementMoney,
  movementTypeLabel,
} from '@/lib/movements'
import { formatQtyWithUnit, formatTRDate, parseNonNegativeNumber, unitLabel } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import { deleteMovementViaApi, updateMovementViaApi } from '@/lib/dbWrites'
import ConfirmDialog from '@/components/ConfirmDialog'

type Props = {
  movements: MovementRow[]
  from: string
  to: string
  type: string
}

export default function MovementsTable({ movements, from, to, type }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useState<MovementRow | null>(null)
  const [editTarget, setEditTarget] = useState<MovementRow | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const apply = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (!v) params.delete(k)
        else params.set(k, v)
      }
      startTransition(() => {
        router.push(`/hareketler?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  useEffect(() => {
    if (!editTarget) return
    setEditDate(editTarget.occurred_at?.slice(0, 10) || '')
    setEditPrice(editTarget.unit_price != null ? String(editTarget.unit_price) : '')
    setEditNotes(editTarget.notes || '')
  }, [editTarget])

  async function confirmDelete() {
    if (!target) return
    const label = target.voucher_number || target.id.slice(0, 8)
    setDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteMovementViaApi(target.id)
      setSuccess(`${label} silindi. Stok ve cari geri alındı.`)
      setTarget(null)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setDeleting(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    if (!editDate) {
      setError('Tarih zorunlu.')
      return
    }
    const price = editPrice.trim() === '' ? null : parseNonNegativeNumber(editPrice)
    if (editPrice.trim() !== '' && price == null) {
      setError('Geçerli birim fiyat giriniz.')
      return
    }

    const label = editTarget.voucher_number || editTarget.id.slice(0, 8)
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateMovementViaApi(editTarget.id, {
        occurred_at: editDate,
        notes: editNotes.trim() || null,
        unit_price: price,
      })
      setSuccess(`${label} güncellendi.`)
      setEditTarget(null)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1.5 w-full sm:w-auto sm:inline-flex">
        {(
          [
            { value: '', label: 'Tümü' },
            { value: 'GIRIS', label: 'Giriş' },
            { value: 'CIKIS', label: 'Çıkış' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            disabled={pending}
            onClick={() => apply({ type: tab.value, from, to })}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              type === tab.value
                ? tab.value === 'GIRIS'
                  ? 'bg-emerald-600 text-white'
                  : tab.value === 'CIKIS'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-gray-200 rounded-xl p-4"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          apply({
            from: String(fd.get('from') || ''),
            to: String(fd.get('to') || ''),
            type,
          })
        }}
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
          <input name="from" type="date" defaultValue={from} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
          <input name="to" type="date" defaultValue={to} className={inputCls} />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {pending ? '…' : 'Tarih filtrele'}
          </button>
          <Link
            href="/hareketler"
            className="py-2 px-3 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg"
          >
            Sıfırla
          </Link>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{success}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {movements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Bu filtrede hareket yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-gray-50 text-gray-500">
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Fiş</th>
                  <th className="px-4 py-3 font-medium">Tür</th>
                  <th className="px-4 py-3 font-medium">Kumaş</th>
                  <th className="px-4 py-3 font-medium">Cari</th>
                  <th className="px-4 py-3 font-medium text-right">Miktar</th>
                  <th className="px-4 py-3 font-medium text-right">Tutar</th>
                  <th className="px-4 py-3 font-medium text-right w-28">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => {
                  const giris = isGiris(m.movement_type)
                  const money = movementMoney(m)
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatTRDate(m.occurred_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{m.voucher_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                            giris ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {movementTypeLabel(m.movement_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        <div>{m.fabric_name || '—'}</div>
                        {m.roll_number && (
                          <div className="text-[11px] font-mono text-gray-400">{m.roll_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{m.party_name || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                        {formatQtyWithUnit(m.amount, m.fabric_unit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                        {formatMoney(money)}
                        {!giris && m.unit_cost != null && (
                          <div className="text-[10px] font-normal text-gray-400">
                            maliyet {unitLabel(m.fabric_unit) ? `/ ${unitLabel(m.fabric_unit)}` : ''} ₺{m.unit_cost}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null)
                              setEditTarget(m)
                            }}
                            disabled={deleting || saving}
                            className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null)
                              setTarget(m)
                            }}
                            disabled={deleting || saving}
                            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        danger
        loading={deleting}
        title="Hareketi sil"
        description="Bu işlem geri alınamaz. Stok miktarı ve bağlı cari kaydı da düzeltilir."
        confirmLabel="Evet, sil"
        cancelLabel="Vazgeç"
        onCancel={() => !deleting && setTarget(null)}
        onConfirm={confirmDelete}
      >
        {target && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Fiş</span>
              <span className="font-mono text-gray-900">{target.voucher_number || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Tür</span>
              <span className="text-gray-900">{movementTypeLabel(target.movement_type)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Kumaş</span>
              <span className="text-gray-900 text-right">{target.fabric_name || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Miktar</span>
              <span className="tabular-nums text-gray-900">
                {formatQtyWithUnit(target.amount, target.fabric_unit)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Tarih</span>
              <span className="text-gray-900">{formatTRDate(target.occurred_at)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && setEditTarget(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Hareketi düzenle</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">
                  {editTarget.voucher_number || editTarget.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setEditTarget(null)}
                disabled={saving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={saveEdit} className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500">
                {movementTypeLabel(editTarget.movement_type)} · {editTarget.fabric_name || '—'} ·{' '}
                {formatQtyWithUnit(editTarget.amount, editTarget.fabric_unit)}
                <span className="block mt-1 text-gray-400">Miktar değiştirilemez.</span>
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tarih <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={inputCls}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isGiris(editTarget.movement_type) ? 'Alış fiyatı (₺)' : 'Satış fiyatı (₺)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className={inputCls}
                  disabled={saving}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Not</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className={inputCls}
                  disabled={saving}
                  placeholder="Opsiyonel"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
                >
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

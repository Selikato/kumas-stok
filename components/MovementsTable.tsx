'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { MovementRow } from '@/lib/movements'
import {
  isGiris,
  movementMoney,
  movementTypeLabel,
  formatMovementMoney,
} from '@/lib/movements'
import { formatMoneyStock, KDV_LABEL } from '@/lib/vat'
import { formatQtyWithUnit, formatTRDate, parseNonNegativeNumber, unitLabel } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import { deleteMovementViaApi, updateMovementViaApi } from '@/lib/dbWrites'
import ConfirmDialog from '@/components/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import ModalFrame from '@/components/ui/ModalFrame'
import Panel from '@/components/ui/Panel'

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
      <div className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 w-full sm:w-auto sm:inline-flex shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
        {(
          [
            { value: '', label: 'Tümü', tone: 'neutral' as const },
            { value: 'GIRIS', label: 'Giriş', tone: 'ok' as const },
            { value: 'CIKIS', label: 'Çıkış', tone: 'out' as const },
          ] as const
        ).map((tab) => {
          const active = type === tab.value
          return (
            <button
              key={tab.value || 'all'}
              type="button"
              disabled={pending}
              onClick={() => apply({ type: tab.value, from, to })}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                active
                  ? tab.value === 'GIRIS'
                    ? 'bg-ok text-white'
                    : tab.value === 'CIKIS'
                      ? 'bg-danger text-white'
                      : 'bg-ink text-surface'
                  : 'text-muted hover:bg-paper-deep/70'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <Panel>
        <form
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
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
          <Field label="Başlangıç">
            <input name="from" type="date" defaultValue={from} className={inputCls} />
          </Field>
          <Field label="Bitiş">
            <input name="to" type="date" defaultValue={to} className={inputCls} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" fullWidth disabled={pending}>
              {pending ? '…' : 'Tarih filtrele'}
            </Button>
            <Link
              href="/hareketler"
              className="py-2.5 px-3 text-sm text-muted hover:text-ink border border-line rounded-lg bg-surface"
            >
              Sıfırla
            </Link>
          </div>
        </form>
      </Panel>

      {error && (
        <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-ok bg-ok-soft border border-ok/20 rounded-lg px-3 py-2">{success}</p>
      )}

      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
        {movements.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">Bu filtrede hareket yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="border-b border-line text-left bg-paper/80 backdrop-blur-sm">
                  {['Tarih', 'Fiş', 'Tür', 'Kumaş', 'Cari'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                    Miktar
                  </th>
                  <th className="px-4 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                    Tutar
                    <span className="block font-normal normal-case tracking-normal text-[10px] text-muted/80">
                      alış/satış {KDV_LABEL.toLowerCase()}
                    </span>
                  </th>
                  <th className="px-4 py-3 font-mono-ui text-[11px] uppercase tracking-wider text-muted font-medium text-right w-28">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {movements.map((m) => {
                  const giris = isGiris(m.movement_type)
                  const money = movementMoney(m)
                  return (
                    <tr key={m.id} className="hover:bg-paper/40 transition-colors">
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatTRDate(m.occurred_at)}</td>
                      <td className="px-4 py-3 font-mono-ui text-xs text-muted">{m.voucher_number || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={giris ? 'ok' : 'out'}>{movementTypeLabel(m.movement_type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <div>{m.fabric_name || '—'}</div>
                        {m.roll_number && (
                          <div className="text-[11px] font-mono-ui text-muted">{m.roll_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{m.party_name || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                        {formatQtyWithUnit(m.amount, m.fabric_unit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-ink">
                        {formatMovementMoney(m, money)}
                        {!giris && m.unit_cost != null && (
                          <div className="text-[10px] font-normal text-muted">
                            maliyet {formatMoneyStock(m.unit_cost)}
                            {unitLabel(m.fabric_unit) ? ` / ${unitLabel(m.fabric_unit)}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null)
                              setEditTarget(m)
                            }}
                            disabled={deleting || saving}
                            className="text-xs font-medium text-muted hover:text-ink px-2 py-1.5 rounded-md hover:bg-paper-deep disabled:opacity-40"
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
                            className="text-xs font-medium text-danger hover:bg-danger-soft px-2 py-1.5 rounded-md disabled:opacity-40"
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
          <div className="rounded-xl border border-line bg-paper/50 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-muted">Fiş</span>
              <span className="font-mono-ui text-ink">{target.voucher_number || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Tür</span>
              <span className="text-ink">{movementTypeLabel(target.movement_type)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Kumaş</span>
              <span className="text-ink text-right">{target.fabric_name || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Miktar</span>
              <span className="tabular-nums text-ink">
                {formatQtyWithUnit(target.amount, target.fabric_unit)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">Tarih</span>
              <span className="text-ink">{formatTRDate(target.occurred_at)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ModalFrame
        open={!!editTarget}
        title="Hareketi düzenle"
        subtitle={editTarget ? editTarget.voucher_number || editTarget.id.slice(0, 8) : undefined}
        onClose={() => !saving && setEditTarget(null)}
        loading={saving}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditTarget(null)} disabled={saving}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={saving}
              onClick={() => {
                const formEl = document.getElementById('edit-mv-form') as HTMLFormElement | null
                formEl?.requestSubmit()
              }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        }
      >
        {editTarget && (
          <form id="edit-mv-form" onSubmit={saveEdit} className="space-y-4">
            <p className="text-xs text-muted">
              {movementTypeLabel(editTarget.movement_type)} · {editTarget.fabric_name || '—'} ·{' '}
              {formatQtyWithUnit(editTarget.amount, editTarget.fabric_unit)}
              <span className="block mt-1 text-muted/80">Miktar değiştirilemez.</span>
            </p>
            <Field label="Tarih" required>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className={inputCls}
                disabled={saving}
              />
            </Field>
            <Field label={isGiris(editTarget.movement_type) ? 'Alış fiyatı (₺, KDV hariç)' : 'Satış fiyatı (₺, KDV hariç)'}>
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
            </Field>
            <Field label="Not">
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className={inputCls}
                disabled={saving}
                placeholder="Opsiyonel"
              />
            </Field>
          </form>
        )}
      </ModalFrame>
    </div>
  )
}

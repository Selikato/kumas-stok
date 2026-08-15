'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { parsePositiveNumber, parseNonNegativeNumber, todayISODate, unitLabel, formatTRDate } from '@/lib/helpers'
import { formatMoneyKdv, formatMoneyStock, withKdv } from '@/lib/vat'
import { inputCls } from '@/lib/stockHelpers'
import type { Fabric, Roll } from '@/app/page'
import { totalQty } from '@/lib/fabricStats'
import { sortRollsFifo, allocateFifo } from '@/lib/fifo'
import type { Party } from '@/lib/cari'
import type { MoneyCurrency } from '@/lib/money'
import { currencySymbol } from '@/lib/money'
import QuickPartyAdd from '@/components/QuickPartyAdd'
import CurrencyFields from '@/components/CurrencyFields'
import PartyBalanceHint from '@/components/PartyBalanceHint'
import { fetchPartyBalance } from '@/lib/queries'
import ModalFrame from '@/components/ui/ModalFrame'
import Field from '@/components/ui/Field'
import Button from '@/components/ui/Button'

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
  const [currency, setCurrency] = useState<MoneyCurrency>('TRY')
  const [fxRate, setFxRate] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISODate())
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fifoTotalQty, setFifoTotalQty] = useState('')
  const [partyBalanceAmt, setPartyBalanceAmt] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const submittingRef = useRef(false)

  const fabric = stockedFabrics.find((f) => f.id === fabricId) ?? null
  const customers = parties
    .filter((p) => p.kind === 'musteri' || p.kind === 'her_ikisi')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const allRolls: FlatRoll[] = useMemo(
    () =>
      fabric
        ? sortRollsFifo(
            fabric.variants
              .flatMap((v) => v.rolls.map((r) => ({ ...r, variantName: v.color_name })))
              .filter((r) => (r.quantity ?? 0) > 0)
          )
        : [],
    [fabric]
  )

  const availableQty = useMemo(
    () => allRolls.reduce((sum, r) => sum + (r.quantity ?? 0), 0),
    [allRolls]
  )

  const unit = unitLabel(fabric?.unit)
  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  const estimatedSaleTry = useMemo(() => {
    const sale = parseNonNegativeNumber(salePrice)
    if (sale == null || selectedIds.length === 0) return null
    let qtyTotal = 0
    for (const id of selectedIds) {
      const amt = parsePositiveNumber(amounts[id] ?? '')
      if (amt == null) return null
      qtyTotal += amt
    }
    if (qtyTotal <= 0) return null
    let netTry = qtyTotal * sale
    if (currency === 'USD') {
      const fx = parsePositiveNumber(fxRate)
      if (fx == null) return null
      netTry *= fx
    }
    return withKdv(netTry)
  }, [salePrice, selectedIds, amounts, currency, fxRate])

  useEffect(() => {
    if (!open) return
    setFabricId('')
    setSelected({})
    setAmounts({})
    setPartyId('')
    setDestination('')
    setSalePrice('')
    setCurrency('TRY')
    setFxRate('')
    setOccurredAt(todayISODate())
    setFifoTotalQty('')
    setPartyBalanceAmt(null)
    setBalanceLoading(false)
    setError(null)
    setLoading(false)
    supabase
      .from('parties')
      .select('id, name, kind, phone, notes')
      .order('name')
      .then(({ data }) => setParties((data as Party[]) ?? []))
  }, [open])

  useEffect(() => {
    if (!partyId) {
      setPartyBalanceAmt(null)
      return
    }
    let cancelled = false
    setBalanceLoading(true)
    fetchPartyBalance(partyId)
      .then((bal) => {
        if (!cancelled) setPartyBalanceAmt(bal)
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [partyId])

  useEffect(() => {
    setSelected({})
    setAmounts({})
    setFifoTotalQty('')
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

  function applyFifo() {
    const total = parsePositiveNumber(fifoTotalQty)
    if (total == null) {
      setError('FIFO için geçerli toplam çıkış miktarı giriniz.')
      return
    }
    const { lines, shortfall } = allocateFifo(allRolls, total)
    if (lines.length === 0) {
      setError('Dağıtılacak stok kaydı bulunamadı.')
      return
    }
    const nextSelected: Record<string, boolean> = {}
    const nextAmounts: Record<string, string> = {}
    for (const line of lines) {
      nextSelected[line.rollId] = true
      nextAmounts[line.rollId] = String(line.amount)
    }
    setSelected(nextSelected)
    setAmounts(nextAmounts)
    if (shortfall > 1e-9) {
      setError(
        `Stok yetersiz: ${shortfall.toFixed(2)}${unit ? ` ${unit}` : ''} dağıtılamadı (FIFO ile kalan).`
      )
    } else {
      setError(null)
    }
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
    if (currency === 'USD') {
      const fx = parsePositiveNumber(fxRate)
      if (fx == null) { setError('USD için geçerli kur giriniz.'); return }
    }

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
          currency,
          fxRate: currency === 'USD' ? parsePositiveNumber(fxRate) : 1,
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
        `maliyet ${formatMoneyStock(Number(data.totalCost || 0))}`,
      ]
      if (Number(data.totalSale) > 0) parts.push(`satış ${formatMoneyKdv(Number(data.totalSale))}`)
      if (data.cari?.creditApplied > 0.005) {
        parts.push(`mahsup ${formatMoneyKdv(Number(data.cari.creditApplied))}`)
      }
      if (data.cari?.netDue != null && Number(data.cari.netDue) >= 0) {
        parts.push(`tahsil ${formatMoneyKdv(Number(data.cari.netDue))}`)
      }
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

  return (
    <ModalFrame
      open={open}
      title="Kumaş Çıkışı"
      subtitle="Stoklar giriş tarihine göre (FIFO — eski önce)"
      onClose={onClose}
      loading={loading}
      maxWidth="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button
            variant="danger"
            fullWidth
            disabled={loading || !fabric || selectedIds.length === 0}
            onClick={() => {
              const formEl = document.getElementById('stock-out-form') as HTMLFormElement | null
              formEl?.requestSubmit()
            }}
          >
            {loading ? 'İşleniyor…' : 'Çıkış Yap'}
          </Button>
        </div>
      }
    >
      <form id="stock-out-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Kumaş" required>
          {stockedFabrics.length === 0 ? (
            <p className="text-sm text-muted py-2">Stoklu kumaş bulunmuyor.</p>
          ) : (
            <select
              value={fabricId}
              onChange={(e) => setFabricId(e.target.value)}
              className={inputCls}
              disabled={loading}
              autoFocus
            >
              <option value="">Seçiniz</option>
              {stockedFabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.unit ? ` (${unitLabel(f.unit)})` : ''} — {totalQty(f)}
                </option>
              ))}
            </select>
          )}
        </Field>

        {fabric && (
          <>
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                Stok kayıtları <span className="text-danger">*</span>
                <span className="text-muted/70 font-normal ml-1">FIFO sırası · maliyet = alış</span>
              </label>

              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={fifoTotalQty}
                  onChange={(e) => setFifoTotalQty(e.target.value)}
                  placeholder={`Toplam çıkış${unit ? ` (${unit})` : ''}`}
                  className={`${inputCls} flex-1`}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={applyFifo}
                  disabled={loading || !fifoTotalQty.trim()}
                >
                  FIFO ile dağıt
                </Button>
              </div>
              <p className="text-[11px] text-muted mb-2">
                Mevcut stok: {availableQty}
                {unit ? ` ${unit}` : ''} — en eski kayıttan başlayarak otomatik seçilir.
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto border border-line rounded-lg p-2 bg-paper/30">
                {allRolls.map((r, idx) => {
                  const isOn = !!selected[r.id]
                  return (
                    <div
                      key={r.id}
                      className={`rounded-lg border px-3 py-2 ${
                        isOn ? 'border-ink bg-surface' : 'border-line bg-surface/70'
                      }`}
                    >
                      <label className="flex items-start gap-2 cursor-pointer">
                        <span
                          className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-paper border border-line text-[10px] font-mono-ui flex items-center justify-center text-muted"
                          title="FIFO sırası"
                        >
                          {idx + 1}
                        </span>
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => toggleRoll(r.id)}
                          disabled={loading}
                          className="mt-1 accent-accent"
                        />
                        <span className="flex-1 text-xs text-ink-soft">
                          {r.roll_number && (
                            <span className="font-mono-ui text-muted block">{r.roll_number}</span>
                          )}
                          <span>
                            {r.lot_number ? `${r.lot_number}` : 'Kayıt'}
                            {` · ${r.quantity}${unit ? ` ${unit}` : ''}`}
                            {r.unit_price != null ? ` · maliyet ${formatMoneyStock(r.unit_price)}` : ''}
                            {r.received_at ? ` · ${formatTRDate(r.received_at)}` : ''}
                          </span>
                        </span>
                      </label>
                      {isOn && (
                        <div className="mt-2 ml-6">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            max={r.quantity}
                            value={amounts[r.id] ?? ''}
                            onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className={inputCls}
                            disabled={loading}
                            placeholder="Çıkış miktarı"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Field label="Müşteri" required>
              <select
                value={partyId}
                onChange={(e) => onPartyPick(e.target.value)}
                className={inputCls}
                disabled={loading}
              >
                <option value="">Seçiniz</option>
                {customers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
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
            </Field>

            <Field label="Tarih" required>
              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className={inputCls}
                disabled={loading}
              />
            </Field>

            <CurrencyFields
              currency={currency}
              fxRate={fxRate}
              onCurrencyChange={setCurrency}
              onFxRateChange={setFxRate}
              disabled={loading}
            />

            <Field label={`Satış fiyatı (${currencySymbol(currency)}, KDV hariç)`} required>
              <input
                type="number"
                min="0"
                step="any"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
                disabled={loading}
              />
            </Field>

            {partyId && (
              <PartyBalanceHint
                balance={partyBalanceAmt}
                loading={balanceLoading}
                mode="sale"
                transactionTotal={estimatedSaleTry}
              />
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>
    </ModalFrame>
  )
}

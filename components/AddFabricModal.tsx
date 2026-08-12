'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import type { MoneyCurrency } from '@/lib/money'
import { currencySymbol } from '@/lib/money'
import QuickPartyAdd from '@/components/QuickPartyAdd'
import CurrencyFields from '@/components/CurrencyFields'
import ImmediateOutPanel from '@/components/ImmediateOutPanel'
import PartyBalanceHint from '@/components/PartyBalanceHint'
import { fetchPartyBalance } from '@/lib/queries'
import ModalFrame from '@/components/ui/ModalFrame'
import Field from '@/components/ui/Field'
import Button from '@/components/ui/Button'

type FormData = {
  fabricId: string
  name: string
  unit: FabricUnit | ''
  quantity: string
  unit_price: string
  partyId: string
  occurred_at: string
  currency: MoneyCurrency
  fxRate: string
}

const EMPTY: FormData = {
  fabricId: '',
  name: '',
  unit: '',
  quantity: '',
  unit_price: '',
  partyId: '',
  occurred_at: todayISODate(),
  currency: 'TRY',
  fxRate: '',
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
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLSelectElement>(null)

  const [immediateOutEnabled, setImmediateOutEnabled] = useState(false)
  const [outPartyId, setOutPartyId] = useState('')
  const [outQuantity, setOutQuantity] = useState('')
  const [outSalePrice, setOutSalePrice] = useState('')
  const [outCurrency, setOutCurrency] = useState<MoneyCurrency>('TRY')
  const [outFxRate, setOutFxRate] = useState('')
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null)
  const [customerBalance, setCustomerBalance] = useState<number | null>(null)
  const [supplierBalanceLoading, setSupplierBalanceLoading] = useState(false)
  const [customerBalanceLoading, setCustomerBalanceLoading] = useState(false)

  const selectedFabric = fabrics.find((f) => f.id === form.fabricId)
  const pickingExisting = form.fabricId !== '' && form.fabricId !== '__new__'
  const isNew = form.fabricId === '__new__' || (form.fabricId === '' && fabrics.length === 0)
  const suppliers = parties
    .filter((p) => p.kind === 'tedarikci' || p.kind === 'her_ikisi')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  const customers = parties
    .filter((p) => p.kind === 'musteri' || p.kind === 'her_ikisi')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const purchaseTotalTry = useMemo(() => {
    const qty = parsePositiveNumber(form.quantity)
    const price = parseNonNegativeNumber(form.unit_price)
    if (qty == null || price == null) return null
    const gross = qty * price
    if (form.currency === 'USD') {
      const fx = parsePositiveNumber(form.fxRate)
      if (fx == null) return null
      return gross * fx
    }
    return gross
  }, [form.quantity, form.unit_price, form.currency, form.fxRate])

  const immediateSaleTry = useMemo(() => {
    if (!immediateOutEnabled) return null
    const qtyIn = parsePositiveNumber(form.quantity)
    const outQty = outQuantity.trim() ? parsePositiveNumber(outQuantity) : qtyIn
    const sale = parseNonNegativeNumber(outSalePrice)
    if (outQty == null || sale == null) return null
    const gross = outQty * sale
    if (outCurrency === 'USD') {
      const fx = parsePositiveNumber(outFxRate)
      if (fx == null) return null
      return gross * fx
    }
    return gross
  }, [
    immediateOutEnabled,
    form.quantity,
    outQuantity,
    outSalePrice,
    outCurrency,
    outFxRate,
  ])

  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY,
      occurred_at: todayISODate(),
      fabricId: fabrics.length === 0 ? '__new__' : '',
    })
    setError(null)
    setImmediateOutEnabled(false)
    setOutPartyId('')
    setOutQuantity('')
    setOutSalePrice('')
    setOutCurrency('TRY')
    setOutFxRate('')
    setSupplierBalance(null)
    setCustomerBalance(null)
    setTimeout(() => firstInputRef.current?.focus(), 50)

    supabase
      .from('parties')
      .select('id, name, kind, phone, notes, opening_balance')
      .order('name')
      .then(({ data, error: err }) => {
        if (!err && data) {
          setParties(
            (data as Party[]).map((p) => ({
              ...p,
              opening_balance: Number(p.opening_balance) || 0,
            }))
          )
          return
        }
        supabase
          .from('parties')
          .select('id, name, kind, phone, notes')
          .order('name')
          .then(({ data: d2 }) =>
            setParties(((d2 as Party[]) ?? []).map((p) => ({ ...p, opening_balance: 0 })))
          )
      })
  }, [open, fabrics.length])

  useEffect(() => {
    if (!form.partyId) {
      setSupplierBalance(null)
      return
    }
    let cancelled = false
    setSupplierBalanceLoading(true)
    fetchPartyBalance(form.partyId)
      .then((bal) => {
        if (!cancelled) setSupplierBalance(bal)
      })
      .finally(() => {
        if (!cancelled) setSupplierBalanceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [form.partyId])

  useEffect(() => {
    if (!immediateOutEnabled || !outPartyId) {
      setCustomerBalance(null)
      return
    }
    let cancelled = false
    setCustomerBalanceLoading(true)
    fetchPartyBalance(outPartyId)
      .then((bal) => {
        if (!cancelled) setCustomerBalance(bal)
      })
      .finally(() => {
        if (!cancelled) setCustomerBalanceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [immediateOutEnabled, outPartyId])

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
      setForm((prev) => ({ ...prev, fabricId: '__new__', name: '', unit: '' }))
      return
    }
    if (value === '') {
      setForm((prev) => ({ ...prev, fabricId: '', name: '', unit: '' }))
      return
    }
    const fabric = fabrics.find((f) => f.id === value)
    if (!fabric) return
    setForm((prev) => ({
      ...prev,
      fabricId: fabric.id,
      name: fabric.name,
      unit: (fabric.unit as FabricUnit) || '',
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
    if (form.currency === 'USD') {
      const fx = parsePositiveNumber(form.fxRate)
      if (fx == null) { setError('USD için geçerli kur giriniz.'); return }
    }
    const party = suppliers.find((p) => p.id === form.partyId)
    if (!party) { setError('Tedarikçi seçiniz.'); return }

    if (!pickingExisting && !form.unit) {
      setError('Birim zorunludur.')
      return
    }

    if (immediateOutEnabled) {
      const outCustomer = customers.find((p) => p.id === outPartyId)
      if (!outCustomer) { setError('Hemen çıkış için müşteri seçiniz.'); return }
      const outSale = parseNonNegativeNumber(outSalePrice)
      if (outSale == null) { setError('Hemen çıkış için geçerli satış fiyatı giriniz.'); return }
      if (outCurrency === 'USD') {
        const fx = parsePositiveNumber(outFxRate)
        if (fx == null) { setError('Hemen çıkış USD için geçerli kur giriniz.'); return }
      }
      if (outQuantity.trim()) {
        const oq = parsePositiveNumber(outQuantity)
        if (oq == null) { setError('Geçerli hemen çıkış miktarı giriniz.'); return }
        if (oq > qty) { setError('Hemen çıkış miktarı giriş miktarından fazla olamaz.'); return }
      }
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stock/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricId: pickingExisting ? form.fabricId : null,
          name: form.name.trim(),
          unit: form.unit || undefined,
          quantity: qty,
          unitPrice: price,
          partyId: party.id,
          source: party.name,
          warehouse: 'Depo',
          occurredAt: form.occurred_at,
          currency: form.currency,
          fxRate: form.currency === 'USD' ? parsePositiveNumber(form.fxRate) : 1,
          immediateOut: immediateOutEnabled
            ? {
                partyId: outPartyId,
                ...(outQuantity.trim()
                  ? { quantity: parsePositiveNumber(outQuantity)! }
                  : {}),
                salePrice: parseNonNegativeNumber(outSalePrice)!,
                currency: outCurrency,
                fxRate: outCurrency === 'USD' ? parsePositiveNumber(outFxRate) : 1,
              }
            : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Giriş kaydedilemedi.')

      const unitSuffix = data.unit === 'kg' ? 'kg' : data.unit === 'metre' ? 'm' : ''
      router.refresh()
      onClose()
      let msg = `${data.voucher_number} · ${form.name.trim()} giriş${unitSuffix ? ` (${qty} ${unitSuffix})` : ''} · ₺${Number(data.lineTotal).toFixed(2)}`
      if (data.cari?.purchase?.netDue != null && data.cari.purchase.creditApplied > 0.005) {
        msg += ` · tedarikçiye ödenecek ₺${Number(data.cari.purchase.netDue).toFixed(2)}`
      }
      if (data.immediateOut) {
        msg += ` · hemen çıkış ${data.immediateOut.quantity}${unitSuffix ? ` ${unitSuffix}` : ''} → ${data.immediateOut.destination}`
        if (data.cari?.sale?.netDue != null && data.cari.sale.creditApplied > 0.005) {
          msg += ` · tahsil ₺${Number(data.cari.sale.netDue).toFixed(2)}`
        }
      }
      onSuccess(msg)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  const priceSym = currencySymbol(form.currency)

  return (
    <ModalFrame
      open={open}
      title="Kumaş Girişi"
      subtitle="Tedarikçi · tarih · miktar · fiyat"
      onClose={onClose}
      loading={loading}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button variant="accent" fullWidth onClick={() => {
            const formEl = document.getElementById('stock-in-form') as HTMLFormElement | null
            formEl?.requestSubmit()
          }} disabled={loading}>
            {loading ? 'Kaydediliyor…' : 'Giriş Yap'}
          </Button>
        </div>
      }
    >
      <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Kumaş" required>
          <select
            ref={firstInputRef}
            value={form.fabricId}
            onChange={(e) => onFabricPick(e.target.value)}
            className={inputCls}
            disabled={loading}
          >
            <option value="">Seçiniz</option>
            {fabrics.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.unit ? ` (${unitLabel(f.unit)})` : ''}
              </option>
            ))}
            <option value="__new__">+ Yeni kumaş oluştur</option>
          </select>
        </Field>

        {(isNew || form.fabricId === '__new__') && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kumaş Adı" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="ör. Pamuk Poplin"
                className={inputCls}
                disabled={loading}
              />
            </Field>
            <Field label="Birim" required>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className={inputCls}
                disabled={loading}
              >
                <option value="">Seçiniz</option>
                <option value="metre">Metre</option>
                <option value="kg">Kg</option>
              </select>
            </Field>
          </div>
        )}

        {pickingExisting && selectedFabric && (
          <p className="text-xs text-muted bg-paper/60 border border-line rounded-lg px-3 py-2">
            Birim: <span className="font-medium text-ink">{unitLabel(selectedFabric.unit) || '—'}</span>
          </p>
        )}

        <Field label="Tedarikçi" required>
          <select
            value={form.partyId}
            onChange={(e) => set('partyId', e.target.value)}
            className={inputCls}
            disabled={loading}
          >
            <option value="">Seçiniz</option>
            {suppliers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="mt-1">
            <QuickPartyAdd
              kind="tedarikci"
              disabled={loading}
              onCreated={(party) => {
                setParties((prev) =>
                  [...prev, { ...party, opening_balance: party.opening_balance ?? 0 }].sort((a, b) =>
                    a.name.localeCompare(b.name, 'tr')
                  )
                )
                set('partyId', party.id)
              }}
            />
          </div>
        </Field>

        <Field label="Tarih" required>
          <input
            type="date"
            value={form.occurred_at}
            onChange={(e) => set('occurred_at', e.target.value)}
            className={inputCls}
            disabled={loading}
          />
        </Field>

        <CurrencyFields
          currency={form.currency}
          fxRate={form.fxRate}
          onCurrencyChange={(c) => setForm((prev) => ({ ...prev, currency: c }))}
          onFxRateChange={(v) => set('fxRate', v)}
          disabled={loading}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={`Miktar${
              pickingExisting && selectedFabric?.unit
                ? ` (${unitLabel(selectedFabric.unit)})`
                : form.unit
                  ? ` (${unitLabel(form.unit)})`
                  : ''
            }`}
            required
          >
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
          <Field label={`Alış fiyatı (${priceSym})`} required>
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

        {form.partyId && (
          <PartyBalanceHint
            balance={supplierBalance}
            loading={supplierBalanceLoading}
            mode="purchase"
            transactionTotal={purchaseTotalTry}
          />
        )}

        <ImmediateOutPanel
          enabled={immediateOutEnabled}
          onToggle={setImmediateOutEnabled}
        >
          <Field label="Müşteri" required>
            <select
              value={outPartyId}
              onChange={(e) => setOutPartyId(e.target.value)}
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
                  setParties((prev) =>
                    [...prev, { ...party, opening_balance: party.opening_balance ?? 0 }].sort((a, b) =>
                      a.name.localeCompare(b.name, 'tr')
                    )
                  )
                  setOutPartyId(party.id)
                }}
              />
            </div>
          </Field>

          <CurrencyFields
            currency={outCurrency}
            fxRate={outFxRate}
            onCurrencyChange={setOutCurrency}
            onFxRateChange={setOutFxRate}
            disabled={loading}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Çıkış miktarı${
                pickingExisting && selectedFabric?.unit
                  ? ` (${unitLabel(selectedFabric.unit)})`
                  : form.unit
                    ? ` (${unitLabel(form.unit)})`
                    : ''
              }`}
            >
              <input
                type="number"
                min="0.01"
                step="any"
                value={outQuantity}
                onChange={(e) => setOutQuantity(e.target.value)}
                placeholder="Boş = tamamı"
                className={inputCls}
                disabled={loading}
              />
            </Field>
            <Field label={`Satış fiyatı (${currencySymbol(outCurrency)})`} required>
              <input
                type="number"
                min="0"
                step="any"
                value={outSalePrice}
                onChange={(e) => setOutSalePrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
                disabled={loading}
              />
            </Field>
          </div>

          {outPartyId && (
            <PartyBalanceHint
              balance={customerBalance}
              loading={customerBalanceLoading}
              mode="sale"
              transactionTotal={immediateSaleTry}
            />
          )}
        </ImmediateOutPanel>

        {error && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>
    </ModalFrame>
  )
}

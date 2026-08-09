'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  entryTypeLabel,
  formatBalance,
  isReverseBalance,
  partyBalance,
  partyKindLabel,
  paymentMethodLabel,
  PAYMENT_METHODS,
  type AccountEntry,
  type AccountEntryType,
  type Party,
  type PartyKind,
  type PaymentMethod,
} from '@/lib/cari'
import { insertAccountEntry } from '@/lib/dbWrites'
import { fmt, formatTRDate, todayISODate, parsePositiveNumber } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import { fxNote, toTry, currencySymbol, type MoneyCurrency } from '@/lib/money'
import CurrencyFields from '@/components/CurrencyFields'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import { PanelHeader } from '@/components/ui/Panel'

type Props = {
  parties: Party[]
  entries: AccountEntry[]
}

type ListFilter = 'all' | 'alacakli' | 'borclu'

export default function CariClient({ parties: initialParties, entries: initialEntries }: Props) {
  const router = useRouter()
  const [parties] = useState(initialParties)
  const [entries, setEntries] = useState(initialEntries)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectedId, setSelectedId] = useState(initialParties[0]?.id ?? '')
  const [entryType, setEntryType] = useState<AccountEntryType>('odeme')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<MoneyCurrency>('TRY')
  const [fxRate, setFxRate] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISODate())
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('nakit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of parties) {
      map.set(
        p.id,
        partyBalance(
          entries.filter((e) => e.party_id === p.id),
          Number(p.opening_balance) || 0
        )
      )
    }
    return map
  }, [parties, entries])

  const sortedFiltered = useMemo(() => {
    const rows = parties
      .map((p) => ({ party: p, bal: balances.get(p.id) ?? 0 }))
      .filter(({ bal }) => {
        if (listFilter === 'alacakli') return bal > 0.005
        if (listFilter === 'borclu') return bal < -0.005
        return true
      })
      .sort((a, b) => a.party.name.localeCompare(b.party.name, 'tr'))
    return rows
  }, [parties, balances, listFilter])

  useEffect(() => {
    if (!selectedId) return
    if (!sortedFiltered.some((r) => r.party.id === selectedId)) {
      setSelectedId(sortedFiltered[0]?.party.id ?? '')
    }
  }, [sortedFiltered, selectedId])

  const selected = parties.find((p) => p.id === selectedId) ?? null
  const showPaymentMethod = entryType === 'odeme' || entryType === 'tahsilat'

  const partyEntries = entries
    .filter((e) => e.party_id === selectedId)
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { setError('Cari seçiniz.'); return }
    const original = parseFloat(amount)
    if (!amount.trim() || isNaN(original) || original <= 0) { setError('Geçerli tutar giriniz.'); return }
    if (!occurredAt) { setError('Tarih zorunlu.'); return }
    if (showPaymentMethod && !paymentMethod) { setError('Ödeme şekli seçiniz.'); return }
    const isManual = entryType === 'borc' || entryType === 'alacak'
    if (isManual && !notes.trim()) {
      setError('Açıklama zorunlu (ör. Boyahane ücreti).')
      return
    }
    if (currency === 'USD' && parsePositiveNumber(fxRate) == null) {
      setError('USD için geçerli kur giriniz.')
      return
    }

    let tryAmount: number
    let fx: number
    try {
      const converted = toTry(original, currency, currency === 'USD' ? parsePositiveNumber(fxRate) : 1)
      tryAmount = converted.tryAmount
      fx = converted.fxRate
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kur hatası.')
      return
    }

    const noteParts = [notes.trim(), fxNote(currency, fx, original)].filter(Boolean)

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await insertAccountEntry({
        party_id: selectedId,
        entry_type: entryType,
        amount: tryAmount,
        occurred_at: occurredAt,
        notes: noteParts.join(' · ') || undefined,
        payment_method: showPaymentMethod ? paymentMethod || null : null,
        currency,
        fx_rate: fx,
        original_amount: original,
      })
      setMessage(`${res.voucher_number} kaydedildi · ₺${fmt(tryAmount)}`)
      setAmount('')
      setNotes('')
      setCurrency('TRY')
      setFxRate('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hata')
    } finally {
      setLoading(false)
    }
  }

  const filterBtn = (id: ListFilter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setListFilter(id)}
      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
        listFilter === id ? 'bg-ink text-surface' : 'text-muted hover:bg-paper-deep'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
        <div className="px-4 py-3 border-b border-line space-y-2">
          <div>
            <h2 className="font-display text-lg text-ink">Cariler</h2>
            <p className="text-xs text-muted mt-0.5">Alfabetik · Alacak (+), borç (−)</p>
          </div>
          <div className="flex gap-1 bg-paper/70 p-1 rounded-lg">{filterBtn('all', 'Tümü')}{filterBtn('alacakli', 'Alacaklı')}{filterBtn('borclu', 'Borçlu')}</div>
        </div>
        {sortedFiltered.length === 0 ? (
          <p className="text-sm text-muted p-6 text-center">
            {parties.length === 0 ? (
              <>
                Henüz cari yok.{' '}
                <a href="/ayarlar" className="text-accent underline">
                  Ayarlar
                </a>
                ’dan ekleyin.
              </>
            ) : (
              'Bu filtrede cari yok.'
            )}
          </p>
        ) : (
          <ul className="divide-y divide-line max-h-[28rem] overflow-y-auto">
            {sortedFiltered.map(({ party: p, bal }) => {
              const formatted = formatBalance(bal)
              const active = p.id === selectedId
              const reverse = isReverseBalance(p.kind as PartyKind, bal)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? 'bg-paper/70' : 'hover:bg-paper/40'
                    } ${reverse ? 'border-l-2 border-out' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {partyKindLabel(p.kind as PartyKind)}
                          {reverse && <span className="ml-1.5 text-out font-medium">· Ters bakiye</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            reverse
                              ? 'text-out'
                              : bal > 0
                                ? 'text-ok'
                                : bal < 0
                                  ? 'text-danger'
                                  : 'text-muted'
                          }`}
                        >
                          {formatted.amount === 0 ? '—' : `₺${fmt(formatted.amount)}`}
                        </p>
                        <p className={`text-[10px] ${reverse ? 'text-out font-medium' : 'text-muted'}`}>
                          {formatted.label}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 space-y-4">
        {selected ? (
          <>
            <div className="bg-surface rounded-xl border border-line shadow-[0_1px_2px_rgba(15,28,46,0.04)] sticky top-[4.5rem] z-[5]">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-display text-2xl text-ink leading-tight">{selected.name}</h2>
                    <p className="text-xs text-muted mt-1">{partyKindLabel(selected.kind)}</p>
                  </div>
                  {(() => {
                    const bal = balances.get(selected.id) ?? 0
                    const b = formatBalance(bal)
                    const reverse = isReverseBalance(selected.kind, bal)
                    const opening = formatBalance(Number(selected.opening_balance) || 0)
                    return (
                      <div className="text-right">
                        <p className={`text-xs ${reverse ? 'text-out font-medium' : 'text-muted'}`}>
                          {b.label}
                          {reverse ? ' · ters' : ''}
                        </p>
                        <p
                          className={`font-display text-3xl tabular-nums tracking-tight ${
                            reverse ? 'text-out' : 'text-ink'
                          }`}
                        >
                          {b.amount === 0 ? '₺0' : `₺${fmt(b.amount)}`}
                        </p>
                        {opening.amount > 0 && (
                          <p className="text-[11px] text-muted mt-1">
                            Başlangıç: ₺{fmt(opening.amount)} {opening.label}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <form
                  onSubmit={handlePayment}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-line pt-4"
                >
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted mb-2">
                      Kumaş dışı borç/alacak için{' '}
                      <span className="font-medium text-ink">Borç ekle</span> /{' '}
                      <span className="font-medium text-ink">Alacak ekle</span> seçin (ör. boyahane).
                    </p>
                  </div>
                  <Field label="İşlem">
                    <select
                      value={entryType}
                      onChange={(e) => setEntryType(e.target.value as AccountEntryType)}
                      className={inputCls}
                      disabled={loading}
                    >
                      <option value="odeme">Ödeme (borç azalt)</option>
                      <option value="tahsilat">Tahsilat (alacak azalt)</option>
                      <option value="borc">Borç ekle (manuel)</option>
                      <option value="alacak">Alacak ekle (manuel)</option>
                    </select>
                  </Field>
                  <Field label={`Tutar (${currencySymbol(currency)})`}>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={inputCls}
                      disabled={loading}
                    />
                  </Field>
                  <Field label="Tarih">
                    <input
                      type="date"
                      value={occurredAt}
                      onChange={(e) => setOccurredAt(e.target.value)}
                      className={inputCls}
                      disabled={loading}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <CurrencyFields
                      currency={currency}
                      fxRate={fxRate}
                      onCurrencyChange={setCurrency}
                      onFxRateChange={setFxRate}
                      disabled={loading}
                    />
                  </div>
                  {showPaymentMethod ? (
                    <Field label="Ödeme şekli">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className={inputCls}
                        disabled={loading}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Açıklama" required>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={inputCls}
                        disabled={loading}
                        placeholder="ör. Boyahane ücreti"
                      />
                    </Field>
                  )}
                  {showPaymentMethod && (
                    <div className="sm:col-span-2">
                      <Field label="Not">
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className={inputCls}
                          disabled={loading}
                          placeholder="Opsiyonel"
                        />
                      </Field>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    {error && <p className="text-sm text-danger mb-2">{error}</p>}
                    {message && <p className="text-sm text-ok mb-2">{message}</p>}
                    <Button type="submit" variant="accent" fullWidth disabled={loading}>
                      {loading ? 'Kaydediliyor…' : 'Kaydet'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
              <PanelHeader title="Hareketler" subtitle="Bu cariye ait kayıtlar" />
              {partyEntries.length === 0 ? (
                <p className="text-sm text-muted p-6 text-center">Hareket yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {partyEntries.map((e) => (
                    <li key={e.id} className="px-4 py-3.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {entryTypeLabel(e.entry_type)}
                          {(e.entry_type === 'odeme' || e.entry_type === 'tahsilat') && e.payment_method ? (
                            <span className="ml-1.5 text-xs font-normal text-muted">
                              · {paymentMethodLabel(e.payment_method)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatTRDate(e.occurred_at)}
                          {e.voucher_number ? ` · ${e.voucher_number}` : ''}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-ink shrink-0">₺{fmt(Number(e.amount))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="bg-surface rounded-xl border border-line p-10 text-center text-sm text-muted">
            Sol listeden cari seçin.
          </div>
        )}
      </div>
    </div>
  )
}

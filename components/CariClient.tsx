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
import { fmt, formatTRDate, todayISODate } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'

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
    const amt = parseFloat(amount)
    if (!amount.trim() || isNaN(amt) || amt <= 0) { setError('Geçerli tutar giriniz.'); return }
    if (!occurredAt) { setError('Tarih zorunlu.'); return }
    if (showPaymentMethod && !paymentMethod) { setError('Ödeme şekli seçiniz.'); return }

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await insertAccountEntry({
        party_id: selectedId,
        entry_type: entryType,
        amount: amt,
        occurred_at: occurredAt,
        notes: notes.trim() || undefined,
        payment_method: showPaymentMethod ? paymentMethod || null : null,
      })
      setMessage(`${res.voucher_number} kaydedildi.`)
      setAmount('')
      setNotes('')
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
        listFilter === id
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Cariler</h2>
            <p className="text-xs text-gray-400 mt-0.5">Alfabetik · Alacak (+), borç (−)</p>
          </div>
          <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
            {filterBtn('all', 'Tümü')}
            {filterBtn('alacakli', 'Alacaklı')}
            {filterBtn('borclu', 'Borçlu')}
          </div>
        </div>
        {sortedFiltered.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">
            {parties.length === 0 ? (
              <>Henüz cari yok. <a href="/ayarlar" className="text-gray-700 underline">Ayarlar</a>’dan ekleyin.</>
            ) : (
              'Bu filtrede cari yok.'
            )}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
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
                      active ? 'bg-gray-50' : 'hover:bg-gray-50'
                    } ${reverse ? 'border-l-2 border-amber-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {partyKindLabel(p.kind as PartyKind)}
                          {reverse && (
                            <span className="ml-1.5 text-amber-700 font-medium">· Ters bakiye</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            reverse
                              ? 'text-amber-700'
                              : bal > 0
                                ? 'text-emerald-700'
                                : bal < 0
                                  ? 'text-red-600'
                                  : 'text-gray-400'
                          }`}
                        >
                          {formatted.amount === 0 ? '—' : `₺${fmt(formatted.amount)}`}
                        </p>
                        <p className={`text-[10px] ${reverse ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
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
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selected.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{partyKindLabel(selected.kind)}</p>
                </div>
                {(() => {
                  const bal = balances.get(selected.id) ?? 0
                  const b = formatBalance(bal)
                  const reverse = isReverseBalance(selected.kind, bal)
                  const opening = formatBalance(Number(selected.opening_balance) || 0)
                  return (
                    <div className="text-right">
                      <p className={`text-xs ${reverse ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                        {b.label}{reverse ? ' · ters' : ''}
                      </p>
                      <p className={`text-xl font-semibold tabular-nums ${reverse ? 'text-amber-700' : 'text-gray-900'}`}>
                        {b.amount === 0 ? '₺0' : `₺${fmt(b.amount)}`}
                      </p>
                      {opening.amount > 0 && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Başlangıç: ₺{fmt(opening.amount)} {opening.label}
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              <form onSubmit={handlePayment} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">İşlem</label>
                  <select value={entryType} onChange={(e) => setEntryType(e.target.value as AccountEntryType)} className={inputCls} disabled={loading}>
                    <option value="odeme">Ödeme (borç azalt)</option>
                    <option value="tahsilat">Tahsilat (alacak azalt)</option>
                    <option value="borc">Borç ekle</option>
                    <option value="alacak">Alacak ekle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tutar (₺)</label>
                  <input type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} disabled={loading} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tarih</label>
                  <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} disabled={loading} />
                </div>
                {showPaymentMethod ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ödeme şekli</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className={inputCls}
                      disabled={loading}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Not</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} disabled={loading} placeholder="Opsiyonel" />
                  </div>
                )}
                {showPaymentMethod && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Not</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} disabled={loading} placeholder="Opsiyonel" />
                  </div>
                )}
                <div className="sm:col-span-2">
                  {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                  {message && <p className="text-sm text-emerald-700 mb-2">{message}</p>}
                  <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg disabled:opacity-50">
                    {loading ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Hareketler</h3>
              </div>
              {partyEntries.length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">Hareket yok.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {partyEntries.map((e) => (
                    <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {entryTypeLabel(e.entry_type)}
                          {(e.entry_type === 'odeme' || e.entry_type === 'tahsilat') && e.payment_method ? (
                            <span className="ml-1.5 text-xs font-normal text-gray-500">
                              · {paymentMethodLabel(e.payment_method)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatTRDate(e.occurred_at)}
                          {e.voucher_number ? ` · ${e.voucher_number}` : ''}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-gray-900 shrink-0">₺{fmt(Number(e.amount))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            Sol listeden cari seçin.
          </div>
        )}
      </div>
    </div>
  )
}

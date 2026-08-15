'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildPartyStatement,
  entryTypeLabel,
  formatBalance,
  isReverseBalance,
  partyBalance,
  partyKindLabel,
  type AccountEntry,
  type AccountEntryType,
  type Party,
  type PartyKind,
} from '@/lib/cari'
import { insertAccountEntry } from '@/lib/dbWrites'
import { todayISODate, parsePositiveNumber } from '@/lib/helpers'
import { yearRange } from '@/lib/movements'
import { formatMoneyKdv, KDV_LABEL, withKdv } from '@/lib/vat'
import CariStatementTable from '@/components/CariStatementTable'
import { inputCls } from '@/lib/stockHelpers'
import { fxNote, toTry, currencySymbol, type MoneyCurrency } from '@/lib/money'
import CurrencyFields from '@/components/CurrencyFields'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ConfirmDialog'
import Field from '@/components/ui/Field'
import { PanelHeader } from '@/components/ui/Panel'

type Props = {
  parties: Party[]
  entries: AccountEntry[]
}

type ListFilter = 'all' | 'alacakli' | 'borclu'

export default function CariClient({ parties: initialParties, entries: initialEntries }: Props) {
  const router = useRouter()
  const [parties, setParties] = useState(initialParties)
  const [entries, setEntries] = useState(initialEntries)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectedId, setSelectedId] = useState(initialParties[0]?.id ?? '')
  const [borcAmount, setBorcAmount] = useState('')
  const [borcNotes, setBorcNotes] = useState('')
  const [alacakAmount, setAlacakAmount] = useState('')
  const [alacakNotes, setAlacakNotes] = useState('')
  const [currency, setCurrency] = useState<MoneyCurrency>('TRY')
  const [fxRate, setFxRate] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISODate())
  const [loadingType, setLoadingType] = useState<AccountEntryType | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetChecked, setResetChecked] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const year = yearRange()
  const [ekstreFrom, setEkstreFrom] = useState(year.from)
  const [ekstreTo, setEkstreTo] = useState(year.to)

  useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  useEffect(() => {
    setParties(initialParties)
  }, [initialParties])

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

  const statement = useMemo(
    () =>
      buildPartyStatement(
        entries.filter((e) => e.party_id === selectedId),
        Number(selected?.opening_balance) || 0,
        { from: ekstreFrom, to: ekstreTo }
      ),
    [entries, selectedId, selected?.opening_balance, ekstreFrom, ekstreTo]
  )

  function grossFromInput(rawAmount: string): number | null {
    const original = parseFloat(rawAmount)
    if (!rawAmount.trim() || isNaN(original) || original <= 0) return null
    if (currency === 'USD' && parsePositiveNumber(fxRate) == null) return null
    try {
      const { tryAmount } = toTry(
        original,
        currency,
        currency === 'USD' ? parsePositiveNumber(fxRate) : 1
      )
      return withKdv(tryAmount)
    } catch {
      return null
    }
  }

  const borcGross = useMemo(
    () => grossFromInput(borcAmount),
    [borcAmount, currency, fxRate]
  )

  const alacakGross = useMemo(
    () => grossFromInput(alacakAmount),
    [alacakAmount, currency, fxRate]
  )

  async function handleEntrySubmit(
    entryType: 'borc' | 'alacak',
    e: React.FormEvent
  ) {
    e.preventDefault()
    if (!selectedId) {
      setError('Cari seçiniz.')
      return
    }

    const rawAmount = entryType === 'borc' ? borcAmount : alacakAmount
    const rawNotes = entryType === 'borc' ? borcNotes : alacakNotes
    const original = parseFloat(rawAmount)

    if (!rawAmount.trim() || isNaN(original) || original <= 0) {
      setError('Geçerli tutar giriniz.')
      return
    }
    if (!occurredAt) {
      setError('Tarih zorunlu.')
      return
    }
    if (!rawNotes.trim()) {
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

    const storedAmount = withKdv(tryAmount)
    const noteParts = [rawNotes.trim(), fxNote(currency, fx, original)].filter(Boolean)

    setLoadingType(entryType)
    setError(null)
    setMessage(null)
    try {
      const res = await insertAccountEntry({
        party_id: selectedId,
        entry_type: entryType,
        amount: storedAmount,
        occurred_at: occurredAt,
        notes: noteParts.join(' · ') || undefined,
        payment_method: null,
        currency,
        fx_rate: fx,
        original_amount: original,
      })
      setMessage(`${res.voucher_number} · ${entryTypeLabel(entryType)} · ${formatMoneyKdv(storedAmount)}`)
      if (entryType === 'borc') {
        setBorcAmount('')
        setBorcNotes('')
      } else {
        setAlacakAmount('')
        setAlacakNotes('')
      }
      setCurrency('TRY')
      setFxRate('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hata')
    } finally {
      setLoadingType(null)
    }
  }

  const resetCheckedIds = useMemo(
    () => Object.keys(resetChecked).filter((id) => resetChecked[id]),
    [resetChecked]
  )

  const resetCheckedNames = useMemo(
    () =>
      resetCheckedIds
        .map((id) => parties.find((p) => p.id === id)?.name)
        .filter(Boolean) as string[],
    [resetCheckedIds, parties]
  )

  function toggleResetCheck(partyId: string) {
    setResetChecked((prev) => ({ ...prev, [partyId]: !prev[partyId] }))
  }

  function selectAllVisibleForReset() {
    setResetChecked((prev) => {
      const next = { ...prev }
      for (const { party } of sortedFiltered) next[party.id] = true
      return next
    })
  }

  function clearResetCheck() {
    setResetChecked({})
  }

  async function handleResetBalances() {
    if (resetCheckedIds.length === 0) {
      setError('Sıfırlamak için en az bir cari seçiniz.')
      return
    }
    setResetLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/cari/reset-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyIds: resetCheckedIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Bakiyeler sıfırlanamadı.')
      const idSet = new Set(resetCheckedIds)
      setEntries((prev) => prev.filter((e) => !idSet.has(e.party_id)))
      setParties((prev) =>
        prev.map((p) => (idSet.has(p.id) ? { ...p, opening_balance: 0 } : p))
      )
      setResetChecked({})
      setResetOpen(false)
      setMessage(
        `${data.deletedEntries ?? 0} hareket silindi · ${data.resetParties ?? 0} cari bakiyesi sıfırlandı`
      )
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hata')
    } finally {
      setResetLoading(false)
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
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-ink">Cariler</h2>
              <p className="text-xs text-muted mt-0.5">
                Alfabetik · Alacak (+), borç (−)
                {resetCheckedIds.length > 0 && (
                  <span className="text-accent"> · {resetCheckedIds.length} seçili</span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                disabled={resetCheckedIds.length === 0}
                className="text-[11px] px-2 py-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-muted hover:text-danger border-line hover:border-danger/30"
              >
                Seçili bakiyeleri sıfırla
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={selectAllVisibleForReset}
                  className="text-[10px] text-muted hover:text-ink px-1"
                >
                  Görüneni seç
                </button>
                <span className="text-[10px] text-muted/50">·</span>
                <button
                  type="button"
                  onClick={clearResetCheck}
                  className="text-[10px] text-muted hover:text-ink px-1"
                >
                  Temizle
                </button>
              </div>
            </div>
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
                  <div
                    className={`flex items-stretch transition-colors ${
                      active ? 'bg-paper/70' : 'hover:bg-paper/40'
                    } ${reverse ? 'border-l-2 border-out' : ''}`}
                  >
                    <label className="flex items-center px-3 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!resetChecked[p.id]}
                        onChange={() => toggleResetCheck(p.id)}
                        className="rounded border-line text-accent focus:ring-accent/30"
                        aria-label={`${p.name} seç`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="flex-1 text-left py-3 pr-4 min-w-0"
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
                            {formatted.amount === 0 ? '—' : formatMoneyKdv(formatted.amount)}
                          </p>
                          <p className={`text-[10px] ${reverse ? 'text-out font-medium' : 'text-muted'}`}>
                            {formatted.label}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 space-y-4">
        {selected ? (
          <>
            <div className="bg-surface rounded-xl border border-line shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
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
                          {b.amount === 0 ? '₺0' : formatMoneyKdv(b.amount)}
                        </p>
                        {opening.amount > 0 && (
                          <p className="text-[11px] text-muted mt-1">
                            Başlangıç: {formatMoneyKdv(opening.amount)} {opening.label}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div className="border-t border-line pt-4 space-y-4">
                  <p className="text-xs text-muted">
                    Kumaş dışı işlemler için borç veya alacak kaydı. Tutarlar{' '}
                    {KDV_LABEL.toLowerCase()} kaydedilir.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Tarih">
                      <input
                        type="date"
                        value={occurredAt}
                        onChange={(e) => setOccurredAt(e.target.value)}
                        className={inputCls}
                        disabled={loadingType != null}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <CurrencyFields
                        currency={currency}
                        fxRate={fxRate}
                        onCurrencyChange={setCurrency}
                        onFxRateChange={setFxRate}
                        disabled={loadingType != null}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <form
                      onSubmit={(e) => handleEntrySubmit('borc', e)}
                      className="rounded-xl border border-danger/20 bg-danger-soft/30 p-4 space-y-3"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-ink">Borç ekle</h3>
                        <p className="text-[11px] text-muted mt-0.5">Cariye borç yazılır</p>
                      </div>
                      <Field label={`Tutar (${currencySymbol(currency)}, KDV hariç)`}>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={borcAmount}
                          onChange={(e) => setBorcAmount(e.target.value)}
                          className={inputCls}
                          disabled={loadingType != null}
                        />
                        {borcGross != null && (
                          <p className="text-[11px] text-muted mt-1.5">
                            Kaydedilecek:{' '}
                            <span className="font-medium text-ink tabular-nums">
                              {formatMoneyKdv(borcGross)}
                            </span>
                          </p>
                        )}
                      </Field>
                      <Field label="Açıklama" required>
                        <input
                          type="text"
                          value={borcNotes}
                          onChange={(e) => setBorcNotes(e.target.value)}
                          className={inputCls}
                          disabled={loadingType != null}
                          placeholder="ör. Boyahane ücreti"
                        />
                      </Field>
                      <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        disabled={loadingType != null}
                      >
                        {loadingType === 'borc' ? 'Kaydediliyor…' : 'Borç ekle'}
                      </Button>
                    </form>

                    <form
                      onSubmit={(e) => handleEntrySubmit('alacak', e)}
                      className="rounded-xl border border-ok/25 bg-ok-soft/30 p-4 space-y-3"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-ink">Alacak ekle</h3>
                        <p className="text-[11px] text-muted mt-0.5">Cariden alacak yazılır</p>
                      </div>
                      <Field label={`Tutar (${currencySymbol(currency)}, KDV hariç)`}>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={alacakAmount}
                          onChange={(e) => setAlacakAmount(e.target.value)}
                          className={inputCls}
                          disabled={loadingType != null}
                        />
                        {alacakGross != null && (
                          <p className="text-[11px] text-muted mt-1.5">
                            Kaydedilecek:{' '}
                            <span className="font-medium text-ink tabular-nums">
                              {formatMoneyKdv(alacakGross)}
                            </span>
                          </p>
                        )}
                      </Field>
                      <Field label="Açıklama" required>
                        <input
                          type="text"
                          value={alacakNotes}
                          onChange={(e) => setAlacakNotes(e.target.value)}
                          className={inputCls}
                          disabled={loadingType != null}
                          placeholder="ör. Nakliye bedeli"
                        />
                      </Field>
                      <Button
                        type="submit"
                        variant="accent"
                        fullWidth
                        disabled={loadingType != null}
                      >
                        {loadingType === 'alacak' ? 'Kaydediliyor…' : 'Alacak ekle'}
                      </Button>
                    </form>
                  </div>

                  {(error || message) && (
                    <div>
                      {error && (
                        <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
                          {error}
                        </p>
                      )}
                      {message && (
                        <p className="text-sm text-ok bg-ok-soft border border-ok/20 rounded-lg px-3 py-2 mt-2">
                          {message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
              <PanelHeader
                title="Hareket ekstresi"
                subtitle={`Borç / alacak · yürüyen bakiye · ${KDV_LABEL.toLowerCase()}`}
              />
              <CariStatementTable
                rows={statement.rows}
                totalBorc={statement.totalBorc}
                totalAlacak={statement.totalAlacak}
                closingBalance={statement.closingBalance}
                from={ekstreFrom}
                to={ekstreTo}
                onRangeChange={(f, t) => {
                  setEkstreFrom(f)
                  setEkstreTo(t)
                }}
              />
            </div>
          </>
        ) : (
          <div className="bg-surface rounded-xl border border-line p-10 text-center text-sm text-muted">
            Sol listeden cari seçin.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Seçili bakiyeleri sıfırla?"
        description={`${resetCheckedIds.length} cari için hareketler silinir ve başlangıç bakiyesi 0 yapılır. Stok kayıtları etkilenmez.`}
        confirmLabel="Sıfırla"
        danger
        loading={resetLoading}
        onConfirm={handleResetBalances}
        onCancel={() => setResetOpen(false)}
      >
        {resetCheckedNames.length > 0 && (
          <ul className="mt-3 max-h-32 overflow-y-auto text-sm text-ink-soft space-y-1">
            {resetCheckedNames.map((name) => (
              <li key={name} className="truncate">
                · {name}
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  )
}

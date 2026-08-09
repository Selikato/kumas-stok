'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  formatBalance,
  fromOpeningBalance,
  toOpeningBalance,
  type Party,
  type PartyKind,
} from '@/lib/cari'
import { fmt, parsePositiveNumber } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'
import { toTry, type MoneyCurrency } from '@/lib/money'
import CurrencyFields from '@/components/CurrencyFields'

type Props = {
  kind: Extract<PartyKind, 'tedarikci' | 'musteri'>
  title: string
  subtitle: string
  initialParties: Party[]
}

function matchesKind(party: Party, kind: 'tedarikci' | 'musteri') {
  return party.kind === kind || party.kind === 'her_ikisi'
}

type Draft = {
  name: string
  phone: string
  openingAmount: string
  openingSide: 'borc' | 'alacak'
  currency: MoneyCurrency
  fxRate: string
}

function emptyDraft(kind: 'tedarikci' | 'musteri'): Draft {
  return {
    name: '',
    phone: '',
    openingAmount: '',
    openingSide: kind === 'tedarikci' ? 'borc' : 'alacak',
    currency: 'TRY',
    fxRate: '',
  }
}

export default function PartyKindSettings({ kind, title, subtitle, initialParties }: Props) {
  const router = useRouter()
  const [parties, setParties] = useState(initialParties)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(kind))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<Draft>(emptyDraft(kind))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setParties(initialParties)
  }, [initialParties])

  const rows = useMemo(
    () =>
      parties
        .filter((p) => matchesKind(p, kind))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [parties, kind]
  )

  const selectCols = 'id, name, kind, phone, notes, opening_balance'
  const helpText =
    kind === 'tedarikci'
      ? 'Örn. tedarikçiye 300.000 ₺ borç → tutar 300000, yön Borç'
      : 'Örn. müşteriden 50.000 ₺ alacak → tutar 50000, yön Alacak'

  function parseOpening(
    amountStr: string,
    side: 'borc' | 'alacak',
    currency: MoneyCurrency,
    fxRateStr: string
  ): number | null {
    const amt = amountStr.trim() ? parseFloat(amountStr) : 0
    if (amountStr.trim() && (isNaN(amt) || amt < 0)) return null
    if (!amountStr.trim() || amt === 0) return toOpeningBalance(0, side)
    try {
      const { tryAmount } = toTry(
        amt,
        currency,
        currency === 'USD' ? parsePositiveNumber(fxRateStr) : 1
      )
      return toOpeningBalance(tryAmount, side)
    } catch {
      return null
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.name.trim()
    if (!trimmed) { setError('İsim zorunlu.'); return }
    const opening = parseOpening(draft.openingAmount, draft.openingSide, draft.currency, draft.fxRate)
    if (opening == null) {
      setError(draft.currency === 'USD' ? 'Geçerli tutar ve kur giriniz.' : 'Geçerli başlangıç bakiyesi giriniz.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    let { data, error: insertErr } = await supabase
      .from('parties')
      .insert({
        name: trimmed,
        kind,
        phone: draft.phone.trim() || null,
        opening_balance: opening,
      })
      .select(selectCols)
      .single()

    if (insertErr?.message?.includes('opening_balance')) {
      const fallback = await supabase
        .from('parties')
        .insert({ name: trimmed, kind, phone: draft.phone.trim() || null })
        .select('id, name, kind, phone, notes')
        .single()
      insertErr = fallback.error
      data = fallback.data ? { ...fallback.data, opening_balance: 0 } : null
      if (!insertErr) {
        setMessage(`“${trimmed}” eklendi. (Başlangıç bakiyesi için SQL migration gerekli)`)
      }
    }

    setLoading(false)
    if (insertErr) {
      setError(
        insertErr.message.includes('unique') || insertErr.code === '23505'
          ? 'Bu isimde cari zaten var.'
          : insertErr.message
      )
      return
    }

    setParties((prev) => [...prev, data as Party])
    setDraft(emptyDraft(kind))
    setMessage((m) => m || `“${trimmed}” eklendi.`)
    router.refresh()
  }

  function startEdit(p: Party) {
    const o = fromOpeningBalance(Number(p.opening_balance) || 0)
    setEditingId(p.id)
    setEdit({
      name: p.name,
      phone: p.phone || '',
      openingAmount: o.amount ? String(o.amount) : '',
      openingSide: o.side,
      currency: 'TRY',
      fxRate: '',
    })
    setError(null)
    setMessage(null)
  }

  async function saveEdit(p: Party) {
    const trimmed = edit.name.trim()
    if (!trimmed) { setError('İsim zorunlu.'); return }
    const opening = parseOpening(edit.openingAmount, edit.openingSide, edit.currency, edit.fxRate)
    if (opening == null) {
      setError(edit.currency === 'USD' ? 'Geçerli tutar ve kur giriniz.' : 'Geçerli başlangıç bakiyesi giriniz.')
      return
    }

    setLoading(true)
    setError(null)

    const payload: Record<string, unknown> = {
      name: trimmed,
      phone: edit.phone.trim() || null,
      opening_balance: opening,
    }

    let { error: upErr } = await supabase.from('parties').update(payload).eq('id', p.id)

    if (upErr?.message?.includes('opening_balance')) {
      const fb = await supabase
        .from('parties')
        .update({ name: trimmed, phone: edit.phone.trim() || null })
        .eq('id', p.id)
      upErr = fb.error
    }

    setLoading(false)
    if (upErr) {
      setError(
        upErr.message.includes('unique') || upErr.code === '23505'
          ? 'Bu isimde cari zaten var.'
          : upErr.message
      )
      return
    }

    setParties((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, name: trimmed, phone: edit.phone.trim() || null, opening_balance: opening }
          : x
      )
    )
    setEditingId(null)
    setMessage(`“${trimmed}” güncellendi.`)
    router.refresh()
  }

  async function handleDelete(p: Party) {
    setError(null)
    setMessage(null)
    setLoading(true)
    const { error: delErr } = await supabase.from('parties').delete().eq('id', p.id)
    setLoading(false)
    if (delErr) {
      setError(
        delErr.message.includes('foreign') || delErr.code === '23503'
          ? `“${p.name}” kullanımda; silinemez.`
          : delErr.message
      )
      return
    }
    setParties((prev) => prev.filter((x) => x.id !== p.id))
    setMessage(`“${p.name}” silindi.`)
    router.refresh()
  }

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <p className="text-xs text-muted mt-0.5">{subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-4 space-y-2 border-b border-line">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="İsim"
            className={inputCls}
            disabled={loading}
          />
          <input
            type="text"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            placeholder="Telefon"
            className={inputCls}
            disabled={loading}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="number"
            min="0"
            step="any"
            value={draft.openingAmount}
            onChange={(e) => setDraft((d) => ({ ...d, openingAmount: e.target.value }))}
            placeholder="Başlangıç bakiyesi"
            className={inputCls}
            disabled={loading}
          />
          <select
            value={draft.openingSide}
            onChange={(e) => setDraft((d) => ({ ...d, openingSide: e.target.value as 'borc' | 'alacak' }))}
            className={inputCls}
            disabled={loading}
          >
            <option value="borc">Borç</option>
            <option value="alacak">Alacak</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg"
          >
            Ekle
          </button>
        </div>
        <CurrencyFields
          currency={draft.currency}
          fxRate={draft.fxRate}
          onCurrencyChange={(c) => setDraft((d) => ({ ...d, currency: c }))}
          onFxRateChange={(v) => setDraft((d) => ({ ...d, fxRate: v }))}
          disabled={loading}
        />
        <p className="text-[11px] text-muted">{helpText}</p>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          {message && !error && (
            <p className="text-sm text-ok bg-ok-soft border border-ok/20 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-line max-h-80 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-5 py-8 text-sm text-muted text-center">Henüz kayıt yok.</li>
        ) : (
          rows.map((p) => {
            const opening = Number(p.opening_balance) || 0
            const formatted = formatBalance(opening)
            const editing = editingId === p.id
            return (
              <li key={p.id} className="px-5 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-[11px] text-muted">
                      {p.phone || (p.kind === 'her_ikisi' ? 'Tedarikçi & Müşteri' : '—')}
                    </p>
                    {!editing && (
                      <p className="text-xs text-ink-soft mt-1">
                        Başlangıç:{' '}
                        <span className="font-medium tabular-nums">
                          {formatted.amount === 0
                            ? 'yok'
                            : `₺${fmt(formatted.amount)} ${formatted.label}`}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        disabled={loading}
                        className="text-xs text-muted hover:text-ink disabled:opacity-50"
                      >
                        Düzenle
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={loading}
                      className="text-xs text-danger hover:text-danger disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                {editing && (
                  <div className="space-y-2 rounded-lg border border-line bg-paper/50 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={edit.name}
                        onChange={(e) => setEdit((d) => ({ ...d, name: e.target.value }))}
                        className={inputCls}
                        disabled={loading}
                        placeholder="İsim"
                      />
                      <input
                        type="text"
                        value={edit.phone}
                        onChange={(e) => setEdit((d) => ({ ...d, phone: e.target.value }))}
                        className={inputCls}
                        disabled={loading}
                        placeholder="Telefon"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={edit.openingAmount}
                        onChange={(e) => setEdit((d) => ({ ...d, openingAmount: e.target.value }))}
                        className={inputCls}
                        disabled={loading}
                        placeholder="Başlangıç bakiyesi"
                      />
                      <select
                        value={edit.openingSide}
                        onChange={(e) => setEdit((d) => ({ ...d, openingSide: e.target.value as 'borc' | 'alacak' }))}
                        className={inputCls}
                        disabled={loading}
                      >
                        <option value="borc">Borç</option>
                        <option value="alacak">Alacak</option>
                      </select>
                    </div>
                    <CurrencyFields
                      currency={edit.currency}
                      fxRate={edit.fxRate}
                      onCurrencyChange={(c) => setEdit((d) => ({ ...d, currency: c }))}
                      onFxRateChange={(v) => setEdit((d) => ({ ...d, fxRate: v }))}
                      disabled={loading}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(p)}
                        disabled={loading}
                        className="text-xs font-medium px-3 py-1.5 bg-ink text-surface rounded-md disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-muted px-2"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

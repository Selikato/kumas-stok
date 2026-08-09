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
import { fmt } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'

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
}

const EMPTY: Draft = {
  name: '',
  phone: '',
  openingAmount: '',
  openingSide: 'borc',
}

export default function PartyKindSettings({ kind, title, subtitle, initialParties }: Props) {
  const router = useRouter()
  const [parties, setParties] = useState(initialParties)
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY,
    openingSide: kind === 'tedarikci' ? 'borc' : 'alacak',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editSide, setEditSide] = useState<'borc' | 'alacak'>('borc')
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.name.trim()
    if (!trimmed) { setError('İsim zorunlu.'); return }
    const amt = draft.openingAmount.trim() ? parseFloat(draft.openingAmount) : 0
    if (draft.openingAmount.trim() && (isNaN(amt) || amt < 0)) {
      setError('Geçerli başlangıç bakiyesi giriniz.')
      return
    }
    const opening = toOpeningBalance(amt || 0, draft.openingSide)

    setLoading(true)
    setError(null)
    setMessage(null)

    const payload: Record<string, unknown> = {
      name: trimmed,
      kind,
      phone: draft.phone.trim() || null,
      opening_balance: opening,
    }

    let { data, error: insertErr } = await supabase
      .from('parties')
      .insert(payload)
      .select(selectCols)
      .single()

    if (insertErr?.message?.includes('opening_balance')) {
      const fallback = await supabase
        .from('parties')
        .insert({ name: trimmed, kind, phone: draft.phone.trim() || null })
        .select('id, name, kind, phone, notes')
        .single()
      insertErr = fallback.error
      data = fallback.data
        ? { ...fallback.data, opening_balance: 0 }
        : null
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
    setDraft({ ...EMPTY, openingSide: kind === 'tedarikci' ? 'borc' : 'alacak' })
    if (!message) setMessage(`“${trimmed}” eklendi.`)
    router.refresh()
  }

  function startEdit(p: Party) {
    const o = fromOpeningBalance(Number(p.opening_balance) || 0)
    setEditingId(p.id)
    setEditAmount(o.amount ? String(o.amount) : '')
    setEditSide(o.side)
    setError(null)
    setMessage(null)
  }

  async function saveOpening(p: Party) {
    const amt = editAmount.trim() ? parseFloat(editAmount) : 0
    if (editAmount.trim() && (isNaN(amt) || amt < 0)) {
      setError('Geçerli tutar giriniz.')
      return
    }
    const opening = toOpeningBalance(amt || 0, editSide)
    setLoading(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('parties')
      .update({ opening_balance: opening })
      .eq('id', p.id)
    setLoading(false)
    if (upErr) {
      setError(
        upErr.message.includes('opening_balance')
          ? 'Başlangıç bakiyesi kolonu yok. SQL migration’ı çalıştırın.'
          : upErr.message
      )
      return
    }
    setParties((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, opening_balance: opening } : x))
    )
    setEditingId(null)
    setMessage(`“${p.name}” başlangıç bakiyesi güncellendi.`)
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-4 space-y-2 border-b border-gray-100">
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
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
          >
            Ekle
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          Örn. tedarikçiye 300.000 ₺ borç → tutar 300000, yön Borç
        </p>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {message && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-5 py-8 text-sm text-gray-400 text-center">Henüz kayıt yok.</li>
        ) : (
          rows.map((p) => {
            const opening = Number(p.opening_balance) || 0
            const formatted = formatBalance(opening)
            const editing = editingId === p.id
            return (
              <li key={p.id} className="px-5 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {p.phone || (p.kind === 'her_ikisi' ? 'Tedarikçi & Müşteri' : '—')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        disabled={loading}
                        className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        Bakiye
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                {editing ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className={`${inputCls} max-w-[9rem]`}
                      disabled={loading}
                    />
                    <select
                      value={editSide}
                      onChange={(e) => setEditSide(e.target.value as 'borc' | 'alacak')}
                      className={`${inputCls} max-w-[7rem]`}
                      disabled={loading}
                    >
                      <option value="borc">Borç</option>
                      <option value="alacak">Alacak</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => saveOpening(p)}
                      disabled={loading}
                      className="text-xs font-medium px-2.5 py-1.5 bg-gray-900 text-white rounded-md disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-500"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">
                    Başlangıç:{' '}
                    <span className="font-medium tabular-nums">
                      {formatted.amount === 0
                        ? 'yok'
                        : `₺${fmt(formatted.amount)} ${formatted.label}`}
                    </span>
                  </p>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

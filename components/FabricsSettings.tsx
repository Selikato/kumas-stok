'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { generateFabricCode, unitLabel, type FabricUnit } from '@/lib/helpers'
import { inputCls } from '@/lib/stockHelpers'

export type FabricRow = {
  id: string
  name: string
  unit: string | null
}

type Props = {
  initialFabrics: FabricRow[]
}

export default function FabricsSettings({ initialFabrics }: Props) {
  const router = useRouter()
  const [fabrics, setFabrics] = useState(initialFabrics)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<FabricUnit | ''>('metre')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState<FabricUnit | ''>('metre')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setFabrics(initialFabrics)
  }, [initialFabrics])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Kumaş adı zorunlu.'); return }
    if (!unit) { setError('Birim seçiniz.'); return }
    if (fabrics.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Bu isimde kumaş zaten var.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error: insertErr } = await supabase
      .from('fabrics')
      .insert({
        name: trimmed,
        fabric_code: generateFabricCode(trimmed),
        unit,
      })
      .select('id, name, unit')
      .single()

    setLoading(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setFabrics((prev) =>
      [...prev, data as FabricRow].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    )
    setName('')
    setMessage(`“${trimmed}” eklendi. Stok girişinde listede görünür.`)
    router.refresh()
  }

  async function handleDelete(f: FabricRow) {
    setError(null)
    setMessage(null)

    const { data: variants } = await supabase
      .from('variants')
      .select('id')
      .eq('fabric_id', f.id)

    const variantIds = (variants ?? []).map((v) => v.id)
    if (variantIds.length > 0) {
      const { count } = await supabase
        .from('rolls')
        .select('id', { count: 'exact', head: true })
        .in('variant_id', variantIds)

      if ((count ?? 0) > 0) {
        setError(`“${f.name}” için stok kaydı var. Önce stokları / hareketleri temizleyin.`)
        return
      }
    }

    setLoading(true)
    if (variantIds.length > 0) {
      await supabase.from('variants').delete().in('id', variantIds)
    }
    const { error: delErr } = await supabase.from('fabrics').delete().eq('id', f.id)
    setLoading(false)

    if (delErr) {
      setError(delErr.message)
      return
    }

    setFabrics((prev) => prev.filter((x) => x.id !== f.id))
    setMessage(`“${f.name}” silindi.`)
    router.refresh()
  }

  function startEdit(f: FabricRow) {
    setEditingId(f.id)
    setEditName(f.name)
    setEditUnit((f.unit as FabricUnit) || 'metre')
    setError(null)
    setMessage(null)
  }

  async function saveEdit(f: FabricRow) {
    const trimmed = editName.trim()
    if (!trimmed) { setError('Kumaş adı zorunlu.'); return }
    if (!editUnit) { setError('Birim seçiniz.'); return }
    if (fabrics.some((x) => x.id !== f.id && x.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Bu isimde kumaş zaten var.')
      return
    }

    setLoading(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('fabrics')
      .update({ name: trimmed, unit: editUnit })
      .eq('id', f.id)
    setLoading(false)
    if (upErr) { setError(upErr.message); return }

    setFabrics((prev) =>
      prev
        .map((x) => (x.id === f.id ? { ...x, name: trimmed, unit: editUnit } : x))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    )
    setEditingId(null)
    setMessage(`“${trimmed}” güncellendi.`)
    router.refresh()
  }

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-display text-lg text-ink">Kumaşlar</h2>
        <p className="text-xs text-muted mt-0.5">
          Stok giriş/çıkış listesindeki kumaş kartları
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-line"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kumaş adı"
          className={inputCls}
          disabled={loading}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as FabricUnit)}
          className={inputCls}
          disabled={loading}
        >
          <option value="metre">Metre</option>
          <option value="kg">Kg</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg"
        >
          Ekle
        </button>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          {message && !error && (
            <p className="text-sm text-ok bg-ok-soft border border-ok/20 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-line">
        {fabrics.length === 0 ? (
          <li className="px-5 py-8 text-sm text-muted text-center">Henüz kumaş yok.</li>
        ) : (
          fabrics.map((f) => (
            <li key={f.id} className="px-5 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{f.name}</p>
                  <p className="text-[11px] text-muted">{unitLabel(f.unit) || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingId !== f.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      disabled={loading}
                      className="text-xs text-muted hover:text-ink disabled:opacity-50"
                    >
                      Düzenle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(f)}
                    disabled={loading}
                    className="text-xs text-danger hover:text-danger disabled:opacity-50"
                  >
                    Sil
                  </button>
                </div>
              </div>
              {editingId === f.id && (
                <div className="flex flex-wrap gap-2 items-center rounded-lg border border-line bg-paper/50 p-2.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`${inputCls} max-w-[12rem]`}
                    disabled={loading}
                  />
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value as FabricUnit)}
                    className={`${inputCls} max-w-[7rem]`}
                    disabled={loading}
                  >
                    <option value="metre">Metre</option>
                    <option value="kg">Kg</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => saveEdit(f)}
                    disabled={loading}
                    className="text-xs font-medium px-3 py-1.5 bg-ink text-surface rounded-md disabled:opacity-50"
                  >
                    Kaydet
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted">
                    Vazgeç
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

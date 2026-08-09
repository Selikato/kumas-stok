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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Kumaşlar</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Stok giriş/çıkış listesindeki kumaş kartları
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-gray-100"
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
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg"
        >
          Ekle
        </button>
      </form>

      {(error || message) && (
        <div className="px-5 py-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {message && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{message}</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {fabrics.length === 0 ? (
          <li className="px-5 py-8 text-sm text-gray-400 text-center">Henüz kumaş yok.</li>
        ) : (
          fabrics.map((f) => (
            <li key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{f.name}</p>
                <p className="text-[11px] text-gray-400">{unitLabel(f.unit) || '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(f)}
                disabled={loading}
                className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Sil
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

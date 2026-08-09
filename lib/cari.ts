export type PartyKind = 'tedarikci' | 'musteri' | 'her_ikisi'

export type Party = {
  id: string
  name: string
  kind: PartyKind
  phone: string | null
  notes: string | null
}

export type AccountEntryType = 'borc' | 'alacak' | 'odeme' | 'tahsilat'

export type AccountEntry = {
  id: string
  occurred_at: string
  party_id: string
  entry_type: AccountEntryType
  amount: number
  voucher_number: string | null
  notes: string | null
  movement_id: string | null
}

/** Pozitif = onlar bize borçlu (alacak), negatif = biz onlara borçluyuz (borç) */
export function partyBalance(entries: Pick<AccountEntry, 'entry_type' | 'amount'>[]): number {
  let bal = 0
  for (const e of entries) {
    const a = Number(e.amount)
    if (e.entry_type === 'alacak') bal += a
    else if (e.entry_type === 'tahsilat') bal -= a
    else if (e.entry_type === 'borc') bal -= a
    else if (e.entry_type === 'odeme') bal += a
  }
  return bal
}

export function formatBalance(bal: number): { label: string; amount: number } {
  if (Math.abs(bal) < 0.005) return { label: 'Bakiye yok', amount: 0 }
  if (bal > 0) return { label: 'Alacak', amount: bal }
  return { label: 'Borç', amount: Math.abs(bal) }
}

export function partyKindLabel(kind: PartyKind): string {
  if (kind === 'tedarikci') return 'Tedarikçi'
  if (kind === 'musteri') return 'Müşteri'
  return 'Tedarikçi & Müşteri'
}

export function entryTypeLabel(t: AccountEntryType): string {
  switch (t) {
    case 'borc': return 'Borç (alış)'
    case 'alacak': return 'Alacak (satış)'
    case 'odeme': return 'Ödeme'
    case 'tahsilat': return 'Tahsilat'
  }
}

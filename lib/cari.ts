export type PartyKind = 'tedarikci' | 'musteri' | 'her_ikisi'

export type Party = {
  id: string
  name: string
  kind: PartyKind
  phone: string | null
  notes: string | null
  /** + alacak, − borç */
  opening_balance: number
}

export type AccountEntryType = 'borc' | 'alacak' | 'odeme' | 'tahsilat'

export type PaymentMethod = 'nakit' | 'eft' | 'havale' | 'cek' | 'kart' | 'diger'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'nakit', label: 'Nakit' },
  { value: 'eft', label: 'EFT' },
  { value: 'havale', label: 'Havale' },
  { value: 'cek', label: 'Çek' },
  { value: 'kart', label: 'Kart' },
  { value: 'diger', label: 'Diğer' },
]

export type AccountEntry = {
  id: string
  occurred_at: string
  party_id: string
  entry_type: AccountEntryType
  amount: number
  voucher_number: string | null
  notes: string | null
  movement_id: string | null
  payment_method: PaymentMethod | string | null
}

/** Pozitif = onlar bize borçlu (alacak), negatif = biz onlara borçluyuz (borç) */
export function partyBalance(
  entries: Pick<AccountEntry, 'entry_type' | 'amount'>[],
  openingBalance = 0
): number {
  let bal = Number(openingBalance) || 0
  for (const e of entries) {
    const a = Number(e.amount)
    if (e.entry_type === 'alacak') bal += a
    else if (e.entry_type === 'tahsilat') bal -= a
    else if (e.entry_type === 'borc') bal -= a
    else if (e.entry_type === 'odeme') bal += a
  }
  return bal
}

/** Müşterinin bizdeki alacağı — biz ona borçluysak (bakiye negatif) */
export function customerStoreCredit(balance: number): number {
  return balance < -0.005 ? Math.abs(balance) : 0
}

/** Tedarikçi tarafında bizim alacağımız — onlar bize borçluysa (bakiye pozitif, tedarikçi) */
export function supplierStoreCredit(balance: number): number {
  return balance > 0.005 ? balance : 0
}

/** Satış sonrası tahsil edilecek net tutar (TRY, ≥ 0) */
export function netDueAfterSale(balance: number, saleTotal: number): number {
  return Math.max(0, balance + saleTotal)
}

/** Alış sonrası tedarikçiye ödenecek net tutar (TRY, ≥ 0) */
export function netDueAfterPurchase(balance: number, purchaseTotal: number): number {
  const newBal = balance - purchaseTotal
  return newBal < -0.005 ? Math.abs(newBal) : 0
}

/** Satışta mahsup edilen alacak (müşterinin bizdeki bakiyesi) */
export function creditAppliedOnSale(balance: number, saleTotal: number): number {
  return Math.min(customerStoreCredit(balance), saleTotal)
}

/** Alışta mahsup edilen alacak (tedarikçiye fazla ödememiz) */
export function creditAppliedOnPurchase(balance: number, purchaseTotal: number): number {
  return Math.min(supplierStoreCredit(balance), purchaseTotal)
}

export function formatBalance(bal: number): { label: string; amount: number } {
  if (Math.abs(bal) < 0.005) return { label: 'Bakiye yok', amount: 0 }
  if (bal > 0) return { label: 'Alacak', amount: bal }
  return { label: 'Borç', amount: Math.abs(bal) }
}

/** UI için: tutar + yön → işaretli opening_balance */
export function toOpeningBalance(amount: number, side: 'borc' | 'alacak'): number {
  if (!(amount > 0)) return 0
  return side === 'alacak' ? amount : -amount
}

export function fromOpeningBalance(bal: number): { amount: number; side: 'borc' | 'alacak' } {
  if (bal >= 0) return { amount: bal, side: 'alacak' }
  return { amount: Math.abs(bal), side: 'borc' }
}

/** Müşteride borç / tedarikçide alacak = ters bakiye */
export function isReverseBalance(kind: PartyKind, bal: number): boolean {
  if (Math.abs(bal) < 0.005) return false
  if (kind === 'musteri') return bal < 0
  if (kind === 'tedarikci') return bal > 0
  return false
}

export function partyKindLabel(kind: PartyKind): string {
  if (kind === 'tedarikci') return 'Tedarikçi'
  if (kind === 'musteri') return 'Müşteri'
  return 'Tedarikçi & Müşteri'
}

export function entryTypeLabel(t: AccountEntryType): string {
  switch (t) {
    case 'borc':
      return 'Borç'
    case 'alacak':
      return 'Alacak'
    case 'odeme':
      return 'Ödeme'
    case 'tahsilat':
      return 'Tahsilat'
  }
}

/** Formdaki tek “Ödeme” seçeneği → veritabanı kayıt tipi */
export function resolvePaymentEntryType(kind: PartyKind, balance: number): 'odeme' | 'tahsilat' {
  if (kind === 'musteri') return 'tahsilat'
  if (kind === 'tedarikci') return 'odeme'
  if (balance > 0.005) return 'tahsilat'
  if (balance < -0.005) return 'odeme'
  return 'tahsilat'
}

export function paymentEntryHint(kind: PartyKind, balance: number): string {
  const t = resolvePaymentEntryType(kind, balance)
  if (t === 'tahsilat') return 'Alacak tahsil edilir (müşteri ödedi).'
  return 'Borç ödenir (tedarikçiye / cariye ödeme).'
}

export function paymentMethodLabel(m: string | null | undefined): string {
  if (!m) return ''
  return PAYMENT_METHODS.find((x) => x.value === m)?.label || m
}

export function entryTypeLabelDetailed(e: Pick<AccountEntry, 'entry_type' | 'movement_id'>): string {
  if (e.entry_type === 'alacak' && e.movement_id) return 'Alacak (satış)'
  if (e.entry_type === 'borc' && e.movement_id) return 'Borç (alış)'
  return entryTypeLabel(e.entry_type)
}

/**
 * Uygulama bakiyesi ile aynı yön:
 * Alacak kolonu bakiyeyi + yapar (onlar bize borçlu), borç kolonu − yapar.
 */
export function entryDebitCredit(type: AccountEntryType, amount: number): { borc: number; alacak: number } {
  const a = Number(amount) || 0
  if (type === 'alacak' || type === 'odeme') return { borc: 0, alacak: a }
  return { borc: a, alacak: 0 }
}

export type PartyStatementRow = {
  id: string
  occurred_at: string
  label: string
  voucher: string | null
  notes: string | null
  payment_method: string | null
  borc: number
  alacak: number
  balance: number
  isOpening: boolean
}

export function buildPartyStatement(
  entries: AccountEntry[],
  openingBalance = 0,
  range?: { from?: string; to?: string }
): {
  rows: PartyStatementRow[]
  totalBorc: number
  totalAlacak: number
  closingBalance: number
} {
  const from = range?.from?.slice(0, 10) || ''
  const to = range?.to?.slice(0, 10) || ''

  const chrono = entries.slice().sort((a, b) => {
    const d = a.occurred_at.localeCompare(b.occurred_at)
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })

  let running = Number(openingBalance) || 0
  const rows: PartyStatementRow[] = []

  const inRange = (date: string) => {
    const d = date.slice(0, 10)
    if (from && d < from) return 'before'
    if (to && d > to) return 'after'
    return 'in'
  }

  for (const e of chrono) {
    const pos = inRange(e.occurred_at)
    if (pos === 'after') continue
    const { borc, alacak } = entryDebitCredit(e.entry_type, e.amount)
    running += alacak - borc
    if (pos === 'before') continue
    const method = paymentMethodLabel(e.payment_method)
    rows.push({
      id: e.id,
      occurred_at: e.occurred_at,
      label: entryTypeLabelDetailed(e),
      voucher: e.voucher_number,
      notes: [e.notes, method].filter(Boolean).join(' · ') || null,
      payment_method: e.payment_method,
      borc,
      alacak,
      balance: running,
      isOpening: false,
    })
  }

  const openingAtStart = (() => {
    let bal = Number(openingBalance) || 0
    if (!from) return bal
    for (const e of chrono) {
      if (e.occurred_at.slice(0, 10) >= from) break
      const { borc, alacak } = entryDebitCredit(e.entry_type, e.amount)
      bal += alacak - borc
    }
    return bal
  })()

  if (Math.abs(openingAtStart) > 0.005) {
    const formatted = formatBalance(openingAtStart)
    rows.unshift({
      id: '__opening__',
      occurred_at: from || '',
      label: 'Devir',
      voucher: null,
      notes: `Başlangıç bakiyesi (${formatted.label})`,
      payment_method: null,
      borc: openingAtStart < 0 ? formatted.amount : 0,
      alacak: openingAtStart > 0 ? formatted.amount : 0,
      balance: openingAtStart,
      isOpening: true,
    })
  }

  const periodRows = rows.filter((r) => !r.isOpening)
  const totalBorc = periodRows.reduce((s, r) => s + r.borc, 0)
  const totalAlacak = periodRows.reduce((s, r) => s + r.alacak, 0)
  const closingBalance = rows.length ? rows[rows.length - 1].balance : openingAtStart

  return { rows, totalBorc, totalAlacak, closingBalance }
}

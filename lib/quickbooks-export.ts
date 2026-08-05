/**
 * QuickBooks-ready CSV builders for Little Scientist.
 *
 * Formats target QuickBooks Online / Desktop CSV import workflows:
 * - Sales Receipts (revenue + VAT)
 * - Journal Entries (double-entry lines)
 * - Bank / M-Pesa float deposits
 *
 * Amounts in the park are VAT-inclusive at 16%. We split for export.
 */

export const QB_VAT_RATE = 0.16

export type QbSalesRowInput = {
  date: string // YYYY-MM-DD
  receiptNo: string
  customer: string
  email?: string
  itemName: string
  itemDescription: string
  quantity?: number
  amountInclVat: number
  paymentMethod?: string
  depositAccount?: string
  memo?: string
  mpesaReceipt?: string
}

export type QbJournalLineInput = {
  journalNo: string
  journalDate: string
  accountName: string
  accountCode?: string
  debits: number
  credits: number
  description: string
  name?: string
  className?: string
  memo?: string
}

export type QbBankRowInput = {
  date: string
  description: string
  amount: number // positive = money in
  payee?: string
  memo?: string
}

/** Split a VAT-inclusive amount into excl + VAT (Kenya 16%). */
export function splitVatIncl(incl: number, rate = QB_VAT_RATE) {
  const gross = Number(incl) || 0
  const excl = Math.round((gross / (1 + rate)) * 100) / 100
  const vat = Math.round((gross - excl) * 100) / 100
  return { excl, vat, incl: Math.round(gross * 100) / 100 }
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    const needs = /[",\n\r]/.test(s)
    const inner = s.replace(/"/g, '""')
    return needs ? `"${inner}"` : inner
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Map internal COA codes → suggested QuickBooks account names. */
export const QB_ACCOUNT_MAP: Record<string, string> = {
  '1001': 'M-Pesa Float (Bank)',
  '2001': 'Deferred Revenue - Merch Preorders',
  '4001': 'Ticket Sales',
  '4002': 'Merchandise Sales',
  '4003': 'In-Venue Sales',
  '4004': 'School Visits',
  '4005': 'Events & Parties',
  '4010': 'Platform / Processing Fees Income',
  VAT_OUTPUT: 'VAT Output (KRA 16%)',
  UNCATEGORISED: 'Uncategorised Income',
}

/**
 * QuickBooks Online–style Sales Receipt CSV.
 * Import via: Settings → Import Data → or third-party Sales importer.
 * Tax is shown separately; ItemAmount is VAT-exclusive.
 */
export function buildSalesReceiptCsvRows(inputs: QbSalesRowInput[]): Record<string, unknown>[] {
  return inputs.map(r => {
    const qty = r.quantity && r.quantity > 0 ? r.quantity : 1
    const { excl, vat, incl } = splitVatIncl(r.amountInclVat)
    const rate = Math.round((excl / qty) * 100) / 100
    return {
      '*SalesReceiptNo': r.receiptNo,
      '*SalesReceiptDate': r.date,
      Customer: r.customer || 'Walk-in Customer',
      Email: r.email || '',
      Item: r.itemName,
      ItemDescription: r.itemDescription,
      ItemQuantity: qty,
      ItemRate: rate.toFixed(2),
      '*ItemAmount': excl.toFixed(2),
      ItemTaxCode: 'VAT 16%',
      ItemTaxAmount: vat.toFixed(2),
      AmountInclVAT: incl.toFixed(2),
      PaymentMethod: r.paymentMethod || 'M-Pesa',
      DepositToAccount: r.depositAccount || QB_ACCOUNT_MAP['1001'],
      Memo: r.memo || '',
      MpesaReceipt: r.mpesaReceipt || '',
      Currency: 'KES',
    }
  })
}

/**
 * QuickBooks Journal Entry CSV (one debit line + one credit line per entry).
 * Columns match common QBO / Desktop journal import templates.
 */
export function buildJournalEntryCsvRows(lines: QbJournalLineInput[]): Record<string, unknown>[] {
  return lines.map(l => ({
    JournalNo: l.journalNo,
    JournalDate: l.journalDate,
    AccountName: l.accountName,
    AccountCode: l.accountCode || '',
    Debits: l.debits > 0 ? l.debits.toFixed(2) : '',
    Credits: l.credits > 0 ? l.credits.toFixed(2) : '',
    Description: l.description,
    Name: l.name || '',
    Class: l.className || '',
    Memo: l.memo || '',
    Currency: 'KES',
  }))
}

/**
 * Expand a single double-entry journal into debit + credit lines.
 * Optionally splits revenue credit into Net Sales + VAT Output.
 */
export function expandJournalToQbLines(p: {
  journalNo: string
  journalDate: string
  description: string
  debitCode: string
  creditCode: string
  amountInclVat: number
  splitVatOnRevenue?: boolean
  name?: string
  memo?: string
}): QbJournalLineInput[] {
  const debitName = QB_ACCOUNT_MAP[p.debitCode] || `Account ${p.debitCode}`
  const creditName = QB_ACCOUNT_MAP[p.creditCode] || `Account ${p.creditCode}`
  const isRevenue = /^40/.test(p.creditCode)
  const { excl, vat, incl } = splitVatIncl(p.amountInclVat)

  const lines: QbJournalLineInput[] = [
    {
      journalNo: p.journalNo,
      journalDate: p.journalDate,
      accountName: debitName,
      accountCode: p.debitCode,
      debits: incl,
      credits: 0,
      description: p.description,
      name: p.name,
      memo: p.memo,
    },
  ]

  if (p.splitVatOnRevenue && isRevenue && vat > 0) {
    lines.push({
      journalNo: p.journalNo,
      journalDate: p.journalDate,
      accountName: creditName,
      accountCode: p.creditCode,
      debits: 0,
      credits: excl,
      description: p.description,
      name: p.name,
      memo: p.memo,
    })
    lines.push({
      journalNo: p.journalNo,
      journalDate: p.journalDate,
      accountName: QB_ACCOUNT_MAP.VAT_OUTPUT,
      accountCode: 'VAT_OUTPUT',
      debits: 0,
      credits: vat,
      description: `${p.description} — VAT 16%`,
      name: p.name,
      memo: p.memo,
    })
  } else {
    lines.push({
      journalNo: p.journalNo,
      journalDate: p.journalDate,
      accountName: creditName,
      accountCode: p.creditCode,
      debits: 0,
      credits: incl,
      description: p.description,
      name: p.name,
      memo: p.memo,
    })
  }

  return lines
}

/** Bank feed style CSV for reconciling M-Pesa float in QuickBooks. */
export function buildBankDepositCsvRows(inputs: QbBankRowInput[]): Record<string, unknown>[] {
  return inputs.map(r => ({
    Date: r.date,
    Description: r.description,
    Amount: Number(r.amount || 0).toFixed(2),
    Payee: r.payee || 'Safaricom M-Pesa',
    Memo: r.memo || '',
    Currency: 'KES',
  }))
}

/** Suggested Chart of Accounts seed for QuickBooks setup. */
export function buildChartOfAccountsCsvRows(): Record<string, unknown>[] {
  return Object.entries(QB_ACCOUNT_MAP).map(([code, name]) => {
    let type = 'Income'
    if (code.startsWith('1')) type = 'Bank'
    else if (code.startsWith('2')) type = 'Other Current Liability'
    else if (code === 'VAT_OUTPUT') type = 'Other Current Liability'
    return {
      AccountCode: code,
      AccountName: name,
      AccountType: type,
      Currency: 'KES',
      DetailType: type === 'Bank' ? 'Checking' : type === 'Income' ? 'Sales of Product Income' : 'Other Current Liabilities',
      Notes: 'Create this account in QuickBooks before importing CSVs',
    }
  })
}

export function sourceLabel(sourceType?: string | null): string {
  const t = String(sourceType || '').toLowerCase()
  if (t.includes('booking') || t === 'ticket') return 'Ticket Sales'
  if (t.includes('merch')) return 'Merchandise Sales'
  if (t.includes('in_venue') || t.includes('invenue')) return 'In-Venue Sales'
  if (t.includes('school')) return 'School Visits'
  if (t.includes('event') || t.includes('birthday')) return 'Events & Parties'
  if (t.includes('manual')) return 'Manual Adjustment'
  return 'Other Income'
}

export function itemNameForSource(sourceType?: string | null): string {
  const t = String(sourceType || '').toLowerCase()
  if (t.includes('booking')) return 'Park Admission Tickets'
  if (t.includes('merch')) return 'Merchandise'
  if (t.includes('in_venue') || t.includes('invenue')) return 'In-Venue Purchase'
  if (t.includes('school')) return 'School Visit Package'
  if (t.includes('event') || t.includes('birthday')) return 'Event / Birthday Package'
  return 'General Sale'
}

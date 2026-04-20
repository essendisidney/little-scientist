'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'overview' | 'ledger' | 'trial' | 'cashbook' | 'manual'

function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function kes(v: unknown) {
  const n = typeof v === 'number' ? v : v == null ? 0 : Number(v)
  const safe = Number.isFinite(n) ? n : 0
  return `KES ${safe.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toCsv(rows: Record<string, unknown>[]) {
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

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
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

function tabFilename(tab: string) {
  const date = yyyyMmDd(new Date())
  return `littlescientist-${tab}-${date}.csv`
}

function fmtRef(sourceType?: string | null, sourceId?: string | null) {
  if (!sourceType && !sourceId) return ''
  const t = (sourceType || '').toUpperCase()
  const id = (sourceId || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return id ? `${t}-${id}` : t
}

const REV_LABELS: Record<string, { label: string; code?: string; positive: boolean }> = {
  tickets: { label: 'Tickets', code: '4001', positive: true },
  merchandise: { label: 'Merchandise', code: '4002', positive: true },
  invenue: { label: 'In-Venue', code: '4003', positive: true },
  school: { label: 'School', code: '4004', positive: true },
  events: { label: 'Events', code: '4005', positive: true },
}

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Overview
  const [revRows, setRevRows] = useState<any[]>([])

  // Ledger
  const today = yyyyMmDd(new Date())
  const [glFrom, setGlFrom] = useState('')
  const [glTo, setGlTo] = useState(today)
  const [glSource, setGlSource] = useState<'all' | 'booking' | 'merch' | 'invenue' | 'school' | 'manual' | 'events'>('all')
  const [glRows, setGlRows] = useState<any[]>([])
  const [glRecon, setGlRecon] = useState<Record<string, boolean>>({})

  // Trial balance
  const [tbRows, setTbRows] = useState<any[]>([])

  // Daily cashbook
  const [cbFrom, setCbFrom] = useState('')
  const [cbTo, setCbTo] = useState(today)
  const [cbRows, setCbRows] = useState<any[]>([])

  // Manual entry
  const [accounts, setAccounts] = useState<{ code: string; name: string; account_type?: string; active?: boolean }[]>([])
  const [mDate, setMDate] = useState(today)
  const [mDesc, setMDesc] = useState('')
  const [mDebit, setMDebit] = useState('')
  const [mCredit, setMCredit] = useState('')
  const [mAmount, setMAmount] = useState('')
  const [mNotes, setMNotes] = useState('')
  const [posting, setPosting] = useState(false)
  const [manualRecent, setManualRecent] = useState<any[]>([])

  const pillStyle: React.CSSProperties = useMemo(
    () => ({
      padding: '10px 14px',
      borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(255,255,255,0.04)',
      color: 'rgba(255,255,255,0.6)',
      cursor: 'pointer',
      fontWeight: 800,
      fontSize: 12,
      letterSpacing: '0.04em',
      fontFamily: 'Nunito, sans-serif',
      whiteSpace: 'nowrap',
    }),
    [],
  )

  const activePillStyle: React.CSSProperties = useMemo(
    () => ({
      ...pillStyle,
      border: '1px solid rgba(255,215,0,0.35)',
      background: 'rgba(255,215,0,0.08)',
      color: '#FFD700',
    }),
    [pillStyle],
  )

  useEffect(() => {
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const [revRes, tbRes, accRes] = await Promise.all([
          supabase.from('v_revenue_by_stream').select('*'),
          supabase.from('v_trial_balance').select('*'),
          supabase.from('coa_accounts').select('code,name,account_type,active').order('code', { ascending: true }),
        ])
        if (revRes.error) throw revRes.error
        if (tbRes.error) throw tbRes.error
        if (accRes.error) throw accRes.error
        setRevRows(revRes.data || [])
        setTbRows(tbRes.data || [])
        setAccounts((accRes.data || []) as any)
      } catch (e: any) {
        setError(e?.message || 'Failed to load accounting data.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const key = 'ls_admin_gl_reconciled_v1'
    try {
      const raw = localStorage.getItem(key)
      if (raw) setGlRecon(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ls_admin_gl_reconciled_v1', JSON.stringify(glRecon))
    } catch {
      // ignore
    }
  }, [glRecon])

  async function loadLedger() {
    setError('')
    let q = supabase.from('v_general_ledger').select('*').order('entry_date', { ascending: false })
    if (glFrom) q = q.gte('entry_date', glFrom)
    if (glTo) q = q.lte('entry_date', glTo)
    if (glSource !== 'all') q = q.eq('source_type', glSource)
    const { data, error } = await q
    if (error) {
      setError(error.message)
      setGlRows([])
      return
    }
    setGlRows(data || [])
  }

  async function loadCashbook() {
    setError('')
    let q = supabase.from('v_daily_cashbook').select('*').order('entry_date', { ascending: true })
    if (cbFrom) q = q.gte('entry_date', cbFrom)
    if (cbTo) q = q.lte('entry_date', cbTo)
    const { data, error } = await q
    if (error) {
      setError(error.message)
      setCbRows([])
      return
    }
    setCbRows(data || [])
  }

  async function loadManualRecent() {
    setError('')
    const { data, error } = await supabase
      .from('v_general_ledger')
      .select('*')
      .eq('source_type', 'manual')
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      setError(error.message)
      setManualRecent([])
      return
    }
    setManualRecent(data || [])
  }

  useEffect(() => {
    if (tab === 'ledger') void loadLedger()
    if (tab === 'cashbook') void loadCashbook()
    if (tab === 'manual') void loadManualRecent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const monthStart = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return yyyyMmDd(d)
  }, [])
  const monthEnd = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return yyyyMmDd(d)
  }, [])

  const revenueAgg = useMemo(() => {
    const all: Record<string, number> = {}
    const month: Record<string, number> = {}
    for (const k of Object.keys(REV_LABELS)) {
      all[k] = 0
      month[k] = 0
    }
    for (const r of revRows || []) {
      const code = String(r.revenue_account || r.account_code || '')
      const amt = Number(r.revenue_kes ?? r.amount_kes ?? 0) || 0
      const date = String(r.entry_date || r.date || '')
      const hit = Object.entries(REV_LABELS).find(([, v]) => v.code === code)
      if (!hit) continue
      const key = hit[0]
      all[key] += amt
      if (date >= monthStart && date <= monthEnd) month[key] += amt
    }
    const allTotal = Object.values(all).reduce((s, n) => s + n, 0)
    const monthTotal = Object.values(month).reduce((s, n) => s + n, 0)
    return { all, month, allTotal, monthTotal }
  }, [revRows, monthStart, monthEnd])

  const groupedTrial = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const r of tbRows || []) {
      const t = String(r.account_type || 'other').toLowerCase()
      ;(groups[t] ||= []).push(r)
    }
    const order = ['asset', 'liability', 'equity', 'revenue', 'expense', 'other']
    const titles: Record<string, string> = {
      asset: 'Assets',
      liability: 'Liabilities',
      equity: 'Equity',
      revenue: 'Revenue',
      expense: 'Expenses',
      other: 'Other',
    }
    const entries = order.filter(k => groups[k]?.length).map(k => [k, titles[k] || k, groups[k]] as const)
    return entries
  }, [tbRows])

  async function postManual() {
    setError('')
    if (!mDesc.trim() || !mDebit || !mCredit || !mAmount) {
      setError('Please fill description, debit, credit, and amount.')
      return
    }
    const amt = Number(mAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Amount must be a positive number.')
      return
    }
    setPosting(true)
    try {
      const fullDesc = `${mDate} — ${mDesc.trim()}${mNotes.trim() ? ` (Notes: ${mNotes.trim()})` : ''}`
      const { error } = await supabase.rpc('post_journal_entry', {
        p_description: fullDesc,
        p_source_type: 'manual',
        p_source_id: null,
        p_debit_code: mDebit,
        p_credit_code: mCredit,
        p_amount_kes: amt,
        p_mpesa_receipt: '',
      })
      if (error) throw error
      setMDesc('')
      setMAmount('')
      setMNotes('')
      await Promise.all([loadManualRecent(), loadLedger()])
    } catch (e: any) {
      setError(e?.message || 'Failed to post journal entry.')
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#060d1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        Loading accounting...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; }
        .h1 { font-family: 'Fredoka One', cursive; font-size: 26px; }
        .grad { background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; }
        .th { background: rgba(13,21,53,0.9); }
        .rowA { background: rgba(255,255,255,0.02); }
        .rowB { background: rgba(255,255,255,0.035); }
        .inp { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px; color: #fff; font-weight: 700; font-family: Nunito, sans-serif; }
        .btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px; color: rgba(255,255,255,0.7); font-weight: 900; cursor: pointer; font-family: Nunito, sans-serif; }
        .btn:hover { border-color: rgba(255,215,0,0.25); color: #FFD700; }
      `}</style>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div className="h1 grad">📚 Accounting</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: 700, marginTop: 6 }}>
              P&L, ledger, trial balance, daily cashbook, and manual journals.
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 800 }}>
            Month: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{monthKey()}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button style={tab === 'overview' ? activePillStyle : pillStyle} onClick={() => setTab('overview')}>
            Overview (P&L)
          </button>
          <button style={tab === 'ledger' ? activePillStyle : pillStyle} onClick={() => setTab('ledger')}>
            General Ledger
          </button>
          <button style={tab === 'trial' ? activePillStyle : pillStyle} onClick={() => setTab('trial')}>
            Trial Balance
          </button>
          <button style={tab === 'cashbook' ? activePillStyle : pillStyle} onClick={() => setTab('cashbook')}>
            Daily Cashbook
          </button>
          <button style={tab === 'manual' ? activePillStyle : pillStyle} onClick={() => setTab('manual')}>
            Manual Journal Entry
          </button>
        </div>

        {error && (
          <div
            className="card"
            style={{
              padding: '12px 14px',
              marginBottom: 16,
              borderColor: 'rgba(255,80,80,0.25)',
              background: 'rgba(255,80,80,0.06)',
              color: 'rgba(255,180,180,0.9)',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18 }}>Revenue overview</div>
              <button
                className="btn"
                onClick={() => {
                  const rows = Object.keys(REV_LABELS).map(k => ({
                    stream: REV_LABELS[k].label,
                    this_month_kes: revenueAgg.month[k] || 0,
                    all_time_kes: revenueAgg.all[k] || 0,
                  }))
                  rows.push({ stream: 'TOTAL', this_month_kes: revenueAgg.monthTotal, all_time_kes: revenueAgg.allTotal })
                  downloadCsv(tabFilename('overview'), rows)
                }}
              >
                ⬇️ Export CSV
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {Object.keys(REV_LABELS).map(k => {
                const meta = REV_LABELS[k]
                const month = revenueAgg.month[k] || 0
                const all = revenueAgg.all[k] || 0
                const color = meta.positive ? '#2ecc71' : '#ff6b6b'
                return (
                  <div key={k} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {meta.label}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>This month</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color }}>{kes(month)}</div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>All time</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>{kes(all)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 900,
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.55)' }}>Monthly total</div>
              <div style={{ color: '#FFD700', fontFamily: "'Fredoka One',cursive" }}>{kes(revenueAgg.monthTotal)}</div>
            </div>
          </div>
        )}

        {tab === 'ledger' && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18 }}>General ledger</div>
              <button
                className="btn"
                onClick={() => {
                  const rows = (glRows || []).map((r: any) => ({
                    date: r.entry_date || '',
                    ref: fmtRef(r.source_type, r.source_id),
                    description: r.description || '',
                    debit_account: r.debit_account_code || '',
                    credit_account: r.credit_account_code || '',
                    amount_kes: r.amount_kes ?? '',
                    mpesa_receipt: r.mpesa_receipt || '',
                    reconciled: !!glRecon[`${r.entry_date}|${r.source_type}|${r.source_id}|${r.amount_kes}|${r.mpesa_receipt}`],
                  }))
                  downloadCsv(tabFilename('general-ledger'), rows)
                }}
              >
                ⬇️ Export CSV
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>From</div>
                <input className="inp" type="date" value={glFrom} onChange={e => setGlFrom(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>To</div>
                <input className="inp" type="date" value={glTo} onChange={e => setGlTo(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Source</div>
                <select className="inp" value={glSource} onChange={e => setGlSource(e.target.value as any)}>
                  <option value="all">All</option>
                  <option value="booking">Booking</option>
                  <option value="merch">Merch</option>
                  <option value="invenue">In-Venue</option>
                  <option value="school">School</option>
                  <option value="events">Events</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <button className="btn" onClick={loadLedger} style={{ alignSelf: 'end' }}>
                🔎 Apply filters
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 980 }}>
                <thead>
                  <tr className="th">
                    {['Date', 'Ref', 'Description', 'Debit Account', 'Credit Account', 'Amount (KES)', 'M-Pesa Receipt', 'Reconciled'].map(h => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === 'Amount (KES)' ? 'right' : 'left',
                          padding: '12px 12px',
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.65)',
                          fontWeight: 900,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(glRows || []).map((r: any, idx: number) => {
                    const key = `${r.entry_date}|${r.source_type}|${r.source_id}|${r.amount_kes}|${r.mpesa_receipt}`
                    const amount = Number(r.amount_kes || 0) || 0
                    const amountColor = amount >= 0 ? '#2ecc71' : '#ff6b6b'
                    return (
                      <tr key={key} className={idx % 2 === 0 ? 'rowA' : 'rowB'}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {r.entry_date || ''}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {fmtRef(r.source_type, r.source_id)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
                          {r.description || ''}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {r.debit_account_code || ''}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {r.credit_account_code || ''}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: amountColor, fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {kes(amount)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {r.mpesa_receipt || ''}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!glRecon[key]}
                            onChange={e => setGlRecon(prev => ({ ...prev, [key]: e.target.checked }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                  {(!glRows || glRows.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ padding: 16, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>
                        No ledger entries found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'trial' && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18 }}>Trial balance</div>
              <button
                className="btn"
                onClick={() => {
                  const rows = (tbRows || []).map((r: any) => ({
                    code: r.code,
                    account_name: r.name,
                    type: r.account_type,
                    total_debits: r.total_debits ?? '',
                    total_credits: r.total_credits ?? '',
                    net_balance: r.net_balance ?? '',
                  }))
                  downloadCsv(tabFilename('trial-balance'), rows)
                }}
              >
                ⬇️ Export CSV
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 860 }}>
                <thead>
                  <tr className="th">
                    {['Code', 'Account Name', 'Type', 'Total Debits', 'Total Credits', 'Net Balance'].map(h => (
                      <th
                        key={h}
                        style={{
                          textAlign: h.includes('Total') || h.includes('Net') ? 'right' : 'left',
                          padding: '12px 12px',
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.65)',
                          fontWeight: 900,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedTrial.map(([key, title, rows]) => {
                    const totals = rows.reduce(
                      (acc, r: any) => {
                        acc.deb += Number(r.total_debits ?? 0) || 0
                        acc.cred += Number(r.total_credits ?? 0) || 0
                        acc.net += Number(r.net_balance ?? 0) || 0
                        return acc
                      },
                      { deb: 0, cred: 0, net: 0 },
                    )
                    return (
                      <React.Fragment key={key}>
                        <tr>
                          <td colSpan={6} style={{ padding: '12px 12px', color: '#FFD700', fontWeight: 900, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {title}
                          </td>
                        </tr>
                        {rows.map((r: any, idx: number) => {
                          const deb = Number(r.total_debits ?? 0) || 0
                          const cred = Number(r.total_credits ?? 0) || 0
                          const net = Number(r.net_balance ?? 0) || 0
                          const netColor = net >= 0 ? '#2ecc71' : '#ff6b6b'
                          return (
                            <tr key={`${r.code}-${idx}`} className={idx % 2 === 0 ? 'rowA' : 'rowB'}>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 900, whiteSpace: 'nowrap' }}>{r.code}</td>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 800 }}>{r.name}</td>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 800, whiteSpace: 'nowrap' }}>{r.account_type}</td>
                              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                {kes(deb)}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                {kes(cred)}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: netColor, fontWeight: 900, whiteSpace: 'nowrap' }}>{kes(net)}</td>
                            </tr>
                          )
                        })}
                        <tr>
                          <td colSpan={3} style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 900 }}>
                            Totals ({title})
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 900 }}>{kes(totals.deb)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontWeight: 900 }}>{kes(totals.cred)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: totals.net >= 0 ? '#2ecc71' : '#ff6b6b', fontWeight: 900 }}>{kes(totals.net)}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.55)' }}>
              Debits = Credits check:{' '}
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                {tbRows && tbRows.length ? 'Review totals per group (requires debits/credits columns in the DB view).' : 'No rows.'}
              </span>
            </div>
          </div>
        )}

        {tab === 'cashbook' && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18 }}>Daily cashbook</div>
              <button
                className="btn"
                onClick={() => {
                  let running = 0
                  const rows = (cbRows || []).map((r: any) => {
                    const received = Number(r.total_received_kes ?? r.mpesa_inflows_kes ?? 0) || 0
                    running += received
                    return {
                      date: r.entry_date || '',
                      transactions: r.transactions ?? '',
                      total_received_kes: received,
                      mpesa_receipts: r.mpesa_receipts ?? '',
                      running_total_kes: running,
                    }
                  })
                  downloadCsv(tabFilename('daily-cashbook'), rows)
                }}
              >
                ⬇️ Export CSV
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>From</div>
                <input className="inp" type="date" value={cbFrom} onChange={e => setCbFrom(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>To</div>
                <input className="inp" type="date" value={cbTo} onChange={e => setCbTo(e.target.value)} />
              </div>
              <button className="btn" onClick={loadCashbook} style={{ alignSelf: 'end' }}>
                🔎 Apply filters
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 840 }}>
                <thead>
                  <tr className="th">
                    {['Date', 'Transactions', 'Total Received (KES)', 'M-Pesa Receipts', 'Running Total'].map(h => (
                      <th
                        key={h}
                        style={{
                          textAlign: h.includes('Total') ? 'right' : 'left',
                          padding: '12px 12px',
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.65)',
                          fontWeight: 900,
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let running = 0
                    return (cbRows || []).map((r: any, idx: number) => {
                      const received = Number(r.total_received_kes ?? r.mpesa_inflows_kes ?? 0) || 0
                      running += received
                      return (
                        <tr key={`${r.entry_date}-${idx}`} className={idx % 2 === 0 ? 'rowA' : 'rowB'}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 900, whiteSpace: 'nowrap' }}>{r.entry_date}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 800 }}>{r.transactions ?? ''}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: '#2ecc71', fontWeight: 900, whiteSpace: 'nowrap' }}>{kes(received)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>{r.mpesa_receipts ?? ''}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.85)', fontWeight: 900, whiteSpace: 'nowrap' }}>{kes(running)}</td>
                        </tr>
                      )
                    })
                  })()}
                  {(!cbRows || cbRows.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ padding: 16, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>
                        No cashbook rows found for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'manual' && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 18 }}>Manual journal entry</div>
              <button
                className="btn"
                onClick={() => {
                  const rows = (manualRecent || []).map((r: any) => ({
                    date: r.entry_date || '',
                    ref: fmtRef(r.source_type, r.source_id),
                    description: r.description || '',
                    debit: r.debit_account_code || '',
                    credit: r.credit_account_code || '',
                    amount_kes: r.amount_kes ?? '',
                    mpesa_receipt: r.mpesa_receipt || '',
                  }))
                  downloadCsv(tabFilename('manual-journal'), rows)
                }}
              >
                ⬇️ Export CSV
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Date</div>
                <input className="inp" type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Amount (KES)</div>
                <input className="inp" inputMode="decimal" value={mAmount} onChange={e => setMAmount(e.target.value)} placeholder="e.g. 1000" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Description</div>
                <input className="inp" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="What is this entry for?" style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Debit account</div>
                <select className="inp" value={mDebit} onChange={e => setMDebit(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {accounts
                    .filter(a => a.active !== false)
                    .map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Credit account</div>
                <select className="inp" value={mCredit} onChange={e => setMCredit(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select…</option>
                  {accounts
                    .filter(a => a.active !== false)
                    .map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Source Type</div>
                <input className="inp" value="manual" readOnly style={{ width: '100%', opacity: 0.8 }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 900, marginBottom: 6 }}>Notes</div>
                <input className="inp" value={mNotes} onChange={e => setMNotes(e.target.value)} placeholder="Optional notes" style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={postManual} disabled={posting} style={{ color: '#fff', background: posting ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#FF4080,#FF8C00)', border: '1px solid rgba(255,255,255,0.14)' }}>
                {posting ? 'Posting…' : '➕ Post journal entry'}
              </button>
              <button className="btn" onClick={loadManualRecent}>
                🔄 Refresh recent
              </button>
            </div>

            <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 16, marginBottom: 10 }}>Recent manual entries (last 10)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 860 }}>
                  <thead>
                    <tr className="th">
                      {['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Amount'].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === 'Amount' ? 'right' : 'left',
                            padding: '12px 12px',
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.65)',
                            fontWeight: 900,
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(manualRecent || []).map((r: any, idx: number) => (
                      <tr key={`${r.created_at || ''}-${idx}`} className={idx % 2 === 0 ? 'rowA' : 'rowB'}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 900, whiteSpace: 'nowrap' }}>{r.entry_date || ''}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 900, whiteSpace: 'nowrap' }}>{fmtRef(r.source_type, r.source_id)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 800 }}>{r.description || ''}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 900, whiteSpace: 'nowrap' }}>{r.debit_account_code || ''}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 900, whiteSpace: 'nowrap' }}>{r.credit_account_code || ''}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', color: '#2ecc71', fontWeight: 900, whiteSpace: 'nowrap' }}>{kes(r.amount_kes ?? 0)}</td>
                      </tr>
                    ))}
                    {(!manualRecent || manualRecent.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ padding: 16, color: 'rgba(255,255,255,0.35)', fontWeight: 800 }}>
                          No manual entries found yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


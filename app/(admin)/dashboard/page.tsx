'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'overview' | 'accounting' | 'visitors'

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
  for (const r of rows) {
    lines.push(headers.map(h => esc(r[h])).join(','))
  }
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

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [kpis, setKpis] = useState({ ticketRev: 0, visitors: 0, bookings: 0 })
  const [sessions, setSessions] = useState<{ id?: string; time_slot: string; capacity: number; booked_count: number; is_blocked?: boolean }[]>([])
  const [recent, setRecent] = useState<
    {
      booking_ref: string
      booker_name: string | null
      adult_count: number
      child_count: number
      total_amount_kes: number
      payment_status: string
    }[]
  >([])
  const [trialBalance, setTrialBalance] = useState<
    { code: string; name: string; account_type: string; net_balance: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [bRes, sRes, rRes, tbRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('total_amount_kes, adult_count, child_count')
          .eq('payment_status', 'paid'),
        supabase.from('sessions').select('id, time_slot, capacity, booked_count, is_blocked').eq('session_date', today),
        supabase
          .from('bookings')
          .select('booking_ref, booker_name, adult_count, child_count, total_amount_kes, payment_status')
          .order('created_at', { ascending: false })
          .limit(15),
        supabase.from('v_trial_balance').select('*').neq('net_balance', 0),
      ])
      const paid = bRes.data || []
      setKpis({
        ticketRev: paid.reduce((s, b) => s + b.total_amount_kes, 0),
        visitors: paid.reduce((s, b) => s + b.adult_count + b.child_count, 0),
        bookings: paid.length,
      })
      setSessions((sRes.data || []) as typeof sessions)
      setRecent((rRes.data || []) as typeof recent)
      setTrialBalance((tbRes.data || []) as typeof trialBalance)
      setLoading(false)
    }
    load()
  }, [today])

  const SLOT_LABELS: Record<string, string> = {
    '10:00-12:00': '10am – 12pm',
    '12:00-14:00': '12pm – 2pm',
    '14:00-16:00': '2pm – 4pm',
  }

  async function toggleBlock(sessionId: string, nextBlocked: boolean) {
    await supabase.from('sessions').update({ is_blocked: nextBlocked }).eq('id', sessionId)
    const { data } = await supabase
      .from('sessions')
      .select('id, time_slot, capacity, booked_count, is_blocked')
      .eq('session_date', today)
    setSessions((data || []) as typeof sessions)
  }

  async function exportOverview() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booker_name, booker_phone, adult_count, child_count, sessions(time_slot, session_date)')
      if (error) throw error
      const rows =
        (((data || []) as any[])
          .filter(b => b.sessions?.session_date === today)
          .map(b => ({
            visitor_name: b.booker_name || '',
            phone: b.booker_phone || '',
            count: (b.adult_count || 0) + (b.child_count || 0),
            time_slot: SLOT_LABELS[b.sessions?.time_slot || ''] || b.sessions?.time_slot || '',
          })) as Record<string, unknown>[]) || []
      downloadCsv(`overview-bookings-${today}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  async function exportVisitors() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_ref, booker_name, adult_count, child_count, total_amount_kes, payment_status, sessions(session_date)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows =
        (data || []).map((b: any) => ({
          ref: b.booking_ref,
          name: b.booker_name || '',
          adult_count: b.adult_count,
          child_count: b.child_count,
          amount_kes: b.total_amount_kes,
          payment_status: b.payment_status,
          date: b.sessions?.session_date || '',
        })) || []
      downloadCsv(`visitors-bookings-${today}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  async function exportAccounting() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        // Prefer a view if present in DB
        .from('v_journal_entries')
        .select('*')
        .order('entry_date', { ascending: false })
      if (error) throw error
      const rows =
        (data || []).map((e: any) => ({
          date: e.entry_date || e.date || '',
          description: e.description || '',
          debit_account: e.debit_account || e.debit_code || e.debit || '',
          credit_account: e.credit_account || e.credit_code || e.credit || '',
          amount: e.amount_kes ?? e.amount ?? '',
          mpesa_receipt: e.mpesa_receipt || e.mpesa_receipt_number || '',
        })) || []
      downloadCsv(`accounting-journal-${today}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  if (loading)
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
        Loading dashboard...
      </div>
    )

  return (
    <div style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ padding: 24 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total revenue', val: `KES ${kpis.ticketRev.toLocaleString()}`, color: '#ffd700' },
            { label: 'Total visitors', val: kpis.visitors.toString(), color: '#7fffd4' },
            { label: 'Bookings', val: kpis.bookings.toString(), color: '#ff7235' },
          ].map(k => (
            <div
              key={k.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                {k.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
          {(['overview', 'accounting', 'visitors'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid #ffd700' : '2px solid transparent',
                color: tab === t ? '#ffd700' : 'rgba(255,255,255,0.4)',
                padding: '12px 20px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Nunito, sans-serif',
                textTransform: 'capitalize' as const,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Today's sessions — {today}</div>
              <button
                onClick={exportOverview}
                disabled={exporting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: exporting ? 'rgba(255,255,255,0.4)' : '#ffd700',
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                {exporting ? 'Exporting…' : '⬇️ Export CSV'}
              </button>
            </div>
            {sessions.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No sessions for today yet.</div>
            ) : (
              sessions.map(s => {
                const pct = s.capacity > 0 ? Math.round((s.booked_count / s.capacity) * 100) : 0
                return (
                  <div key={s.time_slot} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>{SLOT_LABELS[s.time_slot] || s.time_slot}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {s.booked_count}/{s.capacity} · {pct}%{s.is_blocked ? ' · blocked' : ''}
                        </span>
                        {s.id && (
                          <button
                            onClick={() => toggleBlock(s.id as string, !s.is_blocked)}
                            style={{
                              background: s.is_blocked ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: s.is_blocked ? '#4ade80' : '#f87171',
                              padding: '6px 10px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 900,
                              fontFamily: 'Nunito, sans-serif',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8 }}>
                      <div
                        style={{
                          background: pct > 80 ? '#f87171' : pct > 50 ? '#ffd700' : '#4ade80',
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 4,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Accounting */}
        {tab === 'accounting' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Trial Balance</div>
              <button
                onClick={exportAccounting}
                disabled={exporting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: exporting ? 'rgba(255,255,255,0.4)' : '#ffd700',
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                {exporting ? 'Exporting…' : '⬇️ Export CSV'}
              </button>
            </div>
            {trialBalance.length === 0 ? (
              <div style={{ padding: '16px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                No journal entries yet. Entries appear automatically after the first payment.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Code', 'Account', 'Type', 'Balance'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left' as const,
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: 11,
                          textTransform: 'uppercase' as const,
                          fontWeight: 700,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.map((a, i) => (
                    <tr
                      key={a.code}
                      style={{
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
                        {a.code}
                      </td>
                      <td style={{ padding: '10px 16px' }}>{a.name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: a.account_type === 'revenue' ? 'rgba(74,222,128,0.1)' : 'rgba(96,165,250,0.1)',
                            color: a.account_type === 'revenue' ? '#4ade80' : '#60a5fa',
                          }}
                        >
                          {a.account_type}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          fontWeight: 700,
                          textAlign: 'right' as const,
                          color: a.net_balance >= 0 ? '#4ade80' : '#f87171',
                        }}
                      >
                        KES {Math.abs(a.net_balance).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Visitors */}
        {tab === 'visitors' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Recent bookings</div>
              <button
                onClick={exportVisitors}
                disabled={exporting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: exporting ? 'rgba(255,255,255,0.4)' : '#ffd700',
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                {exporting ? 'Exporting…' : '⬇️ Export CSV'}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Ref', 'Name', 'Visitors', 'Amount', 'Status'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left' as const,
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 11,
                        textTransform: 'uppercase' as const,
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((b, i) => (
                  <tr
                    key={b.booking_ref}
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <a href={`/ticket/${b.booking_ref}`} style={{ color: '#ffd700', textDecoration: 'none', fontFamily: 'monospace' }}>
                        {b.booking_ref}
                      </a>
                    </td>
                    <td style={{ padding: '10px 16px' }}>{b.booker_name || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>
                      {b.adult_count}A · {b.child_count}C
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700 }}>KES {b.total_amount_kes.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: b.payment_status === 'paid' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                          color: b.payment_status === 'paid' ? '#4ade80' : '#f87171',
                        }}
                      >
                        {b.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

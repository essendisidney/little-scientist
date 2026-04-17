'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'overview' | 'accounting' | 'visitors'

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [kpis, setKpis] = useState({ ticketRev: 0, visitors: 0, bookings: 0 })
  const [sessions, setSessions] = useState<{ time_slot: string; capacity: number; booked_count: number }[]>([])
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
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [bRes, sRes, rRes, tbRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('total_amount_kes, adult_count, child_count')
          .eq('payment_status', 'paid'),
        supabase.from('sessions').select('time_slot, capacity, booked_count').eq('session_date', today),
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
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Today's sessions — {today}</div>
            {sessions.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No sessions for today yet.</div>
            ) : (
              sessions.map(s => {
                const pct = s.capacity > 0 ? Math.round((s.booked_count / s.capacity) * 100) : 0
                return (
                  <div key={s.time_slot} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span>{SLOT_LABELS[s.time_slot] || s.time_slot}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {s.booked_count}/{s.capacity} · {pct}%
                      </span>
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
            <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 16 }}>Trial Balance</div>
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
            <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 16 }}>Recent bookings</div>
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

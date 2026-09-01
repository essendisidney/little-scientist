'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { sessionOpenSpots } from '@/lib/session-capacity'
import { staffFetch } from '@/lib/staff-fetch'

const ENQUIRY_STATUSES = ['pending', 'contacted', 'confirmed', 'declined'] as const

function guardianEmailFromNotes(notes?: string | null): string {
  const m = String(notes || '').match(/Guardian email:\s*(\S+@\S+)/i)
  return m?.[1] || '—'
}

function paymentStatusStyle(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s === 'paid') return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80' }
  if (s === 'pending' || s === 'processing') return { bg: 'rgba(255,217,74,0.12)', color: '#ffd700' }
  if (s === 'expired') return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
  return { bg: 'rgba(248,113,113,0.1)', color: '#f87171' }
}

function enquiryStatusStyle(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s === 'confirmed') return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80' }
  if (s === 'contacted') return { bg: 'rgba(56,189,248,0.12)', color: '#38bdf8' }
  if (s === 'declined') return { bg: 'rgba(248,113,113,0.12)', color: '#f87171' }
  return { bg: 'rgba(255,217,74,0.12)', color: '#ffd700' }
}

function phoneTel(href: string) {
  const digits = href.replace(/\D/g, '')
  return digits ? `tel:+${digits.startsWith('254') ? digits : `254${digits.replace(/^0/, '')}`}` : undefined
}

type Tab = 'overview' | 'accounting' | 'visitors' | 'enquiries'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Bookings',
  accounting: 'Payments & export',
  visitors: 'Customer records',
  enquiries: 'Enquiries',
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

function toLocalDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(y, (m || 1) - 1, (d || 1) + days)
  return toLocalDateKey(next)
}

function formatLongDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const navBtnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
  fontFamily: 'Nunito, sans-serif',
}

const SLOT_LABELS: Record<string, string> = {
  '09:00-11:00': '9:00 AM – 11:00 AM',
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '11:00-13:00': '11:00 AM – 1:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '13:00-15:00': '1:00 PM – 3:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
  '15:00-17:00': '3:00 PM – 5:00 PM',
}

export default function DashboardPage() {
  const today = toLocalDateKey()
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedDate, setSelectedDate] = useState(today)
  const [kpis, setKpis] = useState({ ticketRev: 0, visitors: 0, bookings: 0 })
  const [sessions, setSessions] = useState<
    {
      id?: string
      time_slot: string
      capacity: number
      booked_count: number
      held_count?: number
      pending_count?: number
      is_blocked?: boolean
    }[]
  >([])
  const [slotEdits, setSlotEdits] = useState<Record<string, { capacity: string; held: string }>>({})
  const [dayBookings, setDayBookings] = useState<
    {
      booking_ref: string
      booker_name: string | null
      booker_phone?: string | null
      adult_count: number
      child_count: number
      total_amount_kes: number
      payment_status: string
      sessions?: { time_slot?: string; session_date?: string } | null
    }[]
  >([])
  const [recent, setRecent] = useState<
    {
      booking_ref: string
      booker_name: string | null
      adult_count: number
      child_count: number
      total_amount_kes: number
      payment_status: string
      sessions?: { session_date?: string; time_slot?: string } | null
    }[]
  >([])
  const [trialBalance, setTrialBalance] = useState<
    { code: string; name: string; account_type: string; net_balance: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [dateLoading, setDateLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [birthdayEnquiries, setBirthdayEnquiries] = useState<
    {
      enquiry_ref: string
      parent_name: string
      phone: string
      guest_count: number
      preferred_date: string
      status: string
      special_requirements?: string | null
      created_at?: string
    }[]
  >([])
  const [schoolEnquiries, setSchoolEnquiries] = useState<
    {
      enquiry_ref: string
      school_name: string
      contact_name: string
      contact_phone: string
      contact_email: string
      student_count: number
      preferred_date: string
      status: string
      created_at?: string
    }[]
  >([])
  const [enquiriesLoading, setEnquiriesLoading] = useState(false)
  const [enquiryFilter, setEnquiryFilter] = useState<string>('all')
  const [pendingEnquiryCount, setPendingEnquiryCount] = useState(0)

  useEffect(() => {
    async function load() {
      setDateLoading(true)
      await fetch('/api/sessions/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate: selectedDate }),
      }).catch(() => null)

      const sRes = await supabase
        .from('sessions')
        .select('id, time_slot, capacity, booked_count, held_count, pending_count, is_blocked')
        .eq('session_date', selectedDate)
        .order('time_slot')
      const sessionIds = ((sRes.data || []) as { id: string }[]).map(s => s.id)

      const [bRes, dayRes, rRes, tbRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('total_amount_kes, adult_count, child_count')
          .eq('payment_status', 'paid'),
        sessionIds.length
          ? supabase
              .from('bookings')
              .select(
                'booking_ref, booker_name, booker_phone, adult_count, child_count, total_amount_kes, payment_status, session_id, sessions(time_slot, session_date)',
              )
              .in('session_id', sessionIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as never[] }),
        supabase
          .from('bookings')
          .select('booking_ref, booker_name, adult_count, child_count, total_amount_kes, payment_status, sessions(session_date, time_slot)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('v_trial_balance').select('*').neq('net_balance', 0),
      ])
      const paid = bRes.data || []
      setKpis({
        ticketRev: paid.reduce((s, b) => s + b.total_amount_kes, 0),
        visitors: paid.reduce((s, b) => s + b.adult_count + b.child_count, 0),
        bookings: paid.length,
      })
      setSessions((sRes.data || []) as typeof sessions)
      setSlotEdits({})
      setDayBookings((dayRes.data || []) as typeof dayBookings)
      setRecent((rRes.data || []) as typeof recent)
      setTrialBalance((tbRes.data || []) as typeof trialBalance)

      const [bPending, sPending] = await Promise.all([
        supabase.from('birthday_enquiries').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('school_enquiries').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      setPendingEnquiryCount((bPending.count || 0) + (sPending.count || 0))

      setLoading(false)
      setDateLoading(false)
    }
    load()
  }, [selectedDate])

  async function loadEnquiries() {
    setEnquiriesLoading(true)
    const [bRes, sRes] = await Promise.all([
      supabase
        .from('birthday_enquiries')
        .select('enquiry_ref, parent_name, phone, guest_count, preferred_date, status, special_requirements, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('school_enquiries')
        .select('enquiry_ref, school_name, contact_name, contact_phone, contact_email, student_count, preferred_date, status, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
    ])
    const birthdays = (bRes.data || []) as typeof birthdayEnquiries
    const schools = (sRes.data || []) as typeof schoolEnquiries
    setBirthdayEnquiries(birthdays)
    setSchoolEnquiries(schools)
    setPendingEnquiryCount(
      birthdays.filter(e => e.status === 'pending').length + schools.filter(e => e.status === 'pending').length,
    )
    setEnquiriesLoading(false)
  }

  useEffect(() => {
    if (tab !== 'enquiries') return
    void loadEnquiries()
  }, [tab])

  function filterByStatus<T extends { status: string }>(items: T[]) {
    if (enquiryFilter === 'all') return items
    return items.filter(e => e.status === enquiryFilter)
  }

  async function exportEnquiries() {
    setExporting(true)
    try {
      const rows = [
        ...birthdayEnquiries.map(e => ({
          type: 'birthday',
          ref: e.enquiry_ref,
          name: e.parent_name,
          phone: e.phone,
          email: guardianEmailFromNotes(e.special_requirements),
          guests: e.guest_count,
          preferred_date: e.preferred_date,
          status: e.status,
        })),
        ...schoolEnquiries.map(e => ({
          type: 'school',
          ref: e.enquiry_ref,
          school: e.school_name,
          contact: e.contact_name,
          phone: e.contact_phone,
          email: e.contact_email,
          students: e.student_count,
          preferred_date: e.preferred_date,
          status: e.status,
        })),
      ]
      downloadCsv(`enquiries-${today}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  async function updateEnquiryStatus(type: 'birthday' | 'school', enquiryRef: string, status: string) {
    setActionError('')
    const res = await staffFetch('/api/admin/enquiries', {
      method: 'PATCH',
      body: JSON.stringify({ type, enquiryRef, status }),
    })
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      setActionError(data?.error || 'Could not update enquiry status.')
      return
    }
    if (type === 'birthday') {
      setBirthdayEnquiries(prev => {
        const next = prev.map(e => (e.enquiry_ref === enquiryRef ? { ...e, status } : e))
        setPendingEnquiryCount(
          next.filter(e => e.status === 'pending').length +
            schoolEnquiries.filter(e => e.status === 'pending').length,
        )
        return next
      })
    } else {
      setSchoolEnquiries(prev => {
        const next = prev.map(e => (e.enquiry_ref === enquiryRef ? { ...e, status } : e))
        setPendingEnquiryCount(
          birthdayEnquiries.filter(e => e.status === 'pending').length +
            next.filter(e => e.status === 'pending').length,
        )
        return next
      })
    }
  }

  function slotEdit(s: { id?: string; time_slot: string; capacity: number; held_count?: number }) {
    const key = s.id || s.time_slot
    return slotEdits[key] ?? { capacity: String(s.capacity ?? 100), held: String(s.held_count ?? 0) }
  }

  async function toggleBlock(sessionId: string, nextBlocked: boolean) {
    setActionError('')
    setBlockingId(sessionId)
    const { data, error } = await supabase
      .from('sessions')
      .update({
        is_blocked: nextBlocked,
        block_reason: nextBlocked ? 'Slot closed by admin' : null,
      })
      .eq('id', sessionId)
      .select('id, time_slot, capacity, booked_count, held_count, is_blocked')
      .single()

    if (error || !data) {
      setActionError(error?.message || 'Could not update this slot. Try signing out and back in.')
      setBlockingId(null)
      return
    }

    setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, ...data } : s)))
    setBlockingId(null)
  }

  async function saveSlotLimits(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    const edit = slotEdit(session)
    const capacity = Math.max(0, Math.min(500, Math.floor(Number(edit.capacity))))
    const held = Math.max(0, Math.min(500, Math.floor(Number(edit.held))))
    if (!Number.isFinite(capacity) || !Number.isFinite(held)) {
      setActionError('Enter whole numbers for capacity and held tickets.')
      return
    }

    setActionError('')
    setBlockingId(sessionId)
    const { data, error } = await supabase
      .from('sessions')
      .update({
        capacity,
        held_count: held,
        block_reason: held > 0 ? `Held ${held} ticket${held === 1 ? '' : 's'} by admin` : session.is_blocked ? 'Slot closed by admin' : null,
      })
      .eq('id', sessionId)
      .select('id, time_slot, capacity, booked_count, held_count, is_blocked')
      .single()

    if (error || !data) {
      setActionError(error?.message || 'Could not save slot limits. Try signing out and back in.')
      setBlockingId(null)
      return
    }

    setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, ...data } : s)))
    setSlotEdits(prev => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
    setBlockingId(null)
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
          .filter(b => b.sessions?.session_date === selectedDate)
          .map(b => ({
            visitor_name: b.booker_name || '',
            phone: b.booker_phone || '',
            count: (b.adult_count || 0) + (b.child_count || 0),
            time_slot: SLOT_LABELS[b.sessions?.time_slot || ''] || b.sessions?.time_slot || '',
            date: b.sessions?.session_date || selectedDate,
          })) as Record<string, unknown>[]) || []
      downloadCsv(`overview-bookings-${selectedDate}.csv`, rows)
    } finally {
      setExporting(false)
    }
  }

  async function exportVisitors() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_ref, booker_name, adult_count, child_count, total_amount_kes, payment_status, sessions(session_date, time_slot)')
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
          time_slot: SLOT_LABELS[b.sessions?.time_slot || ''] || b.sessions?.time_slot || '',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
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
          {(['overview', 'accounting', 'visitors', 'enquiries'] as Tab[]).map(t => (
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {TAB_LABELS[t]}
              {t === 'enquiries' && pendingEnquiryCount > 0 && (
                <span
                  style={{
                    background: 'rgba(255,217,74,0.2)',
                    color: '#ffd700',
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {pendingEnquiryCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  Sessions — {formatLongDate(selectedDate)}
                  {selectedDate === today ? ' (Today)' : ''}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                  {dateLoading
                    ? 'Loading this day’s bookings…'
                    : 'Hold some tickets (e.g. 5 of 100), change capacity, or close the whole slot.'}
                </div>
                {actionError && (
                  <div style={{ fontSize: 12, color: '#f87171', marginTop: 8, fontWeight: 700 }}>{actionError}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                  style={navBtnStyle}
                >
                  ← Previous
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => e.target.value && setSelectedDate(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    padding: '8px 10px',
                    borderRadius: 10,
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(d => shiftDate(d, 1))}
                  style={navBtnStyle}
                >
                  Next →
                </button>
                <button type="button" onClick={() => setSelectedDate(today)} style={navBtnStyle}>
                  Today
                </button>
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
            </div>
            {sessions.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No sessions for this date yet.</div>
            ) : (
              sessions.map(s => {
                const held = s.held_count || 0
                const pending = s.pending_count || 0
                const open = sessionOpenSpots(s)
                const used = Math.min(s.capacity, (s.booked_count || 0) + held + pending)
                const pct = s.capacity > 0 ? Math.round((used / s.capacity) * 100) : s.is_blocked ? 100 : 0
                const edit = slotEdit(s)
                const dirty =
                  Number(edit.capacity) !== Number(s.capacity) || Number(edit.held) !== Number(held)
                const inputStyle: CSSProperties = {
                  width: 72,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                }
                return (
                  <div
                    key={s.time_slot}
                    style={{
                      marginBottom: 16,
                      padding: 14,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: s.is_blocked ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{SLOT_LABELS[s.time_slot] || s.time_slot}</div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                          Booked {s.booked_count} · Pending {pending} · Held {held} · Open {open} of {s.capacity}
                          {s.is_blocked ? ' · slot closed' : ''}
                        </div>
                      </div>
                      {s.id && (
                        <button
                          type="button"
                          disabled={blockingId === s.id}
                          onClick={() => toggleBlock(s.id as string, !s.is_blocked)}
                          style={{
                            background: s.is_blocked ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: s.is_blocked ? '#4ade80' : '#f87171',
                            padding: '6px 10px',
                            borderRadius: 8,
                            cursor: blockingId === s.id ? 'wait' : 'pointer',
                            fontSize: 12,
                            fontWeight: 900,
                            fontFamily: 'Nunito, sans-serif',
                            whiteSpace: 'nowrap',
                            opacity: blockingId === s.id ? 0.6 : 1,
                          }}
                        >
                          {blockingId === s.id && !dirty ? 'Saving…' : s.is_blocked ? 'Open slot' : 'Close slot'}
                        </button>
                      )}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8, marginBottom: 12 }}>
                      <div
                        style={{
                          background: s.is_blocked || pct > 80 ? '#f87171' : pct > 50 ? '#ffd700' : '#4ade80',
                          height: '100%',
                          width: `${Math.min(100, pct)}%`,
                          borderRadius: 4,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 800 }}>
                        Capacity
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={edit.capacity}
                          onChange={e =>
                            setSlotEdits(prev => ({
                              ...prev,
                              [s.id || s.time_slot]: { ...edit, capacity: e.target.value },
                            }))
                          }
                          style={{ ...inputStyle, display: 'block', marginTop: 6 }}
                        />
                      </label>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 800 }}>
                        Hold tickets
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={edit.held}
                          onChange={e =>
                            setSlotEdits(prev => ({
                              ...prev,
                              [s.id || s.time_slot]: { ...edit, held: e.target.value },
                            }))
                          }
                          style={{ ...inputStyle, display: 'block', marginTop: 6 }}
                        />
                      </label>
                      {s.id && (
                        <button
                          type="button"
                          disabled={!dirty || blockingId === s.id}
                          onClick={() => saveSlotLimits(s.id as string)}
                          style={{
                            ...navBtnStyle,
                            color: dirty ? '#ffd700' : 'rgba(255,255,255,0.35)',
                            cursor: !dirty || blockingId === s.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {blockingId === s.id && dirty ? 'Saving…' : 'Save limits'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            <div style={{ marginTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
                Bookings on this day
                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>
                  {dayBookings.length}
                </span>
              </div>
              {dayBookings.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No bookings for {formatLongDate(selectedDate)}. Use Next → to check the following day.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {['Ref', 'Name', 'Phone', 'Slot', 'Visitors', 'Amount', 'Status'].map(h => (
                          <th
                            key={h}
                            style={{
                              padding: '10px 12px',
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
                      {dayBookings.map((b, i) => (
                        <tr
                          key={b.booking_ref}
                          style={{
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <a href={`/ticket/${b.booking_ref}`} style={{ color: '#ffd700', textDecoration: 'none', fontFamily: 'monospace' }}>
                              {b.booking_ref}
                            </a>
                          </td>
                          <td style={{ padding: '10px 12px' }}>{b.booker_name || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)' }}>
                            {b.booker_phone ? (
                              <a href={phoneTel(b.booker_phone)} style={{ color: '#7dd3fc', textDecoration: 'none' }}>
                                {b.booker_phone}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)' }}>
                            {SLOT_LABELS[b.sessions?.time_slot || ''] || b.sessions?.time_slot || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.5)' }}>
                            {b.adult_count}A · {b.child_count}C
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>KES {b.total_amount_kes.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {(() => {
                              const st = paymentStatusStyle(b.payment_status)
                              return (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: st.bg,
                                    color: st.color,
                                  }}
                                >
                                  {b.payment_status}
                                </span>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                  {['Ref', 'Name', 'Date', 'Slot', 'Visitors', 'Amount', 'Status'].map(h => (
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
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)' }}>
                      {b.sessions?.session_date || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)' }}>
                      {SLOT_LABELS[b.sessions?.time_slot || ''] || b.sessions?.time_slot || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>
                      {b.adult_count}A · {b.child_count}C
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700 }}>KES {b.total_amount_kes.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {(() => {
                        const st = paymentStatusStyle(b.payment_status)
                        return (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: st.bg,
                              color: st.color,
                            }}
                          >
                            {b.payment_status}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'enquiries' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '4px 0',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>Filter</span>
                {(['all', ...ENQUIRY_STATUSES] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEnquiryFilter(f)}
                    style={{
                      ...navBtnStyle,
                      color: enquiryFilter === f ? '#ffd700' : 'rgba(255,255,255,0.55)',
                      borderColor: enquiryFilter === f ? 'rgba(255,217,74,0.35)' : 'rgba(255,255,255,0.12)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => void loadEnquiries()} style={navBtnStyle}>
                  ↻ Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void exportEnquiries()}
                  disabled={exporting}
                  style={{ ...navBtnStyle, color: exporting ? 'rgba(255,255,255,0.4)' : '#ffd700' }}
                >
                  {exporting ? 'Exporting…' : '⬇️ Export CSV'}
                </button>
              </div>
            </div>
            {enquiriesLoading ? (
              <p style={{ color: 'rgba(255,255,255,0.45)', padding: 20 }}>Loading enquiries…</p>
            ) : (
              <>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 16 }}>
                    Birthday enquiries ({filterByStatus(birthdayEnquiries).length})
                  </div>
                  {filterByStatus(birthdayEnquiries).length === 0 ? (
                    <p style={{ padding: '0 20px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No birthday enquiries yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {['Ref', 'Parent', 'Phone', 'Email', 'Guests', 'Date', 'Status'].map(h => (
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
                        {filterByStatus(birthdayEnquiries).map((e, i) => (
                          <tr
                            key={e.enquiry_ref}
                            style={{
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#ffd700' }}>{e.enquiry_ref}</td>
                            <td style={{ padding: '10px 16px' }}>{e.parent_name}</td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)' }}>
                              <a href={phoneTel(e.phone)} style={{ color: '#7dd3fc', textDecoration: 'none' }}>
                                {e.phone}
                              </a>
                            </td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                              {(() => {
                                const email = guardianEmailFromNotes(e.special_requirements)
                                return email !== '—' ? (
                                  <a href={`mailto:${email}`} style={{ color: '#ffd700' }}>
                                    {email}
                                  </a>
                                ) : (
                                  '—'
                                )
                              })()}
                            </td>
                            <td style={{ padding: '10px 16px' }}>{e.guest_count}</td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)' }}>{e.preferred_date}</td>
                            <td style={{ padding: '10px 16px' }}>
                              {(() => {
                                const st = enquiryStatusStyle(e.status)
                                return (
                                  <select
                                    value={e.status}
                                    onChange={ev => void updateEnquiryStatus('birthday', e.enquiry_ref, ev.target.value)}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: `1px solid ${st.color}44`,
                                      background: st.bg,
                                      color: st.color,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {ENQUIRY_STATUSES.map(s => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                )
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 16 }}>
                    School enquiries ({filterByStatus(schoolEnquiries).length})
                  </div>
                  {filterByStatus(schoolEnquiries).length === 0 ? (
                    <p style={{ padding: '0 20px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No school enquiries yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {['Ref', 'School', 'Contact', 'Phone', 'Email', 'Students', 'Date', 'Status'].map(h => (
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
                        {filterByStatus(schoolEnquiries).map((e, i) => (
                          <tr
                            key={e.enquiry_ref}
                            style={{
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#ffd700' }}>{e.enquiry_ref}</td>
                            <td style={{ padding: '10px 16px' }}>{e.school_name}</td>
                            <td style={{ padding: '10px 16px' }}>{e.contact_name}</td>
                            <td style={{ padding: '10px 16px' }}>
                              <a href={phoneTel(e.contact_phone)} style={{ color: '#7dd3fc', textDecoration: 'none' }}>
                                {e.contact_phone}
                              </a>
                            </td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                              <a href={`mailto:${e.contact_email}`} style={{ color: '#ffd700' }}>
                                {e.contact_email}
                              </a>
                            </td>
                            <td style={{ padding: '10px 16px' }}>{e.student_count}</td>
                            <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.55)' }}>{e.preferred_date}</td>
                            <td style={{ padding: '10px 16px' }}>
                              {(() => {
                                const st = enquiryStatusStyle(e.status)
                                return (
                                  <select
                                    value={e.status}
                                    onChange={ev => void updateEnquiryStatus('school', e.enquiry_ref, ev.target.value)}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      border: `1px solid ${st.color}44`,
                                      background: st.bg,
                                      color: st.color,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {ENQUIRY_STATUSES.map(s => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                )
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'react-qr-code'

type Booking = {
  id: string
  booking_ref: string
  booker_name: string | null
  adult_count: number
  child_count: number
  total_amount_kes: number
  payment_status: string
  sessions: { session_date: string; time_slot: string }
}
type Ticket = {
  id: string
  ticket_type: string
  qr_code: string
  is_used: boolean
  used_at: string | null
}

const SLOT_LABELS: Record<string, string> = {
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
}

export default function TicketPage({ params }: { params: { ref: string } }) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: b } = await supabase
        .from('bookings')
        .select('*, sessions(session_date, time_slot)')
        .eq('booking_ref', params.ref.toUpperCase())
        .single()

      if (!b) {
        setError('Booking not found.')
        setLoading(false)
        return
      }
      if (b.payment_status !== 'paid') {
        setError('Payment not confirmed yet. Please wait a moment and refresh.')
        setLoading(false)
        return
      }

      setBooking(b as Booking)

      const { data: t } = await supabase
        .from('tickets')
        .select('*')
        .eq('booking_id', b.id)
        .order('ticket_type')

      setTickets((t || []) as Ticket[])
      setLoading(false)
    }
    load()
  }, [params.ref])

  if (loading)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#08081a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        Loading tickets...
      </div>
    )

  if (error)
    return (
      <div style={{ minHeight: '100vh', background: '#08081a', fontFamily: 'Nunito, sans-serif', color: '#fff' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ marginBottom: 8 }}>Ticket not found</h2>
          <p style={{ color: '#94a3b8' }}>{error}</p>
          <a href="/book" style={{ color: '#ff7235', display: 'block', marginTop: 24 }}>
            ← Book again
          </a>
        </div>
      </div>
    )

  const session = booking?.sessions as { session_date: string; time_slot: string }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08081a; }
        @media print { .no-print { display: none !important; } }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#08081a', fontFamily: 'Nunito, sans-serif', color: '#fff' }}>
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #160a2e, #0d1535)',
            borderBottom: '1px solid rgba(255,165,0,0.2)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#ff5e1a,#ffb347)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🔬
            </div>
            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  background: 'linear-gradient(90deg,#ff7235,#ffd700)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Little Scientist
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Children's Science Park</div>
            </div>
          </div>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
            }}
          >
            🖨️ Save / Print
          </button>
        </div>

        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
          {/* Booking info */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Booking confirmed ✓
            </div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 24,
                color: '#ffd700',
                marginBottom: 14,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
              }}
            >
              {booking?.booking_ref}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 2 }}>
              {booking?.booker_name && <div>👤 {booking.booker_name}</div>}
              <div>
                📅{' '}
                {new Date(session.session_date).toLocaleDateString('en-KE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <div>🕙 {SLOT_LABELS[session.time_slot] || session.time_slot}</div>
              <div>
                👨‍👩‍👧 {booking?.adult_count} adult{(booking?.adult_count || 0) > 1 ? 's' : ''} · {booking?.child_count}{' '}
                child{(booking?.child_count || 0) > 1 ? 'ren' : ''}
              </div>
              <div style={{ color: '#ff7235', fontWeight: 700 }}>💳 KES {booking?.total_amount_kes.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16, textAlign: 'center' }}>
            Show each QR code to gate staff. Each QR works <strong style={{ color: '#fff' }}>once only</strong>.
          </div>

          {/* QR tickets */}
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${ticket.is_used ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16,
                padding: 20,
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Ticket {i + 1}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{ticket.ticket_type}</div>
                </div>
                {ticket.is_used && (
                  <div
                    style={{
                      background: 'rgba(248,113,113,0.15)',
                      color: '#f87171',
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid rgba(248,113,113,0.3)',
                    }}
                  >
                    USED
                  </div>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'center' }}>
                <QRCode value={ticket.qr_code} size={180} />
              </div>
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 10,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'monospace',
                }}
              >
                {ticket.qr_code.slice(0, 8).toUpperCase()}
              </div>
            </div>
          ))}

          <div
            className="no-print"
            style={{
              background: 'rgba(127,255,212,0.04)',
              border: '1px solid rgba(127,255,212,0.12)',
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
              lineHeight: 1.8,
            }}
          >
            📍 Sabaki Estate, Mombasa Road · 📞 0700 101 425
          </div>
        </div>
      </div>
    </>
  )
}

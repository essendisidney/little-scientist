'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'react-qr-code'
import { computeBasket } from '@/lib/pricing'

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
  '09:00-11:00': '9:00 AM – 11:00 AM',
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '11:00-13:00': '11:00 AM – 1:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '13:00-15:00': '1:00 PM – 3:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
  '15:00-17:00': '3:00 PM – 5:00 PM',
}

export default function TicketPage({ params }: { params: { ref: string } }) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function Wrap({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #08122e; }
          @media print { .no-print { display: none !important; } }
        `}</style>
        <div style={{ minHeight: '100vh', background: '#08122e', position: 'relative', overflow: 'hidden', color: '#fff' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              backgroundImage:
                'linear-gradient(rgba(46,142,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(46,142,255,0.08) 1px,transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -100,
              left: -80,
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(46,142,255,0.18) 0%,transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -80,
              right: -60,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(0,200,180,0.10) 0%,transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              background: 'rgba(8,18,46,0.92)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <a
              href="/"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontSize: 20,
                color: 'rgba(255,255,255,0.8)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🔬 Little Scientist
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
          </div>

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '32px 24px 60px' }}>{children}</div>
        </div>
      </>
    )
  }

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

  if (loading) {
    return (
      <Wrap>
        <div
          style={{
            minHeight: 320,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 700,
          }}
        >
          Loading tickets...
        </div>
      </Wrap>
    )
  }

  if (error) {
    return (
      <Wrap>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '26px 0', textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              margin: '0 auto 16px',
            }}
          >
            ✕
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.02em', fontSize: 32, marginBottom: 8, color: '#fff' }}>Ticket not found</div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.65, maxWidth: 600, margin: '0 auto' }}>{error}</p>
          <a
            href="/book"
            style={{
              display: 'inline-block',
              marginTop: 18,
              color: '#2e8eff',
              textDecoration: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.01em',
            }}
          >
            ← Book again
          </a>
        </div>
      </Wrap>
    )
  }

  const session = booking?.sessions as { session_date: string; time_slot: string }
  const basket = booking ? computeBasket(booking.adult_count, booking.child_count) : null

  return (
    <Wrap
      right={
        <button
          className="no-print"
          onClick={() => window.print()}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 800,
          }}
        >
          🖨️ Save / Print
        </button>
      }
    >
      {booking && basket && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
                Booking confirmed
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 24, color: '#FFD94A', letterSpacing: '0.04em', marginTop: 6 }}>
                {booking.booking_ref}
              </div>
            </div>
            <div style={{ background: 'rgba(0,200,180,0.12)', border: '1px solid rgba(0,200,180,0.25)', borderRadius: 999, padding: '6px 12px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.01em', color: '#00c8a0' }}>
              PAID
            </div>
          </div>

          <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.85)', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.65, maxWidth: 600 }}>
            {booking.booker_name && <div>👤 {booking.booker_name}</div>}
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
              👨🏾‍👩🏾‍👧🏾 {booking.adult_count} adult{booking.adult_count > 1 ? 's' : ''} · {booking.child_count} child
              {booking.child_count > 1 ? 'ren' : ''}
            </div>
          </div>
        </div>
      )}

      {booking && basket && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 18,
          }}
        >
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', marginBottom: 12 }}>
            🧾 Receipt
          </div>
          {[
            { label: `Entry fee — Adults × ${booking.adult_count}`, amount: basket.adultTotal },
            { label: `Entry fee — Children × ${booking.child_count}`, amount: basket.childTotal },
          ]
            .filter(i => i.amount > 0)
            .map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8, fontWeight: 600, lineHeight: 1.65 }}>
                <span>{item.label}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>KES {item.amount.toLocaleString()}</span>
              </div>
            ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: '-0.01em', fontSize: 22, color: '#FFD94A' }}>Total</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 22, color: '#FFD94A' }}>KES {basket.grandTotalFormatted}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, lineHeight: 1.7, maxWidth: 600 }}>
              Children 94.9cm and below enter FREE (not ticketed). Please inform gate staff for height checks.
            </div>
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 18, textAlign: 'center', fontWeight: 400, lineHeight: 1.7, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
        Show each QR code to gate staff. Each QR works <strong style={{ color: '#fff' }}>once only</strong>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 18 }}>
        {tickets.map(ticket => {
          const type = String(ticket.ticket_type || '')
          const isAdult = /adult/i.test(type)
          const badgeBg = isAdult ? 'rgba(46,142,255,0.18)' : 'rgba(160,96,255,0.18)'
          const badgeColor = isAdult ? '#2e8eff' : '#a060ff'
          const badgeBorder = isAdult ? 'rgba(46,142,255,0.35)' : 'rgba(160,96,255,0.35)'
          return (
            <div key={ticket.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${ticket.is_used ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: badgeBg, border: `1px solid ${badgeBorder}`, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.01em', color: badgeColor, fontSize: 13 }}>
                  {isAdult ? 'Adult' : 'Child'}
                </span>
                {ticket.is_used && (
                  <span style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.28)', color: '#f87171', borderRadius: 999, padding: '6px 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, letterSpacing: '0.01em', fontSize: 12 }}>
                    USED
                  </span>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'center' }}>
                <QRCode value={ticket.qr_code} size={200} />
              </div>
              <div style={{ marginTop: 12, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 16, color: '#FFD94A' }}>{booking?.booking_ref}</div>
              <div style={{ marginTop: 6, textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
                {new Date(session.session_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} · {SLOT_LABELS[session.time_slot] || session.time_slot}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', marginBottom: 10 }}>
          Contact + disclaimers
        </div>
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, maxWidth: 600 }}>
          <div>📍 Sabaki Estate, Mombasa Road, Nairobi</div>
          <div>
            📞{' '}
            <a href="tel:0700101425" style={{ color: '#00c8a0', textDecoration: 'none', fontWeight: 800 }}>
              0700 101 425
            </a>{' '}
            · 📧{' '}
            <a href="mailto:info@littlescientist.ke" style={{ color: '#00c8a0', textDecoration: 'none', fontWeight: 800 }}>
              info@littlescientist.ke
            </a>
          </div>
          <div>🌐 littlescientist.ke</div>
        </div>
        <div style={{ marginTop: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 600 }}>
          🎟️ Tickets are non-refundable and non-transferable.
          <br />
          🚫 Little Scientist is a drug and alcohol free environment.
          <br />
          🔒 Beware of fraudulent accounts claiming to represent us.
        </div>
      </div>
    </Wrap>
  )
}

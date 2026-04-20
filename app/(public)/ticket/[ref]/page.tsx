'use client'
import { useEffect, useState } from 'react'
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
  const basket = booking ? computeBasket(booking.adult_count, booking.child_count) : null

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
          {/* Booking info + VAT receipt */}
          {booking && basket && (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                fontFamily: 'Nunito, sans-serif',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 4,
                      fontWeight: 800,
                    }}
                  >
                    Booking confirmed ✓
                  </div>
                  <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 24, color: '#FFD700', letterSpacing: '0.1em' }}>
                    {booking.booking_ref}
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(46,204,113,0.12)',
                    border: '1px solid rgba(46,204,113,0.3)',
                    borderRadius: 8,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#2ecc71',
                  }}
                >
                  PAID
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 2, marginBottom: 16 }}>
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
                  👨‍👩‍👧 {booking.adult_count} adult{booking.adult_count > 1 ? 's' : ''} · {booking.child_count} child
                  {booking.child_count > 1 ? 'ren' : ''}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  🧾 Receipt
                </div>

                {[
                  { label: `Entry fee — Adults × ${booking.adult_count}`, amount: basket.adultTotal },
                  { label: `Entry fee — Children × ${booking.child_count}`, amount: basket.childTotal },
                ]
                  .filter(i => i.amount > 0)
                  .map(item => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.65)',
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      <span>{item.label}</span>
                      <span>KES {item.amount.toLocaleString()}</span>
                    </div>
                  ))}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.35)',
                      marginBottom: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>Entry fees (excl. VAT)</span>
                    <span>KES {basket.totalExclFormatted}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.35)',
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    <span>VAT @ 16%</span>
                    <span>KES {basket.totalVatFormatted}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900 }}>
                    <span style={{ color: '#fff' }}>Total paid</span>
                    <span style={{ color: '#FFD700' }}>KES {basket.grandTotalFormatted}</span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.25)',
                    fontWeight: 700,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 10,
                  }}
                >
                  VAT Reg. No: [Little Scientist VAT Number] · KRA ETR Receipt: {booking.booking_ref}
                  <br />
                  Prices are VAT-inclusive at 16% as required by the Kenya Revenue Authority.
                </div>
              </div>
            </div>
          )}

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

          <div style={{ fontFamily: 'Nunito,sans-serif' }}>
            {/* Contact block */}
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '18px 20px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "'Fredoka One',cursive",
                  fontSize: 17,
                  color: '#FFD700',
                  marginBottom: 12,
                }}
              >
                🔬 Little Scientist Children&apos;s Science Park
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 700,
                  lineHeight: 2,
                }}
              >
                <div>📍 Sabaki Estate, Mombasa Road, Nairobi</div>
                <div>
                  📞{' '}
                  <a href="tel:0700101425" style={{ color: '#7FFFD4', textDecoration: 'none' }}>
                    0700 101 425
                  </a>
                  &nbsp;&nbsp;·&nbsp;&nbsp; 📧{' '}
                  <a href="mailto:info@littlescientist.ke" style={{ color: '#7FFFD4', textDecoration: 'none' }}>
                    info@littlescientist.ke
                  </a>
                </div>
                <div>🌐 littlescientist.ke</div>
              </div>
            </div>

            {/* Ticket validity notice */}
            <div
              style={{
                background: 'rgba(255,215,0,0.07)',
                border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: 16,
                padding: '14px 20px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'rgba(255,215,0,0.8)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                ⏰ Ticket validity
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 700,
                  lineHeight: 1.8,
                }}
              >
                Your ticket is valid only during your booked session time slot. Please arrive within your session window.{' '}
                <strong style={{ color: '#FFD700' }}> Tickets cannot be used outside the booked session time.</strong>
              </div>
            </div>

            {/* Disclaimers */}
            <div
              style={{
                background: 'rgba(255,107,157,0.04)',
                border: '1px solid rgba(255,107,157,0.12)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'rgba(255,107,157,0.7)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  marginBottom: 10,
                }}
              >
                Important notices
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 700,
                  lineHeight: 2,
                }}
              >
                <div>
                  🎟️ Tickets are{' '}
                  <strong style={{ color: 'rgba(255,255,255,0.75)' }}>non-refundable and non-transferable</strong>
                </div>
                <div>
                  🚫 Little Scientist is a <strong style={{ color: 'rgba(255,255,255,0.75)' }}>drug and alcohol free</strong>{' '}
                  environment
                </div>
                <div>
                  📵 Little Scientist has <strong style={{ color: 'rgba(255,255,255,0.75)' }}>no social media handles</strong>{' '}
                  or any other websites
                </div>
                <div>⚠️ Beware of fraudulent accounts or sites claiming to represent Little Scientist</div>
              </div>
            </div>

            {/* Copyright */}
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                fontWeight: 700,
                textAlign: 'center' as const,
                lineHeight: 1.7,
                paddingTop: 8,
              }}
            >
              © {new Date().getFullYear()} Little Scientist Limited. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

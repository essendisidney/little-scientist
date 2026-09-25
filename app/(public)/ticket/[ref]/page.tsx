'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { supabase } from '@/lib/supabase'
import { computeBasket, DEFAULT_TIERS, type PriceTier } from '@/lib/pricing'

type Booking = {
  id: string
  booking_ref: string
  booker_name: string | null
  adult_count: number
  child_count: number
  infant_count?: number
  total_amount_kes: number
  payment_status: string
  booking_kind?: string
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

export default function TicketPage() {
  const routeParams = useParams()
  const refParam = String(routeParams?.ref || '').trim().toUpperCase()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingPayment, setPendingPayment] = useState(false)
  const [liveTiers, setLiveTiers] = useState<PriceTier[] | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('pricing_tiers')
      .select('key, price_kes, free')
      .eq('active', true)
      .then(({ data }) => {
        if (!alive || !data?.length) return
        const rows = data as { key: string; price_kes: number; free: boolean }[]
        const byKey = (k: string) => rows.find(r => r.key === k)
        const apply = (key: string, fallback: PriceTier) => {
          const row = byKey(key)
          if (!row) return fallback
          const price = Number(row.price_kes)
          return { ...fallback, priceInclVat: Number.isFinite(price) ? price : fallback.priceInclVat, free: Boolean(row.free) || price <= 0 }
        }
        setLiveTiers([
          apply('adult', DEFAULT_TIERS[0]),
          apply('child', DEFAULT_TIERS[1]),
          apply('infant', DEFAULT_TIERS[2]),
          apply('birthday_adult', { ...DEFAULT_TIERS[0], key: 'birthday_adult', priceInclVat: 1500 }),
          apply('birthday_child', { ...DEFAULT_TIERS[1], key: 'birthday_child', priceInclVat: 1500 }),
          apply('birthday_infant', { ...DEFAULT_TIERS[2], key: 'birthday_infant', priceInclVat: 800, free: false }),
        ])
      })
    return () => {
      alive = false
    }
  }, [])

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
    let alive = true
    let pollIv: ReturnType<typeof setInterval> | undefined

    async function loadFromApi() {
      if (!refParam) {
        setError('Missing booking reference in the link.')
        setLoading(false)
        return
      }

      try {
        const ctrl = new AbortController()
        const timeout = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch(`/api/bookings/ticket?ref=${encodeURIComponent(refParam)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        clearTimeout(timeout)
        const data = (await res.json().catch(() => null)) as {
          booking?: Booking
          tickets?: Ticket[]
          error?: string
        } | null

        if (!alive) return

        if (!res.ok || !data?.booking) {
          // Fallback: status endpoint confirms payment even if ticket API is down
          try {
            const sRes = await fetch(`/api/bookings/status?ref=${encodeURIComponent(refParam)}`, { cache: 'no-store' })
            const sData = await sRes.json().catch(() => null)
            if (sRes.ok && sData?.paymentStatus === 'paid') {
              setError(
                data?.error ||
                  'Payment is confirmed, but ticket details could not load. Refresh this page, or ask staff to open Admin → Issue tickets.',
              )
              setPendingPayment(false)
              setLoading(false)
              return
            }
          } catch {
            /* ignore */
          }
          setError(data?.error || 'Could not load this ticket. Check the link or ask staff to reissue.')
          setLoading(false)
          return
        }

        const b = data.booking
        if (b.payment_status !== 'paid') {
          setPendingPayment(true)
          setBooking(b)
          setTickets([])
          setLoading(false)

          pollIv = setInterval(async () => {
            try {
              const r = await fetch(`/api/bookings/ticket?ref=${encodeURIComponent(refParam)}`, { cache: 'no-store' })
              const d = (await r.json().catch(() => null)) as { booking?: Booking; tickets?: Ticket[] } | null
              if (!alive || !d?.booking) return
              if (d.booking.payment_status === 'paid') {
                if (pollIv) clearInterval(pollIv)
                setPendingPayment(false)
                setBooking(d.booking)
                setTickets((d.tickets || []) as Ticket[])
                setLoading(false)
              }
            } catch {
              /* keep polling */
            }
          }, 3000)
          setTimeout(() => {
            if (pollIv) clearInterval(pollIv)
          }, 120000)
          return
        }

        setBooking(b)
        setTickets((data.tickets || []) as Ticket[])
        setError('')
        setLoading(false)
      } catch {
        if (!alive) return
        setError('Could not load ticket (network timeout). Pull to refresh or ask staff to mark paid / reissue QR.')
        setLoading(false)
      }
    }

    loadFromApi()
    return () => {
      alive = false
      if (pollIv) clearInterval(pollIv)
    }
  }, [refParam])

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

  if (pendingPayment && booking) {
    return (
      <Wrap>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '26px 0', textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 999,
              background: 'rgba(255,217,74,0.12)',
              border: '1px solid rgba(255,217,74,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              margin: '0 auto 16px',
            }}
          >
            ⏳
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, marginBottom: 8, color: '#fff' }}>
            Confirming payment…
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.65, maxWidth: 600, margin: '0 auto' }}>
            Reference <strong style={{ color: '#FFD94A' }}>{booking.booking_ref}</strong>. This page updates automatically when M-Pesa confirms.
          </p>
          <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            Paid but still waiting? Keep this tab open for a minute.
          </p>
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
  const infantCount = Number(booking?.infant_count || 0)
  const isBirthday = booking?.booking_kind === 'birthday'
  const priced = liveTiers || DEFAULT_TIERS
  const receiptTiers = isBirthday
    ? (['adult', 'child', 'infant'] as const).map(key => {
        const birthday = priced.find(t => t.key === `birthday_${key}`)
        const general = priced.find(t => t.key === key) || DEFAULT_TIERS.find(t => t.key === key)!
        return { ...(birthday || general), key }
      })
    : priced.filter(t => t.key === 'adult' || t.key === 'child' || t.key === 'infant')
  const basket = booking
    ? computeBasket(booking.adult_count, booking.child_count, receiptTiers, infantCount)
    : null
  const linesMatchReceipt = basket != null && Math.abs(basket.grandTotal - Number(booking?.total_amount_kes || 0)) < 1
  const receiptTotal = booking ? Number(booking.total_amount_kes) : 0
  const ticketUrl =
    typeof window !== 'undefined' && booking
      ? `${window.location.origin}/ticket/${booking.booking_ref}`
      : booking
        ? `https://littlescientist.ke/ticket/${booking.booking_ref}`
        : ''

  function shareWhatsApp() {
    if (!booking || !ticketUrl) return
    const text = [
      'Little Scientist tickets',
      `Ref: ${booking.booking_ref}`,
      `Show this link at the gate:`,
      ticketUrl,
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  async function copyTicketLink() {
    if (!ticketUrl) return
    try {
      await navigator.clipboard.writeText(ticketUrl)
      alert('Ticket link copied. Paste it in WhatsApp or SMS.')
    } catch {
      window.prompt('Copy this ticket link:', ticketUrl)
    }
  }

  return (
    <Wrap
      right={
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={shareWhatsApp}
            style={{
              background: 'rgba(37,211,102,0.15)',
              border: '1px solid rgba(37,211,102,0.35)',
              color: '#25d366',
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
            }}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={copyTicketLink}
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
            Copy link
          </button>
          <button
            type="button"
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
            Save / Print
          </button>
        </div>
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
              {booking.child_count !== 1 ? 'ren' : ''}
              {infantCount > 0 ? ` · ${infantCount} under 95cm` : ''}
            </div>
          </div>

          <div className="no-print" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              onClick={shareWhatsApp}
              style={{
                background: 'rgba(37,211,102,0.15)',
                border: '1px solid rgba(37,211,102,0.35)',
                color: '#25d366',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 800,
              }}
            >
              Send tickets on WhatsApp
            </button>
            <button
              type="button"
              onClick={copyTicketLink}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 800,
              }}
            >
              Copy ticket link
            </button>
          </div>
          <p className="no-print" style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.5 }}>
            No email needed. Share this link on WhatsApp, keep the tab open, or screenshot the QR codes below.
          </p>
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
          {(linesMatchReceipt
            ? [
                { label: `Entry fee — Adults × ${booking.adult_count}`, amount: basket.adultTotal },
                { label: `Entry fee — Children × ${booking.child_count}`, amount: basket.childTotal },
                ...(infantCount > 0
                  ? [{ label: `Entry fee — Under 95cm × ${infantCount}`, amount: basket.infantTotal }]
                  : []),
              ]
            : [{ label: 'Entry fees', amount: receiptTotal }]
          )
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
              <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 22, color: '#FFD94A' }}>
                KES {receiptTotal.toLocaleString('en-KE')}
              </span>
            </div>
            {infantCount > 0 && basket.infantTotal <= 0 && linesMatchReceipt && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, lineHeight: 1.7, maxWidth: 600 }}>
                Under 95cm visitors are included at no extra charge. Show their QR at the gate.
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 18, textAlign: 'center', fontWeight: 400, lineHeight: 1.7, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
        Show each QR code to gate staff. Each QR works <strong style={{ color: '#fff' }}>once only</strong>.
      </div>

      {tickets.length === 0 && (
        <div
          style={{
            marginBottom: 18,
            padding: 16,
            borderRadius: 14,
            border: '1px solid rgba(255,217,74,0.35)',
            background: 'rgba(255,217,74,0.08)',
            color: '#FFD94A',
            fontWeight: 700,
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Payment is marked paid, but no QR tickets were found yet. Refresh this page, or ask staff to tap <strong>Issue tickets</strong> on the booking in Admin → Bookings.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 18 }}>
        {tickets.map(ticket => {
          const type = String(ticket.ticket_type || '')
          const isAdult = /adult/i.test(type)
          const isUnder95 = /under\s*95|infant/i.test(type)
          const badgeLabel = isUnder95 ? 'Under 95cm' : isAdult ? 'Adult' : 'Child'
          const badgeBg = isAdult ? 'rgba(46,142,255,0.18)' : 'rgba(160,96,255,0.18)'
          const badgeColor = isAdult ? '#2e8eff' : '#a060ff'
          const badgeBorder = isAdult ? 'rgba(46,142,255,0.35)' : 'rgba(160,96,255,0.35)'
          return (
            <div key={ticket.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${ticket.is_used ? 'rgba(248,113,113,0.28)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: badgeBg, border: `1px solid ${badgeBorder}`, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.01em', color: badgeColor, fontSize: 13 }}>
                  {badgeLabel}
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
          🎟️ Tickets sold are not refundable or transferable.
          <br />
          🚫 Little Scientist is a drug and alcohol free environment.
        </div>
      </div>
    </Wrap>
  )
}

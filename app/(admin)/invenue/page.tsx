'use client'
import { useState } from 'react'

type Purchase = {
  purchase_ref: string
  category: string
  description: string
  total_kes: number
  payment_status: string
}
type Booking = {
  booking_ref: string
  booker_name: string | null
  booker_phone: string
  adult_count: number
  child_count: number
  total_amount_kes: number
  sessions: { session_date: string; time_slot: string }
  in_venue_purchases: Purchase[]
}
type Step = 'lookup' | 'booking' | 'add' | 'pending' | 'success'

const CATS = [
  { value: 'merchandise', label: '🛍️ Merchandise' },
  { value: 'food_beverage', label: '🍔 Food & Drinks' },
  { value: 'activity', label: '🎯 Activity' },
  { value: 'other', label: '📦 Other' },
]

export default function InVenuePage() {
  const [step, setStep] = useState<Step>('lookup')
  const [ref, setRef] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [category, setCategory] = useState('merchandise')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingRef, setPendingRef] = useState('')
  const [pendingTotal, setPendingTotal] = useState(0)

  async function lookup() {
    setError('')
    setLoading(true)
    const res = await fetch(`/api/invenue/initiate?ref=${ref.toUpperCase()}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    setBooking(data.booking)
    setStep('booking')
  }

  async function submitPurchase() {
    setError('')
    if (!description || !unitPrice) {
      setError('Fill in all fields')
      return
    }
    setLoading(true)
    const res = await fetch('/api/invenue/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingRef: booking?.booking_ref,
        category,
        description,
        quantity,
        unitPriceKes: parseFloat(unitPrice),
        staffId: 'counter',
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    setPendingRef(data.purchaseRef)
    setPendingTotal(data.totalKes)
    setStep('pending')

    const poll = setInterval(async () => {
      const r = await fetch(`/api/invenue/initiate?ref=${booking?.booking_ref}`)
      const d = await r.json()
      const p = d.booking?.in_venue_purchases?.find((x: Purchase) => x.purchase_ref === data.purchaseRef)
      if (p?.payment_status === 'paid') {
        clearInterval(poll)
        setStep('success')
        setBooking(d.booking)
      }
      if (p?.payment_status === 'failed') {
        clearInterval(poll)
        setError('Payment failed')
        setStep('add')
      }
    }, 3000)
    setTimeout(() => clearInterval(poll), 180000)
  }

  const total = quantity * parseFloat(unitPrice || '0')
  const paidPurchases = booking?.in_venue_purchases?.filter(p => p.payment_status === 'paid') || []
  const invenuTotal = paidPurchases.reduce((s, p) => s + p.total_kes, 0)

  const inp: React.CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '13px 16px',
    color: '#fff',
    fontSize: 14,
    marginBottom: 14,
    boxSizing: 'border-box',
    fontFamily: 'Nunito, sans-serif',
  }
  const btn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'linear-gradient(135deg,#ff5e1a,#ff8c42)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'Nunito, sans-serif',
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#060d1a', color: '#e2e8f0', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
          {step === 'lookup' && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, paddingTop: 20 }}>In-Venue Purchase</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
                Enter visitor booking reference
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookup()}
                  placeholder="Booking ref e.g. A1B2C3D4"
                  style={{ ...inp, marginBottom: 0, flex: 1 }}
                />
                <button onClick={lookup} disabled={loading || !ref} style={{ ...btn, width: 'auto', padding: '13px 20px' }}>
                  {loading ? '...' : 'Find'}
                </button>
              </div>
              {error && <div style={{ color: '#f87171', marginTop: 10, fontSize: 13 }}>{error}</div>}
            </>
          )}

          {step === 'booking' && booking && (
            <>
              <div style={card}>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
                  {booking.booker_name || 'Guest'} · <span style={{ color: '#ffd700' }}>{booking.booking_ref}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.8 }}>
                  📅 {booking.sessions?.session_date} · {booking.sessions?.time_slot}
                  <br />
                  👨‍👩 {booking.adult_count}A · {booking.child_count}C · 📱 {booking.booker_phone}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                    Ticket spend
                  </div>
                  <div style={{ fontWeight: 900, color: '#60a5fa' }}>KES {booking.total_amount_kes.toLocaleString()}</div>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                    In-venue spend
                  </div>
                  <div style={{ fontWeight: 900, color: '#ffd700' }}>KES {invenuTotal.toLocaleString()}</div>
                </div>
              </div>
              {paidPurchases.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase' as const }}>
                    Today's purchases
                  </div>
                  {paidPurchases.map(p => (
                    <div key={p.purchase_ref} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.description}</span>
                      <span style={{ color: '#4ade80' }}>KES {p.total_kes.toLocaleString()} ✓</span>
                    </div>
                  ))}
                </div>
              )}
              <button style={btn} onClick={() => setStep('add')}>
                + Add purchase
              </button>
              <button
                style={{ ...btn, background: 'rgba(255,255,255,0.06)', marginTop: 10, color: 'rgba(255,255,255,0.5)' }}
                onClick={() => {
                  setStep('lookup')
                  setBooking(null)
                  setRef('')
                }}
              >
                Look up another visitor
              </button>
            </>
          )}

          {step === 'add' && booking && (
            <>
              <button
                onClick={() => setStep('booking')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Nunito, sans-serif',
                  marginBottom: 16,
                  padding: 0,
                  fontWeight: 700,
                  paddingTop: 20,
                }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>Add purchase</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                {CATS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                      border: category === c.value ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.12)',
                      background: category === c.value ? 'rgba(255,215,0,0.1)' : 'transparent',
                      color: '#fff',
                      fontFamily: 'Nunito, sans-serif',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input style={inp} placeholder="What was sold? e.g. Volcano Kit" value={description} onChange={e => setDescription(e.target.value)} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Unit price (KES)</div>
                  <input type="number" placeholder="500" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Qty</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 18,
                        fontFamily: 'Nunito, sans-serif',
                      }}
                    >
                      −
                    </button>
                    <span style={{ fontWeight: 900, fontSize: 18, minWidth: 24, textAlign: 'center' as const }}>{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 18,
                        fontFamily: 'Nunito, sans-serif',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {total > 0 && (
                <div
                  style={{
                    background: 'rgba(255,165,0,0.08)',
                    border: '1px solid rgba(255,165,0,0.2)',
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Total</span>
                  <span style={{ fontWeight: 900, color: '#ffd700', fontSize: 18 }}>KES {total.toLocaleString()}</span>
                </div>
              )}
              {error && <div style={{ color: '#f87171', marginBottom: 12, fontSize: 13 }}>{error}</div>}
              <button style={{ ...btn, opacity: loading ? 0.7 : 1 }} onClick={submitPurchase} disabled={loading}>
                {loading ? 'Sending M-Pesa prompt...' : `Charge KES ${total.toLocaleString()} →`}
              </button>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' as const, marginTop: 8 }}>
                Prompt goes to {booking.booker_phone}
              </div>
            </>
          )}

          {step === 'pending' && (
            <div style={{ textAlign: 'center' as const, paddingTop: 60 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Waiting for payment</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>Ask visitor to enter their M-Pesa PIN</p>
              <div style={{ color: '#ffd700', marginTop: 24, fontSize: 14 }}>
                KES {pendingTotal.toLocaleString()} · {pendingRef}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center' as const, paddingTop: 60 }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#4ade80', marginBottom: 8 }}>Payment confirmed!</h2>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  style={{ ...btn, flex: 1 }}
                  onClick={() => {
                    setStep('add')
                    setDescription('')
                    setUnitPrice('')
                    setQuantity(1)
                  }}
                >
                  Add another
                </button>
                <button
                  style={{ ...btn, flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                  onClick={() => {
                    setStep('lookup')
                    setBooking(null)
                    setRef('')
                  }}
                >
                  New visitor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

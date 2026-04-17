'use client'
import { useState, useEffect, useRef, type CSSProperties } from 'react'

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
type LookupMode = 'scan' | 'manual'

const CATS = [
  { value: 'merchandise', label: '🛍️ Merchandise' },
  { value: 'food_beverage', label: '🍔 Food & Drinks' },
  { value: 'activity', label: '🎯 Activity' },
  { value: 'other', label: '📦 Other' },
]

export default function InVenuePage() {
  const [step, setStep] = useState<Step>('lookup')
  const [lookupMode, setLookupMode] = useState<LookupMode>('scan')
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
  const [scannerReady, setScannerReady] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const scannerRef = useRef<unknown>(null)
  const scanLockRef = useRef(false)

  useEffect(() => {
    if (document.getElementById('qr-script')) {
      setScannerReady(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'qr-script'
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.onload = () => setScannerReady(true)
    script.onerror = () => setScannerError('Could not load camera scanner')
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (lookupMode === 'scan' && step === 'lookup' && scannerReady) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => stopScanner()
  }, [lookupMode, step, scannerReady])

  function startScanner() {
    // @ts-expect-error dynamic
    if (!window.Html5Qrcode) return
    setScannerActive(false)
    setScannerError('')
    setTimeout(() => {
      try {
        // @ts-expect-error dynamic
        scannerRef.current = new window.Html5Qrcode('qr-counter-reader')
        // @ts-expect-error dynamic
        scannerRef.current
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            async (text: string) => {
              if (scanLockRef.current) return
              scanLockRef.current = true
              await lookupBooking(text)
              setTimeout(() => {
                scanLockRef.current = false
              }, 3000)
            },
            () => {}
          )
          .then(() => setScannerActive(true))
          .catch((e: unknown) => {
            setScannerError('Camera access denied. Use manual entry below.')
            console.error(e)
          })
      } catch {
        setScannerError('Camera not available. Use manual entry.')
      }
    }, 200)
  }

  function stopScanner() {
    try {
      ;(scannerRef.current as any)?.stop?.().catch?.(() => {})
    } catch {}
    setScannerActive(false)
  }

  async function lookupBooking(qrOrRef: string) {
    setError('')
    setLoading(true)
    const res = await fetch(`/api/invenue/initiate?ref=${encodeURIComponent(qrOrRef.toUpperCase())}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Booking not found')
      return
    }
    stopScanner()
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

  function reset() {
    setStep('lookup')
    setBooking(null)
    setRef('')
    setError('')
    setDescription('')
    setUnitPrice('')
    setQuantity(1)
    scanLockRef.current = false
  }

  const total = quantity * parseFloat(unitPrice || '0')
  const paidPurchases = booking?.in_venue_purchases?.filter(p => p.payment_status === 'paid') || []
  const invenuTotal = paidPurchases.reduce((s, p) => s + p.total_kes, 0)

  const S: CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'rgba(255,255,255,0.07)',
    border: '2px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: '14px 18px',
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    fontFamily: 'Nunito, sans-serif',
    fontWeight: 600,
  }
  const BTN: CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'linear-gradient(135deg,#FF4080,#FF8C00)',
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    padding: '16px',
    fontFamily: "'Fredoka One', cursive",
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 6px 28px rgba(255,64,128,0.35)',
    transition: 'all 0.2s',
  }
  const CARD: CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: '18px 20px',
    marginBottom: 14,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #060d1a; }
        #qr-counter-reader video { border-radius: 16px !important; }
        #qr-counter-reader { border-radius: 16px !important; overflow: hidden; }
        .scan-pulse { animation: scanpulse 2s ease-in-out infinite; }
        @keyframes scanpulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .mode-btn { flex: 1; padding: 12px; border-radius: 14px; border: 2px solid transparent; cursor: pointer; font-family: 'Fredoka One', cursive; font-size: 16px; transition: all 0.2s; }
        .mode-btn.on { background: linear-gradient(135deg,#FF4080,#FF8C00); color: #fff; box-shadow: 0 4px 20px rgba(255,64,128,0.35); }
        .mode-btn.off { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
        .mode-btn.off:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
        .cat-btn { padding: 9px 16px; border-radius: 10px; font-size: 13px; cursor: pointer; transition: all 0.15s; font-family: 'Nunito', sans-serif; font-weight: 800; }
        .qty-btn { width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); color: #fff; font-size: 22px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-family: 'Nunito', sans-serif; }
        .qty-btn:hover { background: rgba(255,107,157,0.25); border-color: rgba(255,107,157,0.5); transform: scale(1.15); }
        input:focus { outline: none; border-color: rgba(255,107,157,0.65) !important; box-shadow: 0 0 0 4px rgba(255,107,157,0.12); }
        .visitor-badge { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 10px; font-size: 12px; font-weight: 800; }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at 20% 0%,#1a0535 0%,transparent 50%),#060d1a',
          color: '#fff',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px 80px' }}>
          <div style={{ padding: '20px 0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 28 }}>
            <div
              style={{
                fontFamily: "'Fredoka One', cursive",
                fontSize: 22,
                background: 'linear-gradient(90deg,#FF6B9D,#FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              🛍️ In-Venue Sales
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
              Scan visitor QR or enter booking reference
            </div>
          </div>

          {step === 'lookup' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button className={`mode-btn ${lookupMode === 'scan' ? 'on' : 'off'}`} onClick={() => setLookupMode('scan')}>
                  📷 Scan QR Code
                </button>
                <button className={`mode-btn ${lookupMode === 'manual' ? 'on' : 'off'}`} onClick={() => setLookupMode('manual')}>
                  ⌨️ Type Ref
                </button>
              </div>

              {lookupMode === 'scan' && (
                <div>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20,
                      overflow: 'hidden',
                      marginBottom: 16,
                      position: 'relative',
                    }}
                  >
                    <div id="qr-counter-reader" style={{ width: '100%', minHeight: 280 }} />
                    {!scannerActive && !scannerError && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.5)',
                        }}
                      >
                        <div style={{ fontSize: 48, marginBottom: 12 }} className="scan-pulse">
                          📷
                        </div>
                        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Starting camera...</div>
                      </div>
                    )}
                    {loading && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.7)',
                        }}
                      >
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                        <div style={{ fontSize: 16, color: '#FFD700', fontWeight: 800 }}>Looking up booking...</div>
                      </div>
                    )}
                  </div>

                  {scannerError && (
                    <div
                      style={{
                        background: 'rgba(255,107,157,0.1)',
                        border: '1px solid rgba(255,107,157,0.25)',
                        borderRadius: 14,
                        padding: '14px 18px',
                        fontSize: 14,
                        color: '#FF6B9D',
                        fontWeight: 700,
                        marginBottom: 16,
                      }}
                    >
                      ⚠️ {scannerError}
                    </div>
                  )}

                  {scannerActive && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '12px',
                        background: 'rgba(46,204,113,0.08)',
                        border: '1px solid rgba(46,204,113,0.2)',
                        borderRadius: 14,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#2ecc71',
                          animation: 'scanpulse 1s ease-in-out infinite',
                        }}
                      />
                      <span style={{ fontSize: 14, color: '#2ecc71', fontWeight: 800 }}>Camera active — point at visitor QR code</span>
                    </div>
                  )}

                  {error && (
                    <div
                      style={{
                        background: 'rgba(255,107,157,0.08)',
                        border: '1px solid rgba(255,107,157,0.2)',
                        borderRadius: 12,
                        padding: '12px 16px',
                        fontSize: 14,
                        color: '#FF6B9D',
                        fontWeight: 700,
                        marginBottom: 16,
                      }}
                    >
                      {error} — try again or switch to manual entry
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontWeight: 700 }}>
                    Point the camera at the QR code on the visitor&apos;s ticket page
                  </div>
                </div>
              )}

              {lookupMode === 'manual' && (
                <div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 14, fontWeight: 700 }}>
                    Enter the booking reference from the visitor&apos;s ticket
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      value={ref}
                      onChange={e => setRef(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && lookupBooking(ref)}
                      placeholder="e.g. A1B2C3D4"
                      style={{
                        ...S,
                        marginBottom: 0,
                        flex: 1,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontSize: 18,
                        fontFamily: "'Fredoka One', cursive",
                      }}
                    />
                    <button
                      onClick={() => lookupBooking(ref)}
                      disabled={loading || !ref}
                      style={{ ...BTN, width: 'auto', padding: '14px 22px', borderRadius: 14, opacity: loading || !ref ? 0.6 : 1 }}
                    >
                      {loading ? '...' : 'Find →'}
                    </button>
                  </div>
                  {error && <div style={{ color: '#FF6B9D', marginTop: 10, fontSize: 14, fontWeight: 700 }}>⚠️ {error}</div>}
                </div>
              )}
            </>
          )}

          {step === 'booking' && booking && (
            <>
              <div style={{ ...CARD, background: 'rgba(255,64,128,0.07)', border: '1px solid rgba(255,64,128,0.18)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 20, color: '#FF6B9D' }}>
                    {booking.booker_name || 'Guest Visitor'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#FFD700', fontWeight: 800, letterSpacing: '0.08em' }}>
                    {booking.booking_ref}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div className="visitor-badge" style={{ background: 'rgba(255,107,157,0.12)', color: '#FF6B9D' }}>
                    📅 {booking.sessions?.session_date}
                  </div>
                  <div className="visitor-badge" style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}>
                    🕙 {booking.sessions?.time_slot}
                  </div>
                  <div className="visitor-badge" style={{ background: 'rgba(127,255,212,0.1)', color: '#7FFFD4' }}>
                    👨‍👩 {booking.adult_count}A · {booking.child_count}C
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 800 }}>
                      Ticket spend
                    </div>
                    <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: '#7FFFD4' }}>
                      KES {booking.total_amount_kes.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 800 }}>
                      In-venue spend
                    </div>
                    <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 22, color: '#FFD700' }}>
                      KES {invenuTotal.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {paidPurchases.length > 0 && (
                <div style={CARD}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 12 }}>
                    Today&apos;s purchases
                  </div>
                  {paidPurchases.map(p => (
                    <div key={p.purchase_ref} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, fontWeight: 700 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.description}</span>
                      <span style={{ color: '#2ecc71' }}>KES {p.total_kes.toLocaleString()} ✓</span>
                    </div>
                  ))}
                </div>
              )}

              <button style={{ ...BTN, marginBottom: 12 }} onClick={() => setStep('add')}>
                + Add New Purchase
              </button>
              <button
                onClick={reset}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.45)',
                  borderRadius: 16,
                  padding: '14px',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                📷 Scan another visitor
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
                  fontSize: 14,
                  fontFamily: 'Nunito, sans-serif',
                  marginBottom: 20,
                  padding: 0,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ← Back to {booking.booker_name || 'visitor'}
              </button>

              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 24, marginBottom: 6 }}>Add purchase</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24, fontWeight: 700 }}>
                Charging to {booking.booker_phone} · {booking.booking_ref}
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Category
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {CATS.map(c => (
                  <button
                    key={c.value}
                    className="cat-btn"
                    onClick={() => setCategory(c.value)}
                    style={{
                      background:
                        category === c.value
                          ? 'linear-gradient(135deg,rgba(255,107,157,0.3),rgba(255,215,0,0.2))'
                          : 'rgba(255,255,255,0.05)',
                      border: category === c.value ? '2px solid rgba(255,107,157,0.6)' : '1px solid rgba(255,255,255,0.1)',
                      color: category === c.value ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                What was sold?
              </div>
              <input style={S} placeholder="e.g. Volcano Science Kit" value={description} onChange={e => setDescription(e.target.value)} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Unit price (KES)
                  </div>
                  <input type="number" placeholder="500" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={S} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Qty
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
                    <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                      −
                    </button>
                    <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: 24, minWidth: 32, textAlign: 'center' }}>{quantity}</span>
                    <button className="qty-btn" onClick={() => setQuantity(quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              </div>

              {total > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg,rgba(255,64,128,0.1),rgba(255,215,0,0.07))',
                    border: '2px solid rgba(255,165,0,0.2)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Total to charge</div>
                  <div
                    style={{
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: 30,
                      background: 'linear-gradient(90deg,#FF6B9D,#FFD700)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    KES {total.toLocaleString()}
                  </div>
                </div>
              )}

              {error && (
                <div
                  style={{
                    color: '#FF6B9D',
                    marginBottom: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '12px 16px',
                    background: 'rgba(255,107,157,0.08)',
                    borderRadius: 12,
                  }}
                >
                  {error}
                </div>
              )}

              <button style={{ ...BTN, opacity: loading ? 0.7 : 1 }} onClick={submitPurchase} disabled={loading}>
                {loading ? '🔄 Sending M-Pesa prompt...' : `💳 Charge KES ${total > 0 ? total.toLocaleString() : '—'} →`}
              </button>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textAlign: 'center', marginTop: 10, fontWeight: 700 }}>
                M-Pesa prompt goes to {booking.booker_phone}
              </div>
            </>
          )}

          {step === 'pending' && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 80, marginBottom: 20, animation: 'scanpulse 1.5s ease-in-out infinite' }}>📱</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, marginBottom: 12 }}>Waiting for payment</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7 }}>
                Ask visitor to enter their
                <br />
                M-Pesa PIN on their phone
              </div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 28, color: '#FFD700', marginTop: 20 }}>
                KES {pendingTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8, fontWeight: 700 }}>Ref: {pendingRef}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                {['#FF6B9D', '#FFD700', '#7FFFD4'].map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: c,
                      animation: `scanpulse 1.2s ease-in-out infinite ${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', paddingTop: 50 }}>
              <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
              <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 30, color: '#2ecc71', marginBottom: 8 }}>Payment confirmed!</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 32 }}>
                KES {pendingTotal.toLocaleString()} received from {booking?.booker_phone}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  style={{ ...BTN, fontSize: 16, padding: '14px' }}
                  onClick={() => {
                    setStep('add')
                    setDescription('')
                    setUnitPrice('')
                    setQuantity(1)
                    setError('')
                  }}
                >
                  + Add another
                </button>
                <button
                  style={{ ...BTN, background: 'rgba(255,255,255,0.07)', boxShadow: 'none', fontSize: 16, padding: '14px' }}
                  onClick={reset}
                >
                  📷 New visitor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

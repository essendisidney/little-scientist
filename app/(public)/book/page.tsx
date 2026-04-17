'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ADULT_PRICE = 500
const CHILD_PRICE = 300
const SLOTS = ['10:00-12:00', '12:00-14:00', '14:00-16:00']
const SLOT_LABELS: Record<string, string> = {
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
}
const SLOT_ICONS: Record<string, string> = {
  '10:00-12:00': '🌅',
  '12:00-14:00': '☀️',
  '14:00-16:00': '🌤️',
}

type Session = {
  id: string
  session_date: string
  time_slot: string
  capacity: number
  booked_count: number
  is_blocked: boolean
}
type Step = 'date' | 'slot' | 'count' | 'payment' | 'pending' | 'success'

export default function BookPage() {
  const [step, setStep] = useState<Step>('date')
  const [selectedDate, setSelectedDate] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(1)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!selectedDate) return
    supabase
      .from('sessions')
      .select('*')
      .eq('session_date', selectedDate)
      .then(({ data }) => setSessions(data || []))
  }, [selectedDate])

  const pollStatus = useCallback(() => {
    if (!bookingRef) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('bookings')
        .select('payment_status')
        .eq('booking_ref', bookingRef)
        .single()
      if (data?.payment_status === 'paid') {
        clearInterval(interval)
        setStep('success')
      }
      if (data?.payment_status === 'failed') {
        clearInterval(interval)
        setError('Payment failed. Please try again.')
        setStep('payment')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [bookingRef])

  useEffect(() => {
    if (step === 'pending') return pollStatus()
  }, [step, pollStatus])

  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const progressPct = {
    date: 8,
    slot: 30,
    count: 55,
    payment: 78,
    pending: 90,
    success: 100,
  }[step]

  async function handlePayment() {
    setError('')
    if (!phone || phone.replace(/\s/g, '').length < 9) {
      setError('Enter a valid M-Pesa phone number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/mpesa/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession?.id,
          phone,
          name,
          adultCount: adults,
          childCount: children,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      setBookingRef(data.bookingRef)
      setStep('pending')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #08081a; }
        .ls-wrap { min-height: 100vh; background: radial-gradient(ellipse at 20% 10%, #1a0a3e 0%, #08081a 40%), radial-gradient(ellipse at 80% 80%, #0a1a10 0%, transparent 50%); font-family: 'Nunito', sans-serif; color: #fff; position: relative; overflow-x: hidden; }
        .sci-float { position: fixed; pointer-events: none; z-index: 1; font-size: 52px; opacity: 0.05; }
        .sci-float.f1 { top:8%; right:4%; animation: fsway 22s ease-in-out infinite; }
        .sci-float.f2 { top:38%; left:2%; animation: fsway 18s ease-in-out infinite -6s; }
        .sci-float.f3 { bottom:22%; right:6%; animation: fsway 26s ease-in-out infinite -12s; }
        .sci-float.f4 { bottom:45%; left:4%; animation: fsway 20s ease-in-out infinite -4s; }
        @keyframes fsway { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-18px) rotate(5deg)} }
        .ls-hdr { position: relative; z-index: 10; background: linear-gradient(135deg, #160a2e 0%, #0d1535 60%, #091a12 100%); border-bottom: 1px solid rgba(255,165,0,0.2); }
        .ls-hdr-inner { display: flex; align-items: center; padding: 14px 20px; gap: 14px; }
        .ls-logo { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg,#ff5e1a,#ffb347); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; box-shadow: 0 0 24px rgba(255,94,26,.6); }
        .ls-hdr-text h1 { font-size: 20px; font-weight: 900; background: linear-gradient(90deg,#ff7235,#ffd700,#7fffd4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1.1; }
        .ls-hdr-text p { font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .ls-hdr-icons { margin-left: auto; font-size: 16px; opacity: .5; letter-spacing: 4px; }
        .ls-prog { height: 3px; background: rgba(255,255,255,0.08); }
        .ls-prog-fill { height: 100%; background: linear-gradient(90deg,#ff5e1a,#ffd700); transition: width .5s ease; }
        .ls-body { position: relative; z-index: 5; max-width: 480px; margin: 0 auto; padding: 26px 18px 60px; }
        .step-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.25); color: #ffd700; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .1em; }
        .step-h { font-size: 25px; font-weight: 900; line-height: 1.2; margin-bottom: 6px; }
        .step-h span { background: linear-gradient(90deg,#ff7235,#ffd700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .step-sub { font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 22px; }
        .date-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .date-btn { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 13px 6px; cursor: pointer; color: #fff; text-align: center; transition: all .2s; font-family: 'Nunito',sans-serif; }
        .date-btn:hover { background: rgba(255,114,53,.15); border-color: rgba(255,114,53,.5); transform: translateY(-3px); }
        .date-btn .dw { font-size: 9px; color: rgba(255,255,255,.4); font-weight: 700; text-transform: uppercase; }
        .date-btn .dd { font-size: 22px; font-weight: 900; line-height: 1.1; }
        .date-btn .dm { font-size: 9px; color: rgba(255,255,255,.4); }
        .date-btn.wknd { border-color: rgba(127,255,212,.15); }
        .date-btn.wknd .dd { background: linear-gradient(90deg,#7fffd4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .date-btn.wknd::after { content:'★'; display:block; font-size:9px; color:#7fffd4; margin-top:2px; }
        .slot-card { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 16px; padding: 18px 20px; margin-bottom: 12px; cursor: pointer; transition: all .2s; }
        .slot-card:hover { background: rgba(255,94,26,.1); border-color: rgba(255,94,26,.4); transform: translateX(5px); }
        .slot-card.blocked { opacity: .35; cursor: not-allowed; pointer-events: none; }
        .slot-icon { font-size: 30px; }
        .slot-label h3 { font-size: 15px; font-weight: 800; }
        .slot-label p { font-size: 12px; color: rgba(255,255,255,.45); margin-top: 2px; }
        .slot-arr { margin-left:auto; color: rgba(255,255,255,.25); font-size: 20px; }
        .ctr-card { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 18px 20px; margin-bottom: 12px; }
        .ctr-info h3 { font-size: 15px; font-weight: 800; }
        .ctr-info p { font-size: 12px; margin-top: 2px; }
        .ctr-ctrl { display: flex; align-items: center; gap: 14px; }
        .ctr-btn { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); color: #fff; width: 38px; height: 38px; border-radius: 10px; cursor: pointer; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: all .15s; font-family: 'Nunito',sans-serif; }
        .ctr-btn:hover { background: rgba(255,94,26,.3); border-color: rgba(255,94,26,.5); }
        .ctr-val { font-size: 22px; font-weight: 900; min-width: 28px; text-align: center; }
        .total-row { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,rgba(255,94,26,.12),rgba(255,215,0,.07)); border: 1px solid rgba(255,165,0,.2); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; }
        .total-row .t-label { font-size: 14px; color: rgba(255,255,255,.6); }
        .total-row .t-amount { font-size: 26px; font-weight: 900; background: linear-gradient(90deg,#ff7235,#ffd700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .ls-in { display: block; width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 14px 16px; color: #fff; font-size: 15px; margin-bottom: 12px; font-family: 'Nunito',sans-serif; transition: border-color .2s; }
        .ls-in:focus { outline: none; border-color: rgba(255,165,0,.5); }
        .ls-in::placeholder { color: rgba(255,255,255,.28); }
        .sum-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 18px; margin-bottom: 18px; }
        .sum-card h4 { font-size: 10px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px; }
        .sum-row { display: flex; justify-content: space-between; font-size: 13px; color: rgba(255,255,255,.6); margin-bottom: 7px; }
        .sum-row.bold { font-weight: 800; color: #fff; font-size: 15px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; margin-top: 4px; }
        .btn-main { display: block; width: 100%; background: linear-gradient(135deg,#ff5e1a,#ff8c42); color: #fff; border: none; border-radius: 14px; padding: 17px; font-size: 16px; font-weight: 800; cursor: pointer; font-family: 'Nunito',sans-serif; transition: all .2s; box-shadow: 0 4px 22px rgba(255,94,26,.35); }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(255,94,26,.5); }
        .btn-main:disabled { opacity: .6; transform: none; cursor: not-allowed; }
        .btn-ghost { display: block; width: 100%; background: transparent; color: rgba(255,255,255,.38); border: none; border-radius: 14px; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Nunito',sans-serif; margin-top: 8px; }
        .back-btn { background: none; border: none; color: rgba(255,255,255,.4); cursor: pointer; font-size: 13px; font-family: 'Nunito',sans-serif; margin-bottom: 18px; padding: 0; font-weight: 700; }
        .back-btn:hover { color: rgba(255,255,255,.8); }
        .warn-pill { background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.22); color: #ffd700; font-size: 12px; padding: 8px 14px; border-radius: 10px; margin-bottom: 18px; font-weight: 700; }
        .err-msg { color: #ff6b6b; font-size: 13px; margin-bottom: 12px; padding: 10px 14px; background: rgba(255,107,107,.08); border-radius: 8px; border: 1px solid rgba(255,107,107,.2); }
        .pend { text-align: center; padding: 60px 0 20px; }
        .pend .big { font-size: 80px; margin-bottom: 20px; animation: fl 2s ease-in-out infinite; }
        @keyframes fl { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        .pend h2 { font-size: 26px; font-weight: 900; margin-bottom: 10px; }
        .pend p { color: rgba(255,255,255,.55); font-size: 14px; line-height: 1.7; }
        .dots { display: flex; justify-content: center; gap: 5px; margin-top: 24px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5e1a; animation: pp 1.2s ease-in-out infinite; }
        .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}
        @keyframes pp { 0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1.3)} }
        .succ { text-align: center; padding: 36px 0 20px; }
        .succ .big { font-size: 80px; margin-bottom: 14px; animation: pop .5s cubic-bezier(.175,.885,.32,1.275) forwards; }
        @keyframes pop { 0%{transform:scale(0)} 100%{transform:scale(1)} }
        .succ h2 { font-size: 28px; font-weight: 900; background: linear-gradient(90deg,#7fffd4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom: 8px; }
        .ref-box { background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.25); border-radius: 12px; padding: 14px 18px; margin: 16px 0; text-align:left; }
        .ref-box .rl { font-size: 10px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em; }
        .ref-box .rv { font-size: 24px; font-weight: 900; color: #ffd700; font-family: monospace; letter-spacing: .12em; }
        .venue-note { margin-top: 18px; padding: 14px; background: rgba(127,255,212,.04); border: 1px solid rgba(127,255,212,.12); border-radius: 12px; font-size: 12px; color: rgba(255,255,255,.38); text-align: center; line-height: 1.8; }
        @media(max-width:380px){ .date-grid{grid-template-columns:repeat(3,1fr)} }
      `}</style>

      <div className="ls-wrap">
        <div className="sci-float f1">🔭</div>
        <div className="sci-float f2">⚗️</div>
        <div className="sci-float f3">🚀</div>
        <div className="sci-float f4">⚛️</div>

        <div className="ls-hdr">
          <div className="ls-hdr-inner">
            <div className="ls-logo">🔬</div>
            <div className="ls-hdr-text">
              <h1>Little Scientist</h1>
              <p>Children's Science Park · Sabaki, Mombasa Road</p>
            </div>
            <div className="ls-hdr-icons">🌟 🧪 🚀</div>
          </div>
          <div className="ls-prog">
            <div className="ls-prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="ls-body">
          {step === 'date' && (
            <>
              <div className="step-badge">📅 Step 1 of 4</div>
              <h2 className="step-h">
                Choose a <span>date</span>
              </h2>
              <p className="step-sub">Book up to 14 days ahead. Weekend sessions fill up fast! ⭐</p>
              <div className="date-grid">
                {dates.map(date => {
                  const d = new Date(date)
                  const dow = d.getDay()
                  const isWknd = dow === 0 || dow === 6
                  return (
                    <button
                      key={date}
                      className={`date-btn${isWknd ? ' wknd' : ''}`}
                      onClick={() => {
                        setSelectedDate(date)
                        setStep('slot')
                      }}
                    >
                      <div className="dw">{d.toLocaleDateString('en-KE', { weekday: 'short' })}</div>
                      <div className="dd">{d.getDate()}</div>
                      <div className="dm">{d.toLocaleDateString('en-KE', { month: 'short' })}</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 'slot' && (
            <>
              <button className="back-btn" onClick={() => setStep('date')}>
                ← Back
              </button>
              <div className="step-badge">🕙 Step 2 of 4</div>
              <h2 className="step-h">
                Pick a <span>time slot</span>
              </h2>
              <p className="step-sub">
                {new Date(selectedDate).toLocaleDateString('en-KE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              {SLOTS.map(slot => {
                const session = sessions.find(s => s.time_slot === slot)
                const available = session ? session.capacity - session.booked_count : 100
                const blocked = session?.is_blocked || available <= 0
                return (
                  <div
                    key={slot}
                    className={`slot-card${blocked ? ' blocked' : ''}`}
                    onClick={() => {
                      if (!blocked) {
                        setSelectedSession(session || null)
                        setStep('count')
                      }
                    }}
                  >
                    <div className="slot-icon">{SLOT_ICONS[slot]}</div>
                    <div className="slot-label">
                      <h3>{SLOT_LABELS[slot]}</h3>
                      <p>{blocked ? '🔴 Full / Unavailable' : `🟢 ${available} spots remaining`}</p>
                    </div>
                    {!blocked && <div className="slot-arr">›</div>}
                  </div>
                )
              })}
            </>
          )}

          {step === 'count' && (
            <>
              <button className="back-btn" onClick={() => setStep('slot')}>
                ← Back
              </button>
              <div className="step-badge">👨‍👩‍👧 Step 3 of 4</div>
              <h2 className="step-h">
                How many <span>visitors?</span>
              </h2>
              <div className="warn-pill">⚠️ Every booking needs at least 1 adult AND 1 child</div>
              {[
                {
                  label: 'Adults',
                  sub: `KES ${ADULT_PRICE.toLocaleString()} per person`,
                  emoji: '🧑',
                  val: adults,
                  set: setAdults,
                  color: '#ff7235',
                },
                {
                  label: 'Children',
                  sub: `KES ${CHILD_PRICE.toLocaleString()} per person`,
                  emoji: '👧',
                  val: children,
                  set: setChildren,
                  color: '#7fffd4',
                },
              ].map(({ label, sub, emoji, val, set, color }) => (
                <div className="ctr-card" key={label}>
                  <div className="ctr-info">
                    <h3>
                      {emoji} {label}
                    </h3>
                    <p style={{ color }}>{sub}</p>
                  </div>
                  <div className="ctr-ctrl">
                    <button className="ctr-btn" onClick={() => set(Math.max(1, val - 1))}>
                      −
                    </button>
                    <span className="ctr-val">{val}</span>
                    <button className="ctr-btn" onClick={() => set(val + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="total-row">
                <span className="t-label">Total to pay</span>
                <span className="t-amount">KES {total.toLocaleString()}</span>
              </div>
              <button className="btn-main" onClick={() => setStep('payment')}>
                Continue to payment →
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <button className="back-btn" onClick={() => setStep('count')}>
                ← Back
              </button>
              <div className="step-badge">💳 Step 4 of 4</div>
              <h2 className="step-h">
                Pay via <span>M-Pesa</span>
              </h2>
              <p className="step-sub">You will receive an M-Pesa prompt on your phone</p>
              <input
                className="ls-in"
                placeholder="Your name (optional)"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="ls-in"
                placeholder="M-Pesa number e.g. 0700 101 425"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                type="tel"
              />
              <div className="sum-card">
                <h4>Booking summary</h4>
                <div className="sum-row">
                  <span>📅 Date</span>
                  <span>
                    {new Date(selectedDate).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="sum-row">
                  <span>🕙 Time</span>
                  <span>{SLOT_LABELS[selectedSession?.time_slot || '']}</span>
                </div>
                <div className="sum-row">
                  <span>🧑 Adults × {adults}</span>
                  <span>KES {(adults * ADULT_PRICE).toLocaleString()}</span>
                </div>
                <div className="sum-row">
                  <span>👧 Children × {children}</span>
                  <span>KES {(children * CHILD_PRICE).toLocaleString()}</span>
                </div>
                <div className="sum-row bold">
                  <span>Total</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>
              {error && <div className="err-msg">{error}</div>}
              <button className="btn-main" onClick={handlePayment} disabled={loading}>
                {loading ? '🔄 Sending M-Pesa prompt...' : `🔬 Pay KES ${total.toLocaleString()} →`}
              </button>
              <button className="btn-ghost" onClick={() => setStep('count')}>
                ← Change visitors
              </button>
            </>
          )}

          {step === 'pending' && (
            <div className="pend">
              <div className="big">📱</div>
              <h2>Check your phone!</h2>
              <p>
                M-Pesa prompt sent to
                <br />
                <strong style={{ color: '#ffd700', fontSize: 17 }}>{phone}</strong>
              </p>
              <p style={{ marginTop: 12 }}>
                Enter your PIN to confirm
                <br />
                <strong style={{ color: '#ff7235', fontSize: 20 }}>KES {total.toLocaleString()}</strong>
              </p>
              <div className="dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <p style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,.25)' }}>
                Waiting for confirmation...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="succ">
              <div className="big">🎉</div>
              <h2>You are all set!</h2>
              <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: 4 }}>
                Booking confirmed. Your QR tickets are ready.
              </p>
              <div className="ref-box">
                <div className="rl">Booking reference</div>
                <div className="rv">{bookingRef}</div>
              </div>
              <div className="sum-card" style={{ textAlign: 'left' }}>
                <div className="sum-row">
                  <span>📅</span>
                  <span>
                    {new Date(selectedDate).toLocaleDateString('en-KE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>
                <div className="sum-row">
                  <span>🕙</span>
                  <span>{SLOT_LABELS[selectedSession?.time_slot || '']}</span>
                </div>
                <div className="sum-row">
                  <span>👨‍👩‍👧</span>
                  <span>
                    {adults} adult{adults > 1 ? 's' : ''} · {children} child{children > 1 ? 'ren' : ''}
                  </span>
                </div>
              </div>
              <a
                href={`/ticket/${bookingRef}`}
                className="btn-main"
                style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
              >
                🎟️ View my tickets and QR codes →
              </a>
              <div className="venue-note">
                📍 Sabaki Estate, Mombasa Road
                <br />
                📞 Dr. Syokau Ilovi — 0700 101 425
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

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

// Minimum advance booking: 1 day ahead (not instant)
const MIN_DAYS_AHEAD = 1
// Show full month but only allow booking up to 30 days ahead
const MAX_DAYS_AHEAD = 30

type Session = {
  id: string
  session_date: string
  time_slot: string
  capacity: number
  booked_count: number
  is_blocked: boolean
}
type Step = 'date' | 'slot' | 'count' | 'payment' | 'pending' | 'success'

// Pencil-sketch SVG science illustrations
const Beaker = () => (
  <svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%' }} fill="none">
    <path
      d="M28 10 L28 45 L12 75 Q8 85 18 90 L62 90 Q72 85 68 75 L52 45 L52 10"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M24 10 L56 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 62 Q35 58 60 68" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <circle cx="35" cy="72" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="50" cy="65" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="42" cy="78" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <path d="M34 30 L34 28 M34 22 L34 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
  </svg>
)

const Rocket = () => (
  <svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%' }} fill="none">
    <path
      d="M40 5 Q55 20 55 50 L55 70 Q55 75 50 78 L30 78 Q25 75 25 70 L25 50 Q25 20 40 5Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M25 65 Q18 70 15 80 L25 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M55 65 Q62 70 65 80 L55 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="40" cy="38" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M35 85 Q40 95 45 85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <path d="M33 90 Q40 102 47 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <path d="M20 25 Q15 22 13 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4" />
  </svg>
)

const Atom = () => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} fill="none">
    <circle cx="50" cy="50" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <ellipse cx="50" cy="50" rx="35" ry="15" stroke="currentColor" strokeWidth="2" fill="none" />
    <ellipse
      cx="50"
      cy="50"
      rx="35"
      ry="15"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      transform="rotate(60 50 50)"
    />
    <ellipse
      cx="50"
      cy="50"
      rx="35"
      ry="15"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      transform="rotate(120 50 50)"
    />
    <circle cx="85" cy="50" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="32" cy="24" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" />
  </svg>
)

const Microscope = () => (
  <svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%' }} fill="none">
    <path d="M35 15 L35 55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M28 15 L42 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="30" y="25" width="20" height="28" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M35 55 L30 70" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 70 L60 70" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M25 70 L22 80 L58 80 L55 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="55" cy="38" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M50 38 Q55 33 60 38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M48 42 Q55 37 62 42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
  </svg>
)

const DNA = () => (
  <svg viewBox="0 0 60 120" style={{ width: '100%', height: '100%' }} fill="none">
    <path
      d="M15 10 Q45 25 15 40 Q45 55 15 70 Q45 85 15 100 Q45 115 15 130"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M45 10 Q15 25 45 40 Q15 55 45 70 Q15 85 45 100 Q15 115 45 130"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M20 17 L40 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M15 25 L45 25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M20 33 L40 33" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M15 47 L45 47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M20 55 L40 55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M15 63 L45 63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M20 78 L40 78" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M15 87 L45 87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
  </svg>
)

const Star = () => (
  <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%' }} fill="none">
    <path
      d="M20 5 L22 16 L33 16 L24 23 L27 34 L20 27 L13 34 L16 23 L7 16 L18 16 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
)

export default function BookPage() {
  const [step, setStep] = useState<Step>('date')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
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

  // Build calendar days for current month view
  const calendarDays = (() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() + MIN_DAYS_AHEAD)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)

    const days: { date: Date | null; dateStr: string; bookable: boolean; isPast: boolean; tooFar: boolean }[] = []
    // Empty slots for start of month
    for (let i = 0; i < firstDay; i++)
      days.push({ date: null, dateStr: '', bookable: false, isPast: false, tooFar: false })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = date.toISOString().split('T')[0]
      const isPast = date < minDate
      const tooFar = date > maxDate
      days.push({ date, dateStr, bookable: !isPast && !tooFar, isPast, tooFar })
    }
    return days
  })()

  const canGoPrev = (() => {
    const today = new Date()
    return currentMonth.year > today.getFullYear() || currentMonth.month > today.getMonth()
  })()

  const canGoNext = (() => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
    const lastAllowed = { year: maxDate.getFullYear(), month: maxDate.getMonth() }
    return (
      currentMonth.year < lastAllowed.year ||
      (currentMonth.year === lastAllowed.year && currentMonth.month < lastAllowed.month)
    )
  })()

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
        setError('Payment failed. Try again.')
        setStep('payment')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [bookingRef])

  useEffect(() => {
    if (step === 'pending') return pollStatus()
  }, [step, pollStatus])

  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const progressPct = { date: 8, slot: 30, count: 55, payment: 78, pending: 90, success: 100 }[step]

  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  })

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
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Caveat:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #08081a; }

        .ls-wrap { min-height: 100vh; background: radial-gradient(ellipse at 20% 10%, #1a0a3e 0%, #08081a 40%), radial-gradient(ellipse at 80% 80%, #0a1a10 0%, transparent 50%); font-family: 'Nunito', sans-serif; color: #fff; position: relative; overflow-x: hidden; }

        /* Sketch illustrations */
        .sketch { position: fixed; pointer-events: none; z-index: 1; opacity: 0.08; color: #ffd700; }
        .sketch.s1 { top: 5%; right: 2%; width: 90px; height: 110px; animation: sk 20s ease-in-out infinite; }
        .sketch.s2 { top: 30%; left: 1%; width: 70px; height: 90px; animation: sk 25s ease-in-out infinite -8s; }
        .sketch.s3 { bottom: 25%; right: 3%; width: 80px; height: 100px; animation: sk 22s ease-in-out infinite -5s; }
        .sketch.s4 { bottom: 10%; left: 3%; width: 60px; height: 120px; animation: sk 18s ease-in-out infinite -12s; }
        .sketch.s5 { top: 55%; right: 1%; width: 80px; height: 80px; animation: sk 30s ease-in-out infinite -3s; }
        .sketch.s6 { top: 15%; left: 5%; width: 30px; height: 30px; animation: sk 15s ease-in-out infinite -6s; opacity: 0.05; }
        .sketch.s7 { top: 70%; left: 8%; width: 25px; height: 25px; animation: sk 12s ease-in-out infinite -2s; opacity: 0.05; }
        @keyframes sk { 0%,100%{transform:translateY(0) rotate(-3deg)} 33%{transform:translateY(-15px) rotate(3deg)} 66%{transform:translateY(8px) rotate(-1deg)} }

        /* Header */
        .ls-hdr { position: relative; z-index: 10; background: linear-gradient(135deg, #160a2e 0%, #0d1535 60%, #091a12 100%); border-bottom: 1px solid rgba(255,165,0,0.2); }
        .ls-hdr-inner { display: flex; align-items: center; padding: 14px 20px; gap: 14px; }
        .ls-logo { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg,#ff5e1a,#ffb347); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; box-shadow: 0 0 24px rgba(255,94,26,.6); }
        .ls-hdr-text h1 { font-size: 20px; font-weight: 900; background: linear-gradient(90deg,#ff7235,#ffd700,#7fffd4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1.1; }
        .ls-hdr-text p { font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .ls-hdr-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .sketch-mini { width: 28px; height: 28px; opacity: 0.4; color: #ffd700; }
        .ls-prog { height: 3px; background: rgba(255,255,255,0.08); }
        .ls-prog-fill { height: 100%; background: linear-gradient(90deg,#ff5e1a,#ffd700); transition: width .5s ease; }

        /* Content */
        .ls-body { position: relative; z-index: 5; max-width: 520px; margin: 0 auto; padding: 26px 18px 60px; }

        .step-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.25); color: #ffd700; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .1em; }
        .step-h { font-size: 25px; font-weight: 900; line-height: 1.2; margin-bottom: 6px; }
        .step-h span { background: linear-gradient(90deg,#ff7235,#ffd700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .step-sub { font-size: 13px; color: rgba(255,255,255,.5); margin-bottom: 18px; }

        /* Calendar */
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-month { font-size: 16px; font-weight: 800; font-family: 'Caveat', cursive; color: #ffd700; letter-spacing: 0.05em; }
        .cal-nav-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all .2s; font-family: 'Nunito', sans-serif; }
        .cal-nav-btn:hover { background: rgba(255,165,0,0.15); border-color: rgba(255,165,0,0.3); }
        .cal-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-dow { text-align: center; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); text-transform: uppercase; padding: 4px 0 8px; letter-spacing: 0.05em; }
        .cal-day { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px; font-size: 13px; font-weight: 700; transition: all .2s; border: 1px solid transparent; cursor: default; position: relative; }
        .cal-day.bookable { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); cursor: pointer; }
        .cal-day.bookable:hover { background: rgba(255,114,53,0.2); border-color: rgba(255,114,53,0.5); transform: scale(1.08); }
        .cal-day.bookable.weekend { border-color: rgba(127,255,212,0.2); }
        .cal-day.bookable.weekend .cal-day-num { background: linear-gradient(90deg,#7fffd4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .cal-day.selected { background: linear-gradient(135deg,rgba(255,94,26,0.3),rgba(255,165,0,0.2)); border-color: #ff7235; transform: scale(1.1); }
        .cal-day.past { opacity: 0.2; }
        .cal-day.toofar { opacity: 0.15; }
        .cal-day.empty { border: none; background: none; }
        .cal-day-num { font-size: 14px; font-weight: 900; line-height: 1; }
        .cal-day-dot { width: 4px; height: 4px; border-radius: 50%; background: #7fffd4; margin-top: 3px; }
        .cal-day.bookable:not(.weekend) .cal-day-dot { background: rgba(255,255,255,0.3); }
        .cal-legend { display: flex; gap: 16px; margin-top: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .cal-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.4); }
        .leg-dot { width: 10px; height: 10px; border-radius: 3px; }

        /* Booking note */
        .booking-note { background: rgba(255,215,0,0.06); border: 1px solid rgba(255,215,0,0.15); border-radius: 12px; padding: 10px 14px; font-size: 12px; color: rgba(255,215,0,0.7); margin-bottom: 18px; font-family: 'Caveat', cursive; font-size: 14px; line-height: 1.5; }

        /* Slot cards */
        .slot-card { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 16px; padding: 18px 20px; margin-bottom: 12px; cursor: pointer; transition: all .2s; }
        .slot-card:hover { background: rgba(255,94,26,.1); border-color: rgba(255,94,26,.4); transform: translateX(5px); }
        .slot-card.blocked { opacity: .35; cursor: not-allowed; pointer-events: none; }
        .slot-icon { font-size: 30px; }
        .slot-label h3 { font-size: 15px; font-weight: 800; }
        .slot-label p { font-size: 12px; color: rgba(255,255,255,.45); margin-top: 2px; }
        .slot-arr { margin-left:auto; color: rgba(255,255,255,.25); font-size: 20px; }

        /* Counter */
        .ctr-card { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 18px 20px; margin-bottom: 12px; }
        .ctr-info h3 { font-size: 15px; font-weight: 800; }
        .ctr-info p { font-size: 12px; margin-top: 2px; }
        .ctr-ctrl { display: flex; align-items: center; gap: 14px; }
        .ctr-btn { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); color: #fff; width: 38px; height: 38px; border-radius: 10px; cursor: pointer; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: all .15s; font-family: 'Nunito',sans-serif; }
        .ctr-btn:hover { background: rgba(255,94,26,.3); border-color: rgba(255,94,26,.5); }
        .ctr-val { font-size: 22px; font-weight: 900; min-width: 28px; text-align: center; }

        /* Total */
        .total-row { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,rgba(255,94,26,.12),rgba(255,215,0,.07)); border: 1px solid rgba(255,165,0,.2); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; }
        .total-row .t-label { font-size: 14px; color: rgba(255,255,255,.6); }
        .total-row .t-amount { font-size: 26px; font-weight: 900; background: linear-gradient(90deg,#ff7235,#ffd700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

        /* Input */
        .ls-in { display: block; width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 14px 16px; color: #fff; font-size: 15px; margin-bottom: 12px; font-family: 'Nunito',sans-serif; transition: border-color .2s; }
        .ls-in:focus { outline: none; border-color: rgba(255,165,0,.5); }
        .ls-in::placeholder { color: rgba(255,255,255,.28); }

        /* Summary */
        .sum-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 18px; margin-bottom: 18px; }
        .sum-card h4 { font-size: 10px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px; }
        .sum-row { display: flex; justify-content: space-between; font-size: 13px; color: rgba(255,255,255,.6); margin-bottom: 7px; }
        .sum-row.bold { font-weight: 800; color: #fff; font-size: 15px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; margin-top: 4px; }

        /* Buttons */
        .btn-main { display: block; width: 100%; background: linear-gradient(135deg,#ff5e1a,#ff8c42); color: #fff; border: none; border-radius: 14px; padding: 17px; font-size: 16px; font-weight: 800; cursor: pointer; font-family: 'Nunito',sans-serif; transition: all .2s; box-shadow: 0 4px 22px rgba(255,94,26,.35); }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(255,94,26,.5); }
        .btn-main:disabled { opacity: .6; transform: none; cursor: not-allowed; }
        .btn-ghost { display: block; width: 100%; background: transparent; color: rgba(255,255,255,.38); border: none; border-radius: 14px; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Nunito',sans-serif; margin-top: 8px; }
        .back-btn { background: none; border: none; color: rgba(255,255,255,.4); cursor: pointer; font-size: 13px; font-family: 'Nunito',sans-serif; margin-bottom: 18px; padding: 0; font-weight: 700; }
        .back-btn:hover { color: rgba(255,255,255,.8); }

        .warn-pill { background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.22); color: #ffd700; font-size: 12px; padding: 8px 14px; border-radius: 10px; margin-bottom: 18px; font-weight: 700; }
        .err-msg { color: #ff6b6b; font-size: 13px; margin-bottom: 12px; padding: 10px 14px; background: rgba(255,107,107,.08); border-radius: 8px; border: 1px solid rgba(255,107,107,.2); }

        /* Pending */
        .pend { text-align: center; padding: 60px 0 20px; }
        .pend .big { font-size: 80px; margin-bottom: 20px; animation: fl 2s ease-in-out infinite; }
        @keyframes fl { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        .pend h2 { font-size: 26px; font-weight: 900; margin-bottom: 10px; }
        .pend p { color: rgba(255,255,255,.55); font-size: 14px; line-height: 1.7; }
        .dots { display: flex; justify-content: center; gap: 5px; margin-top: 24px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5e1a; animation: pp 1.2s ease-in-out infinite; }
        .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}
        @keyframes pp { 0%,100%{opacity:.2;transform:scale(.7)} 50%{opacity:1;transform:scale(1.3)} }

        /* Success */
        .succ { text-align: center; padding: 36px 0 20px; }
        .succ .big { font-size: 80px; margin-bottom: 14px; animation: pop .5s cubic-bezier(.175,.885,.32,1.275) forwards; }
        @keyframes pop { 0%{transform:scale(0)} 100%{transform:scale(1)} }
        .succ h2 { font-size: 28px; font-weight: 900; background: linear-gradient(90deg,#7fffd4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom: 8px; }
        .ref-box { background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.25); border-radius: 12px; padding: 14px 18px; margin: 16px 0; text-align:left; }
        .ref-box .rl { font-size: 10px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em; }
        .ref-box .rv { font-size: 24px; font-weight: 900; color: #ffd700; font-family: monospace; letter-spacing: .12em; }
        .venue-note { margin-top: 18px; padding: 14px; background: rgba(127,255,212,.04); border: 1px solid rgba(127,255,212,.12); border-radius: 12px; font-size: 12px; color: rgba(255,255,255,.38); text-align: center; line-height: 1.8; }

        /* Handwritten annotation */
        .handwrite { font-family: 'Caveat', cursive; font-size: 15px; color: rgba(255,215,0,0.55); margin-bottom: 16px; padding-left: 4px; }

        @media(max-width:400px){ .cal-day-num{font-size:12px} .cal-dow{font-size:9px} }
      `}</style>

      <div className="ls-wrap">
        {/* Pencil sketch illustrations */}
        <div className="sketch s1"><Beaker /></div>
        <div className="sketch s2"><Rocket /></div>
        <div className="sketch s3"><Atom /></div>
        <div className="sketch s4"><DNA /></div>
        <div className="sketch s5"><Microscope /></div>
        <div className="sketch s6"><Star /></div>
        <div className="sketch s7"><Star /></div>

        {/* Header */}
        <div className="ls-hdr">
          <div className="ls-hdr-inner">
            <div className="ls-logo">🔬</div>
            <div className="ls-hdr-text">
              <h1>Little Scientist</h1>
              <p>Children's Science Park · Sabaki, Mombasa Road</p>
            </div>
            <div className="ls-hdr-right">
              <div className="sketch-mini"><Beaker /></div>
              <div className="sketch-mini"><Atom /></div>
            </div>
          </div>
          <div className="ls-prog">
            <div className="ls-prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="ls-body">
          {/* DATE — Full calendar */}
          {step === 'date' && (
            <>
              <div className="step-badge">📅 Step 1 of 4</div>
              <h2 className="step-h">Choose a <span>date</span></h2>
              <p className="step-sub">Browse the full month — book up to 30 days ahead, minimum 1 day notice.</p>

              <div className="booking-note">
                ✏️ Weekends highlighted in aqua fill up quickly!
                <br />
                Minimum 24 hours notice required for all bookings.
              </div>

              {/* Month navigator */}
              <div className="cal-nav">
                <button
                  className="cal-nav-btn"
                  onClick={() =>
                    setCurrentMonth(m => {
                      const d = new Date(m.year, m.month - 1)
                      return { year: d.getFullYear(), month: d.getMonth() }
                    })
                  }
                  disabled={!canGoPrev}
                >
                  ‹
                </button>
                <div className="cal-month">{monthName}</div>
                <button
                  className="cal-nav-btn"
                  onClick={() =>
                    setCurrentMonth(m => {
                      const d = new Date(m.year, m.month + 1)
                      return { year: d.getFullYear(), month: d.getMonth() }
                    })
                  }
                  disabled={!canGoNext}
                >
                  ›
                </button>
              </div>

              {/* Day of week headers */}
              <div className="cal-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="cal-dow">
                    {d}
                  </div>
                ))}
                {calendarDays.map((day, i) => {
                  if (!day.date) return <div key={`empty-${i}`} className="cal-day empty" />
                  const dow = day.date.getDay()
                  const isWeekend = dow === 0 || dow === 6
                  const isSelected = day.dateStr === selectedDate
                  let cls = 'cal-day'
                  if (!day.date) cls += ' empty'
                  else if (day.isPast) cls += ' past'
                  else if (day.tooFar) cls += ' toofar'
                  else {
                    cls += ' bookable'
                    if (isWeekend) cls += ' weekend'
                    if (isSelected) cls += ' selected'
                  }
                  return (
                    <div
                      key={day.dateStr}
                      className={cls}
                      onClick={() => {
                        if (day.bookable) {
                          setSelectedDate(day.dateStr)
                          setStep('slot')
                        }
                      }}
                    >
                      <div className="cal-day-num">{day.date.getDate()}</div>
                      {day.bookable && <div className="cal-day-dot" />}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="cal-legend">
                <div className="cal-legend-item">
                  <div
                    className="leg-dot"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                  Available
                </div>
                <div className="cal-legend-item">
                  <div
                    className="leg-dot"
                    style={{ background: 'rgba(127,255,212,0.2)', border: '1px solid rgba(127,255,212,0.3)' }}
                  />
                  Weekend ⭐
                </div>
                <div className="cal-legend-item">
                  <div className="leg-dot" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  Unavailable
                </div>
              </div>
            </>
          )}

          {/* SLOT */}
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
              <div className="handwrite">✏️ Which session works best for your little scientist?</div>
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

          {/* COUNT */}
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

          {/* PAYMENT */}
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
              <input className="ls-in" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
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
                  <span>{new Date(selectedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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

          {/* PENDING */}
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
              <p style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,.25)' }}>Waiting for confirmation...</p>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div className="succ">
              <div className="big">🎉</div>
              <h2>You are all set!</h2>
              <p style={{ color: 'rgba(255,255,255,.55)', marginBottom: 4 }}>Booking confirmed. Your QR tickets are ready.</p>
              <div className="ref-box">
                <div className="rl">Booking reference</div>
                <div className="rv">{bookingRef}</div>
              </div>
              <div className="sum-card" style={{ textAlign: 'left' }}>
                <div className="sum-row">
                  <span>📅</span>
                  <span>{new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
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
              <a href={`/ticket/${bookingRef}`} className="btn-main" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
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

'use client'
import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

const PRICING = {
  adult18PlusKes: 1000,
  child95cmTo17Kes: 800,
  childUnder95cmKes: 0,
} as const
const SLOT_LABELS: Record<string, string> = {
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
}
const MIN_DAYS = 1
const MAX_DAYS = 30

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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [adults, setAdults] = useState(1)
  const [childrenPaid, setChildrenPaid] = useState(1)
  const [childrenFreeUnder95, setChildrenFreeUnder95] = useState(0)
  const [childCountMode, setChildCountMode] = useState<'height' | 'age'>('height')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  const calendarDays = (() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() + MIN_DAYS)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS)
    const days: { date: Date | null; dateStr: string; bookable: boolean; isPast: boolean; tooFar: boolean }[] = []
    for (let i = 0; i < firstDay; i++) days.push({ date: null, dateStr: '', bookable: false, isPast: false, tooFar: false })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = date.toISOString().split('T')[0]
      days.push({
        date,
        dateStr,
        bookable: date >= minDate && date <= maxDate,
        isPast: date < minDate,
        tooFar: date > maxDate,
      })
    }
    return days
  })()

  const canGoPrev = (() => {
    const t = new Date()
    return currentMonth.year > t.getFullYear() || currentMonth.month > t.getMonth()
  })()
  const canGoNext = (() => {
    const m = new Date()
    m.setDate(m.getDate() + MAX_DAYS)
    return (
      currentMonth.year < m.getFullYear() ||
      (currentMonth.year === m.getFullYear() && currentMonth.month < m.getMonth())
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
    const iv = setInterval(async () => {
      const { data } = await supabase.from('bookings').select('payment_status').eq('booking_ref', bookingRef).single()
      if (data?.payment_status === 'paid') {
        clearInterval(iv)
        setStep('success')
      }
      if (data?.payment_status === 'failed') {
        clearInterval(iv)
        setError('Payment failed. Try again.')
        setStep('payment')
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [bookingRef])

  useEffect(() => {
    if (step === 'pending') return pollStatus()
  }, [step, pollStatus])

  const total = adults * PRICING.adult18PlusKes + childrenPaid * PRICING.child95cmTo17Kes
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  })

  function pickDate(dateStr: string) {
    setSelectedDate(dateStr)
    setTimeout(() => setStep('slot'), 380)
  }

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
        body: JSON.stringify({ sessionId: selectedSession?.id, phone, name, adultCount: adults, childCount: childrenPaid }),
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

  const progressPct = { date: 8, slot: 30, count: 55, payment: 78, pending: 92, success: 100 }[step]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07041a; overflow-x: hidden; }

        .page {
          min-height: 100vh;
          font-family: 'Nunito', sans-serif;
          color: #fff;
          background:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            #07041a;
        }

        /* ── BLOBS ── */
        .blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(90px); }
        .b1 { width: 380px; height: 380px; background: rgba(168,100,255,0.1); top: -80px; right: -80px; animation: bd 22s ease-in-out infinite; }
        .b2 { width: 300px; height: 300px; background: rgba(78,205,196,0.09); bottom: 0; left: -70px; animation: bd 28s ease-in-out infinite -10s; }
        .b3 { width: 250px; height: 250px; background: rgba(255,107,157,0.07); top: 40%; right: -50px; animation: bd 24s ease-in-out infinite -6s; }
        @keyframes bd { 0%,100%{transform:translate(0,0)} 50%{transform:translate(35px,-45px)} }

        /* ── HEADER ── */
        .hdr { position: relative; z-index: 20; background: rgba(7,4,26,0.85); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .hdr-in { max-width: 1000px; margin: 0 auto; display: flex; align-items: center; padding: 16px 32px; gap: 16px; }
        .logo { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg,#FF4080,#FF8C00,#FFD700); display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; animation: lp 2.5s ease-in-out infinite; box-shadow: 0 0 36px rgba(255,150,0,.55); }
        @keyframes lp { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.07)} }
        .logo-name { font-family: 'Fredoka One', cursive; font-size: 24px; background: linear-gradient(90deg,#FF6B9D,#FF8C00,#FFD700,#7FFFD4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .logo-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .hdr-tags { margin-left: auto; display: flex; gap: 8px; }
        .htag { padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; }
        .ht1 { background: linear-gradient(135deg,#FFD700,#FF8C00); color: #2d1b00; }
        .ht2 { background: linear-gradient(135deg,#4ECDC4,#27ae60); color: #0a2d1a; }
        .prog-bar { height: 5px; background: rgba(255,255,255,0.06); }
        .prog-fill { height: 100%; background: linear-gradient(90deg,#FF4080,#FF8C00,#FFD700); transition: width 0.7s cubic-bezier(0.34,1.56,0.64,1); }

        /* ── OUTER ── */
        .outer { max-width: 860px; margin: 0 auto; padding: 32px 24px 80px; position: relative; z-index: 5; }

        /* ── STEP DOTS ── */
        .step-dots { display: flex; gap: 8px; margin-bottom: 28px; }
        .sd { height: 6px; border-radius: 3px; transition: all 0.4s; }
        .sd.done { background: linear-gradient(90deg,#FF4080,#FFD700); flex: 1; }
        .sd.active { background: linear-gradient(90deg,#FF4080,#FFD700); flex: 2; animation: sdp 1.8s ease-in-out infinite; }
        @keyframes sdp { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .sd.todo { background: rgba(255,255,255,0.1); flex: 1; }

        /* ── STEP PILL ── */
        .spill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.22); color: #FFD700; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.1em; }

        /* ── STEP TITLE ── */
        .stitle { font-family: 'Fredoka One', cursive; font-size: clamp(30px,4vw,44px); line-height: 1.15; margin-bottom: 8px; }
        .stitle span { background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ssub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 32px; line-height: 1.6; }

        /* ── BOOKING CARD ── */
        .bcard {
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 32px;
          padding: 48px 52px;
          backdrop-filter: blur(12px);
          box-shadow: 0 24px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset;
          position: relative;
          overflow: hidden;
        }
        .bcard::before {
          content: '';
          position: absolute;
          top: -1px; left: 15%; right: 15%; height: 3px;
          background: linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
        }

        /* ── CALENDAR ── */
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .cal-mth { font-family: 'Fredoka One', cursive; font-size: 26px; background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .cal-btn { width: 42px; height: 42px; border-radius: 14px; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.12); color: #fff; font-size: 20px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-family: 'Nunito', sans-serif; }
        .cal-btn:hover { background: rgba(255,107,157,0.2); border-color: rgba(255,107,157,0.5); transform: scale(1.12); }
        .cal-btn:disabled { opacity: 0.2; cursor: not-allowed; transform: none; }
        .dow-row { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; margin-bottom: 8px; }
        .dow { text-align: center; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.3); padding: 4px 0 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .days-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 8px; }

        /* DAY CELLS */
        .day { aspect-ratio: 1; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid transparent; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); position: relative; cursor: default; }
        .day-num { font-family: 'Fredoka One', cursive; font-size: 17px; line-height: 1; }
        .day-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 4px; }

        /* Past — very faded, no interaction */
        .day.past { opacity: 0.12; }
        .day.past .day-num { color: rgba(255,255,255,0.5); }

        /* Available weekday */
        .day.avail {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .day.avail .day-num { color: #fff; }
        .day.avail .day-dot { background: rgba(255,255,255,0.25); }
        .day.avail:hover {
          background: rgba(255,107,157,0.18);
          border-color: rgba(255,107,157,0.6);
          transform: scale(1.2);
          box-shadow: 0 8px 28px rgba(255,107,157,0.4), 0 0 0 4px rgba(255,107,157,0.12);
        }
        .day.avail:hover .day-num {
          background: linear-gradient(90deg,#FF6B9D,#FFD700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Weekend — subtle aqua tint, NOT solid */
        .day.wknd {
          background: rgba(127,255,212,0.07);
          border-color: rgba(127,255,212,0.22);
          cursor: pointer;
        }
        .day.wknd .day-num {
          background: linear-gradient(90deg,#7FFFD4,#00bfff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .day.wknd .day-dot { background: #7FFFD4; }
        .day.wknd:hover {
          background: rgba(127,255,212,0.18);
          border-color: rgba(127,255,212,0.65);
          transform: scale(1.2);
          box-shadow: 0 8px 28px rgba(127,255,212,0.35), 0 0 0 4px rgba(127,255,212,0.12);
        }

        /* Selected */
        .day.sel {
          background: linear-gradient(135deg,rgba(255,107,157,0.28),rgba(255,215,0,0.16));
          border-color: #FF6B9D;
          transform: scale(1.18);
          box-shadow: 0 10px 36px rgba(255,107,157,0.5);
          cursor: pointer;
        }
        .day.sel .day-num {
          background: linear-gradient(90deg,#FF6B9D,#FFD700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .day.sel .day-dot { background: #FFD700; }

        /* Calendar legend */
        .cal-leg { display: flex; gap: 20px; margin-top: 18px; flex-wrap: wrap; }
        .leg { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(255,255,255,0.42); font-weight: 700; }
        .leg-sq { width: 14px; height: 14px; border-radius: 5px; }

        /* ── SESSION SLOTS ── */
        .slots { display: flex; flex-direction: column; gap: 14px; }
        .slot { display: flex; align-items: center; gap: 20px; padding: 24px 28px; border-radius: 22px; border: 2px solid transparent; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .slot.s0 { background: rgba(255,107,157,0.08); border-color: rgba(255,107,157,0.2); }
        .slot.s1 { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
        .slot.s2 { background: rgba(127,255,212,0.08); border-color: rgba(127,255,212,0.2); }
        .slot.s0:hover { border-color: #FF6B9D; box-shadow: 0 10px 40px rgba(255,107,157,0.3); transform: translateX(10px) scale(1.02); }
        .slot.s1:hover { border-color: #FFD700; box-shadow: 0 10px 40px rgba(255,215,0,0.3); transform: translateX(10px) scale(1.02); }
        .slot.s2:hover { border-color: #7FFFD4; box-shadow: 0 10px 40px rgba(127,255,212,0.3); transform: translateX(10px) scale(1.02); }
        .slot.blocked { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
        .slot-emoji { font-size: 42px; animation: se var(--sd,2.5s) ease-in-out infinite; }
        @keyframes se { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-8px) rotate(3deg)} }
        .slot-label h3 { font-family: 'Fredoka One', cursive; font-size: 21px; margin-bottom: 5px; }
        .slot-label p { font-size: 13px; color: rgba(255,255,255,0.48); }
        .slot-spots { margin-left: auto; text-align: right; }
        .slot-spots-num { font-family: 'Fredoka One', cursive; font-size: 22px; }
        .slot-spots-lbl { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .slot-arr { font-size: 26px; font-weight: 900; opacity: 0.25; margin-left: 12px; transition: all 0.2s; }
        .slot:hover .slot-arr { opacity: 0.8; transform: translateX(6px); }

        /* ── VISITOR COUNTER ── */
        .ctr { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.09); border-radius: 22px; padding: 22px 28px; margin-bottom: 14px; transition: all 0.2s; }
        .ctr:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }
        .ctr-info h3 { font-family: 'Fredoka One', cursive; font-size: 22px; margin-bottom: 5px; }
        .ctr-info p { font-size: 14px; font-weight: 700; margin-top: 0; }
        .ctr-ctrl { display: flex; align-items: center; gap: 18px; }
        .ctr-btn { width: 52px; height: 52px; border-radius: 16px; border: 2px solid; font-size: 28px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s cubic-bezier(0.34,1.56,0.64,1); font-family: 'Nunito', sans-serif; }
        .ctr-btn:hover { transform: scale(1.28); }
        .ba { background: rgba(255,107,157,0.12); border-color: rgba(255,107,157,0.45); color: #FF6B9D; }
        .ba:hover { background: rgba(255,107,157,0.28); }
        .bc { background: rgba(127,255,212,0.12); border-color: rgba(127,255,212,0.45); color: #7FFFD4; }
        .bc:hover { background: rgba(127,255,212,0.28); }
        .ctr-val { font-family: 'Fredoka One', cursive; font-size: 36px; min-width: 44px; text-align: center; }

        /* Total */
        .total { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,rgba(255,107,157,0.1),rgba(255,215,0,0.07)); border: 2px solid rgba(255,165,0,0.22); border-radius: 22px; padding: 20px 28px; margin: 20px 0 28px; }
        .total-lbl { font-size: 15px; color: rgba(255,255,255,0.58); font-weight: 700; }
        .total-val { font-family: 'Fredoka One', cursive; font-size: 38px; background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        /* ── INPUTS ── */
        .inp { display: block; width: 100%; background: rgba(255,255,255,0.07); border: 2px solid rgba(255,255,255,0.11); border-radius: 18px; padding: 18px 22px; color: #fff; font-size: 17px; margin-bottom: 16px; font-family: 'Nunito', sans-serif; font-weight: 600; transition: all 0.2s; }
        .inp:focus { outline: none; border-color: rgba(255,107,157,0.65); background: rgba(255,255,255,0.1); box-shadow: 0 0 0 5px rgba(255,107,157,0.12); }
        .inp::placeholder { color: rgba(255,255,255,0.25); }

        /* ── SUMMARY ── */
        .sum { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 24px 28px; margin-bottom: 22px; }
        .sum h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); margin-bottom: 16px; font-weight: 800; }
        .sum-row { display: flex; justify-content: space-between; font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 10px; font-weight: 600; }
        .sum-row.b { font-weight: 900; color: #fff; font-size: 18px; border-top: 1px solid rgba(255,255,255,0.09); padding-top: 14px; margin-top: 6px; }

        /* ── BUTTONS ── */
        .btn-go { display: block; width: 100%; background: linear-gradient(135deg,#FF4080,#FF8C00); color: #fff; border: none; border-radius: 20px; padding: 22px; font-family: 'Fredoka One', cursive; font-size: 22px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); box-shadow: 0 8px 36px rgba(255,64,128,0.4); letter-spacing: 0.02em; text-align: center; text-decoration: none; }
        .btn-go:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 16px 52px rgba(255,64,128,0.55); }
        .btn-go:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }
        .btn-back { background: none; border: none; color: rgba(255,255,255,0.38); cursor: pointer; font-size: 15px; font-family: 'Nunito', sans-serif; margin-bottom: 24px; padding: 0; font-weight: 800; display: flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .btn-back:hover { color: rgba(255,255,255,0.75); }
        .btn-ghost { display: block; width: 100%; background: transparent; color: rgba(255,255,255,0.32); border: none; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Nunito', sans-serif; margin-top: 12px; border-radius: 16px; transition: all 0.2s; }
        .btn-ghost:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); }

        /* ── WARN / ERR ── */
        .warn { background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.2); color: #FFD700; font-size: 14px; padding: 14px 20px; border-radius: 16px; margin-bottom: 24px; font-weight: 700; line-height: 1.5; }
        .err { color: #FF6B9D; font-size: 15px; margin-bottom: 16px; padding: 14px 20px; background: rgba(255,107,157,0.08); border-radius: 14px; border: 1px solid rgba(255,107,157,0.22); font-weight: 700; }

        /* ── PENDING ── */
        .pend { text-align: center; padding: 60px 0 20px; }
        .pend .big { font-size: 96px; margin-bottom: 24px; animation: bp 1.5s ease-in-out infinite; }
        @keyframes bp { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.07)} }
        .pend h2 { font-family: 'Fredoka One', cursive; font-size: 36px; margin-bottom: 14px; }
        .pend p { color: rgba(255,255,255,0.52); font-size: 16px; line-height: 1.7; }
        .dots { display: flex; justify-content: center; gap: 10px; margin-top: 30px; }
        .dot { width: 12px; height: 12px; border-radius: 50%; animation: dp 1.2s ease-in-out infinite; }
        .d1 { background: #FF6B9D; }
        .d2 { background: #FFD700; animation-delay: 0.2s; }
        .d3 { background: #7FFFD4; animation-delay: 0.4s; }
        @keyframes dp { 0%,100%{opacity:0.2;transform:scale(0.6)} 50%{opacity:1;transform:scale(1.5)} }

        /* ── SUCCESS ── */
        .succ { text-align: center; padding: 40px 0 20px; }
        .succ .big { font-size: 96px; margin-bottom: 16px; animation: pop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes pop { 0%{transform:scale(0) rotate(-15deg)} 100%{transform:scale(1) rotate(0)} }
        .succ h2 { font-family: 'Fredoka One', cursive; font-size: 38px; background: linear-gradient(90deg,#7FFFD4,#00bfff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 10px; }
        .ref-card { background: rgba(255,215,0,0.08); border: 2px solid rgba(255,215,0,0.28); border-radius: 20px; padding: 20px 28px; margin: 22px 0; text-align: left; }
        .ref-card .rl { font-size: 12px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; font-weight: 800; }
        .ref-card .rv { font-family: 'Fredoka One', cursive; font-size: 30px; color: #FFD700; letter-spacing: 0.12em; }
        .venue { margin-top: 22px; padding: 16px; background: rgba(127,255,212,0.04); border: 1px solid rgba(127,255,212,0.12); border-radius: 16px; font-size: 13px; color: rgba(255,255,255,0.38); text-align: center; line-height: 2; font-weight: 600; }

        @media(max-width:640px) {
          .bcard { padding: 28px 20px; }
          .hdr-tags { display: none; }
          .outer { padding: 24px 16px 60px; }
        }
        @media(max-width:400px) {
          .day-num { font-size: 14px; }
          .days-grid { gap: 5px; }
        }
      `}</style>

      <div className="page">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />

        <div className="hdr">
          <div className="hdr-in">
            <div className="logo">🔬</div>
            <div>
              <div className="logo-name">Little Scientist</div>
              <div className="logo-sub">Children&apos;s Science Park · Sabaki, Mombasa Road · littlescientist.ke</div>
            </div>
            <div className="hdr-tags">
              <div className="htag ht1">⭐ Award Winning</div>
              <div className="htag ht2">🌍 Global Standard</div>
            </div>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="outer">
          <div className="bcard">
            <div className="step-dots">
              {(['date', 'slot', 'count', 'payment'] as Step[]).map(s => {
                const order: Step[] = ['date', 'slot', 'count', 'payment', 'pending', 'success']
                const cur = order.indexOf(step)
                const mine = order.indexOf(s)
                return <div key={s} className={`sd ${mine < cur ? 'done' : mine === cur ? 'active' : 'todo'}`} />
              })}
            </div>

            {step === 'date' && (
              <>
                <div className="spill">📅 Step 1 of 4</div>
                <h2 className="stitle">
                  Choose your <span>adventure day</span>
                </h2>
                <p className="ssub">Book 1–30 days ahead. Tap a date to continue — no extra buttons.</p>

                <div className="cal-nav">
                  <button
                    className="cal-btn"
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
                  <div className="cal-mth">{monthName}</div>
                  <button
                    className="cal-btn"
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

                <div className="dow-row">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="dow">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="days-grid">
                  {calendarDays.map((day, i) => {
                    if (!day.date) return <div key={`e${i}`} />
                    const dow = day.date.getDay()
                    const isW = dow === 0 || dow === 6
                    const isSel = day.dateStr === selectedDate
                    let cls = 'day'
                    if (day.isPast || day.tooFar) cls += ' past'
                    else if (isSel) cls += ' sel'
                    else if (isW) cls += ' wknd'
                    else cls += ' avail'
                    return (
                      <div
                        key={day.dateStr}
                        className={cls}
                        onClick={() => {
                          if (day.bookable) pickDate(day.dateStr)
                        }}
                      >
                        <div className="day-num">{day.date.getDate()}</div>
                        {day.bookable && <div className="day-dot" />}
                      </div>
                    )
                  })}
                </div>

                <div className="cal-leg">
                  <div className="leg">
                    <div
                      className="leg-sq"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                    />{' '}
                    Available
                  </div>
                  <div className="leg">
                    <div
                      className="leg-sq"
                      style={{ background: 'rgba(127,255,212,0.15)', border: '1px solid rgba(127,255,212,0.3)' }}
                    />{' '}
                    Weekend ⭐
                  </div>
                  <div className="leg">
                    <div className="leg-sq" style={{ background: 'rgba(255,255,255,0.04)' }} /> Unavailable
                  </div>
                </div>
              </>
            )}

            {step === 'slot' && (
              <>
                <button className="btn-back" onClick={() => setStep('date')}>
                  ← Back
                </button>
                <div className="spill">🕙 Step 2 of 4</div>
                <h2 className="stitle">
                  Pick your <span>session time</span>
                </h2>
                <p className="ssub">
                  {new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
                  — three 2-hour sessions daily.
                </p>

                <div className="slots">
                  {(['10:00-12:00', '12:00-14:00', '14:00-16:00'] as const).map((slot, idx) => {
                    const session = sessions.find(s => s.time_slot === slot) || null
                    const available = session ? session.capacity - session.booked_count : 100
                    const blocked = session?.is_blocked || available <= 0
                    const emojis = ['🌅', '☀️', '🌤️']
                    const colors = ['#FF6B9D', '#FFD700', '#7FFFD4']
                    const delays = ['2.4s', '2.9s', '3.3s']
                    return (
                      <div
                        key={slot}
                        className={`slot s${idx}${blocked ? ' blocked' : ''}`}
                        style={{ ['--sd' as any]: delays[idx] } as CSSProperties}
                        onClick={() => {
                          if (!blocked) {
                            setSelectedSession(session)
                            setStep('count')
                          }
                        }}
                      >
                        <div className="slot-emoji">{emojis[idx]}</div>
                        <div className="slot-label">
                          <h3 style={{ color: colors[idx] }}>{SLOT_LABELS[slot]}</h3>
                          <p>{blocked ? '🔴 Full / Unavailable' : `🟢 ${available} spots remaining`}</p>
                        </div>
                        <div className="slot-spots">
                          <div className="slot-spots-num" style={{ color: colors[idx] }}>
                            {blocked ? '—' : available}
                          </div>
                          <div className="slot-spots-lbl">spots left</div>
                        </div>
                        {!blocked && (
                          <div className="slot-arr" style={{ color: colors[idx] }}>
                            ›
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {step === 'count' && (
              <>
                <button className="btn-back" onClick={() => setStep('slot')}>
                  ← Back
                </button>
                <div className="spill">👨‍👩‍👧 Step 3 of 4</div>
                <h2 className="stitle">
                  Who&apos;s <span>joining today?</span>
                </h2>
                <div className="warn">🤝 Every booking needs at least 1 adult with 1 child</div>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    padding: '10px 10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setChildCountMode('height')}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      border: childCountMode === 'height' ? '2px solid rgba(255,107,157,0.65)' : '1px solid rgba(255,255,255,0.12)',
                      background:
                        childCountMode === 'height'
                          ? 'linear-gradient(135deg,rgba(255,107,157,0.22),rgba(255,215,0,0.12))'
                          : 'rgba(255,255,255,0.03)',
                      color: '#fff',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: 14,
                    }}
                  >
                    📏 By height
                  </button>
                  <button
                    type="button"
                    onClick={() => setChildCountMode('age')}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      border: childCountMode === 'age' ? '2px solid rgba(127,255,212,0.6)' : '1px solid rgba(255,255,255,0.12)',
                      background: childCountMode === 'age' ? 'rgba(127,255,212,0.14)' : 'rgba(255,255,255,0.03)',
                      color: '#fff',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: 14,
                    }}
                  >
                    🎂 By age
                  </button>
                </div>

                <div className="warn" style={{ background: 'rgba(255,215,0,0.07)' }}>
                  👶 Children under 95cm enter <strong>FREE</strong> — no ticket needed. Please inform gate staff.
                </div>

                <div className="ctr">
                  <div className="ctr-info">
                    <h3>🧑 Adults (18+)</h3>
                    <p style={{ color: '#FF6B9D' }}>KES {PRICING.adult18PlusKes.toLocaleString()}</p>
                  </div>
                  <div className="ctr-ctrl">
                    <button className="ctr-btn ba" onClick={() => setAdults(Math.max(1, adults - 1))}>
                      −
                    </button>
                    <span className="ctr-val">{adults}</span>
                    <button className="ctr-btn ba" onClick={() => setAdults(adults + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="ctr">
                  <div className="ctr-info">
                    <h3>👧 Children 95cm–17yrs</h3>
                    <p style={{ color: '#7FFFD4' }}>KES {PRICING.child95cmTo17Kes.toLocaleString()}</p>
                  </div>
                  <div className="ctr-ctrl">
                    <button className="ctr-btn bc" onClick={() => setChildrenPaid(Math.max(0, childrenPaid - 1))}>
                      −
                    </button>
                    <span className="ctr-val">{childrenPaid}</span>
                    <button className="ctr-btn bc" onClick={() => setChildrenPaid(childrenPaid + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="ctr" style={{ opacity: childCountMode === 'height' ? 1 : 0.92 }}>
                  <div className="ctr-info">
                    <h3>🧸 Under 95cm (FREE)</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>{childCountMode === 'height' ? 'Count by height' : 'Optional'}</p>
                  </div>
                  <div className="ctr-ctrl">
                    <button className="ctr-btn bc" onClick={() => setChildrenFreeUnder95(Math.max(0, childrenFreeUnder95 - 1))}>
                      −
                    </button>
                    <span className="ctr-val">{childrenFreeUnder95}</span>
                    <button className="ctr-btn bc" onClick={() => setChildrenFreeUnder95(childrenFreeUnder95 + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="total">
                  <div className="total-lbl">Total to pay</div>
                  <div className="total-val">KES {total.toLocaleString()}</div>
                </div>

                <button className="btn-go" onClick={() => setStep('payment')}>
                  Continue to payment →
                </button>
              </>
            )}

            {step === 'payment' && (
              <>
                <button className="btn-back" onClick={() => setStep('count')}>
                  ← Back
                </button>
                <div className="spill">💳 Step 4 of 4 — Final step!</div>
                <h2 className="stitle">
                  Pay with <span>M-Pesa</span>
                </h2>
                <p className="ssub">You&apos;ll get a payment prompt on your phone. Enter your PIN and you&apos;re in!</p>

                <div className="sum">
                  <h4>Your booking</h4>
                  <div className="sum-row">
                    <span>📅 Date</span>
                    <span>
                      {new Date(selectedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="sum-row">
                    <span>🕙 Time</span>
                    <span>{SLOT_LABELS[selectedSession?.time_slot || '10:00-12:00']}</span>
                  </div>
                  <div className="sum-row">
                    <span>🧑 Adults × {adults}</span>
                    <span>KES {(adults * PRICING.adult18PlusKes).toLocaleString()}</span>
                  </div>
                  <div className="sum-row">
                    <span>👧 Children 95cm–17yrs × {childrenPaid}</span>
                    <span>KES {(childrenPaid * PRICING.child95cmTo17Kes).toLocaleString()}</span>
                  </div>
                  <div className="sum-row">
                    <span>🧸 Under 95cm (FREE) × {childrenFreeUnder95}</span>
                    <span>KES 0</span>
                  </div>
                  <div className="sum-row b">
                    <span>Total</span>
                    <span>KES {total.toLocaleString()}</span>
                  </div>
                </div>

                <input className="inp" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input
                  className="inp"
                  placeholder="M-Pesa number e.g. 0700 101 425"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  type="tel"
                />

                {error && <div className="err">{error}</div>}
                <button className="btn-go" onClick={handlePayment} disabled={loading}>
                  {loading ? '🔄 Sending prompt...' : `🔬 Pay KES ${total.toLocaleString()} — Get my tickets →`}
                </button>
                <button className="btn-ghost" onClick={() => setStep('count')}>
                  ← Change visitors
                </button>

                <div className="venue" style={{ marginTop: 20 }}>
                  📍 Sabaki Estate, Mombasa Road &nbsp;·&nbsp; 📞 0700 101 425
                  <br />
                  🌐 littlescientist.ke &nbsp;·&nbsp; 🔒 Secured by M-Pesa
                </div>
              </>
            )}

            {step === 'pending' && (
              <div className="pend">
                <div className="big">📱</div>
                <h2>Check your phone!</h2>
                <p>
                  Prompt sent to{' '}
                  <strong style={{ color: '#FFD700', fontSize: 20 }}>{phone}</strong>
                </p>
                <p style={{ marginTop: 14 }}>
                  Enter your PIN to confirm
                  <br />
                  <strong style={{ color: '#FF6B9D', fontSize: 24 }}>KES {total.toLocaleString()}</strong>
                </p>
                <div className="dots">
                  <span className="dot d1" />
                  <span className="dot d2" />
                  <span className="dot d3" />
                </div>
                <p style={{ marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.22)' }}>Usually takes 30–60 seconds</p>
              </div>
            )}

            {step === 'success' && (
              <div className="succ">
                <div className="big">🎉</div>
                <h2>You are all set!</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }}>
                  Booking confirmed! Show your QR codes at the gate.
                </p>
                <div className="ref-card">
                  <div className="rl">Booking reference</div>
                  <div className="rv">{bookingRef}</div>
                </div>
                <div className="sum" style={{ textAlign: 'left' }}>
                  <div className="sum-row">
                    <span>📅</span>
                    <span>
                      {new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  <div className="sum-row">
                    <span>🕙</span>
                    <span>{SLOT_LABELS[selectedSession?.time_slot || '10:00-12:00']}</span>
                  </div>
                  <div className="sum-row">
                    <span>👨‍👩‍👧</span>
                    <span>
                    {adults} adult{adults > 1 ? 's' : ''} · {childrenPaid + childrenFreeUnder95} child
                    {childrenPaid + childrenFreeUnder95 > 1 ? 'ren' : ''}
                    </span>
                  </div>
                </div>
                <a href={`/ticket/${bookingRef}`} className="btn-go">
                  🎟️ View tickets and QR codes →
                </a>
                <div className="venue">
                  📍 Sabaki Estate, Mombasa Road · 📞 Dr. Syokau Ilovi — 0700 101 425
                  <br />
                  🌐 littlescientist.ke
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


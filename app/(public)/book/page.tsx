'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADULT_PRICE = 500
const CHILD_PRICE = 300
const MIN_DAYS = 1
const MAX_DAYS = 30

const SLOT_LABELS: Record<string, string> = {
  '10:00-12:00': '10:00 AM – 12:00 PM',
  '12:00-14:00': '12:00 PM – 2:00 PM',
  '14:00-16:00': '2:00 PM – 4:00 PM',
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

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

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

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const minDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + MIN_DAYS)
    return d
  }, [today])

  const maxDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + MAX_DAYS)
    return d
  }, [today])

  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: { date: Date | null; dateStr: string; bookable: boolean; isPast: boolean; tooFar: boolean }[] =
      []

    for (let i = 0; i < firstDay; i++) {
      days.push({ date: null, dateStr: '', bookable: false, isPast: false, tooFar: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = isoDate(date)
      days.push({
        date,
        dateStr,
        bookable: date >= minDate && date <= maxDate,
        isPast: date < minDate,
        tooFar: date > maxDate,
      })
    }

    return days
  }, [currentMonth, minDate, maxDate])

  const canGoPrev = useMemo(() => {
    const t = new Date()
    return currentMonth.year > t.getFullYear() || currentMonth.month > t.getMonth()
  }, [currentMonth])

  const canGoNext = useMemo(() => {
    const last = new Date()
    last.setDate(last.getDate() + MAX_DAYS)
    return (
      currentMonth.year < last.getFullYear() ||
      (currentMonth.year === last.getFullYear() && currentMonth.month < last.getMonth())
    )
  }, [currentMonth])

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
      const { data } = await supabase
        .from('bookings')
        .select('payment_status')
        .eq('booking_ref', bookingRef)
        .single()

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

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  })

  const progressIndex = useMemo(() => {
    const order: Step[] = ['date', 'slot', 'count', 'payment', 'pending', 'success']
    return Math.max(0, order.indexOf(step))
  }, [step])

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

  function resetToDate() {
    setStep('date')
    setSelectedSession(null)
    setError('')
  }

  function goBack() {
    setError('')
    if (step === 'slot') setStep('date')
    else if (step === 'count') setStep('slot')
    else if (step === 'payment') setStep('count')
    else setStep('date')
  }

  const slotDefs = useMemo(() => {
    return [
      { slot: '10:00-12:00' as const, theme: 'pink' as const, emoji: '🌅', speed: '2.5s' },
      { slot: '12:00-14:00' as const, theme: 'gold' as const, emoji: '☀️', speed: '3.0s' },
      { slot: '14:00-16:00' as const, theme: 'aqua' as const, emoji: '🌤️', speed: '3.4s' },
    ]
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07041a; overflow-x: hidden; }

        :root{
          --grad: linear-gradient(90deg, #FF6B9D, #FFD700);
          --space:
            radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%),
            radial-gradient(ellipse at 90% 15%, #0a2d5c 0%, transparent 45%),
            radial-gradient(ellipse at 50% 100%, #0a1f06 0%, transparent 55%),
            #07041a;
        }

        .page{
          min-height: 100vh;
          font-family: 'Nunito', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          color:#fff;
          background: var(--space);
        }

        /* Background glows (keep space theme) */
        .blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(90px); }
        .b1 { width:380px;height:380px;background:rgba(168,100,255,0.10);top:-80px;right:-80px;animation:blobdrift 22s ease-in-out infinite; }
        .b2 { width:320px;height:320px;background:rgba(78,205,196,0.09);bottom:-40px;left:-80px;animation:blobdrift 28s ease-in-out infinite -10s; }
        .b3 { width:280px;height:280px;background:rgba(255,140,66,0.08);top:40%;right:-60px;animation:blobdrift 24s ease-in-out infinite -6s; }
        @keyframes blobdrift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(35px,-45px)} }

        /* Header */
        .hdr { position:relative;z-index:10;background:rgba(7,4,26,0.85);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,0.06); }
        .hdr-wrap { max-width:1100px;margin:0 auto;display:flex;align-items:center;padding:14px 32px;gap:16px; }
        .hdr-logo { width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#FF4080,#FF8C00,#FFD700);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;box-shadow:0 0 36px rgba(255,150,0,0.55); }
        .hdr-name { font-family:'Fredoka One',cursive;font-size:26px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .hdr-sub { font-size:12px;color:rgba(255,255,255,0.40);margin-top:2px; }
        .prog { height:5px;background:rgba(255,255,255,0.06); }
        .prog-fill { height:100%;background:linear-gradient(90deg,#FF4080,#FF8C00,#FFD700);width:0%;transition:width 0.7s cubic-bezier(0.34,1.56,0.64,1); }

        .outer { max-width:1100px;margin:0 auto;padding:28px 32px 80px; position:relative; z-index:5; }

        /* Booking card */
        .bcard{
          background:rgba(255,255,255,0.045);
          border:1px solid rgba(255,255,255,0.10);
          border-radius:32px;
          padding:52px 56px;
          backdrop-filter:blur(12px);
          box-shadow:0 24px 90px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.04) inset;
          overflow:hidden;
          position:relative;
        }
        .bcard::before{
          content:'';
          position:absolute; top:-1px; left:14%; right:14%; height:3px;
          background:linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
          border-radius:3px;
        }

        /* Progress indicator (4 dots/bars, active pulses) */
        .steps { display:flex; gap:8px; margin-bottom:26px; }
        .sbar{ height:6px; border-radius:999px; background:rgba(255,255,255,0.10); flex:1; transition:all .35s; }
        .sbar.done{ background: linear-gradient(90deg,#FF6B9D,#FFD700); }
        .sbar.active{
          flex:1.6;
          background: linear-gradient(90deg,#FF6B9D,#FFD700);
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse{ 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.35)} }

        /* Headings */
        .kicker{
          display:inline-flex;align-items:center;gap:8px;
          background:rgba(255,215,0,0.10);
          border:1px solid rgba(255,215,0,0.22);
          color:#FFD700;
          font-size:12px;font-weight:900;letter-spacing:0.10em;text-transform:uppercase;
          padding:6px 16px;border-radius:999px;margin-bottom:18px;
        }
        .h2{
          font-family:'Fredoka One',cursive;
          font-size:clamp(28px,3.6vw,44px);
          line-height:1.15;
          margin-bottom:10px;
        }
        .h2 .grad{
          background:var(--grad);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .sub{ font-size:15px; color:rgba(255,255,255,0.52); line-height:1.6; margin-bottom:26px; }

        /* Back button */
        .back{
          border:none;background:none;color:rgba(255,255,255,0.45);
          font-size:15px;font-weight:900;cursor:pointer;
          font-family:'Nunito',sans-serif;
          display:inline-flex;gap:8px;align-items:center;
          margin-bottom:22px;
        }
        .back:hover{ color:rgba(255,255,255,0.78); }

        /* CALENDAR (Step 1) */
        .cal-nav{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .cal-month{
          font-family:'Fredoka One',cursive;
          font-size:26px;
          background:var(--grad);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          text-align:center;
          flex:1;
        }
        .cal-nav-btn{
          width:42px;height:42px;
          border-radius:14px;
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.12);
          color:#fff;
          font-size:18px;
          font-weight:900;
          cursor:pointer;
          transition:all .2s cubic-bezier(0.34,1.56,0.64,1);
          display:flex;align-items:center;justify-content:center;
          flex:0 0 auto;
        }
        .cal-nav-btn:hover{ transform:scale(1.06); background:rgba(255,107,157,0.16); border-color:rgba(255,107,157,0.55); }
        .cal-nav-btn:disabled{ opacity:0.18; cursor:not-allowed; transform:none; }
        .cal-nav-spacer{ width:42px; height:42px; }

        .cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:8px; }
        .dow{
          text-align:center;
          font-size:12px;
          font-weight:900;
          color:rgba(255,255,255,0.28);
          padding:6px 0 10px;
          letter-spacing:0.06em;
          text-transform:uppercase;
        }
        .day{
          aspect-ratio:1/1;
          border-radius:16px;
          border:2px solid transparent;
          display:flex;align-items:center;justify-content:center;
          position:relative;
          user-select:none;
          transition: transform .22s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow .22s cubic-bezier(0.34,1.56,0.64,1),
                      background .22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .day.empty{ background:transparent; border-color:transparent; }
        .day.bookable{
          cursor:pointer;
          background:rgba(255,255,255,0.06);
          border-color:rgba(255,255,255,0.10);
        }
        .day .num{
          font-family:'Fredoka One',cursive;
          font-size:17px;
          line-height:1;
          color:#fff;
        }
        .day.bookable:hover{
          transform:scale(1.2);
          box-shadow:0 12px 36px rgba(255,107,157,0.32);
          background:rgba(255,107,157,0.14);
        }
        .day.weekend.bookable{
          background:
            linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06)) padding-box,
            linear-gradient(135deg, rgba(127,255,212,0.95), rgba(78,205,196,0.8)) border-box;
          border:2px solid transparent;
        }
        .day.weekend.bookable .num{
          background:linear-gradient(135deg, #7FFFD4, #00BFFF);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .day.selected.bookable{
          background:
            linear-gradient(rgba(255,255,255,0.07), rgba(255,255,255,0.07)) padding-box,
            linear-gradient(135deg, rgba(255,107,157,1), rgba(255,215,0,0.95)) border-box;
          border:2px solid transparent;
          transform:scale(1.18);
          box-shadow:0 16px 44px rgba(255,107,157,0.45);
        }
        .day.past, .day.toofar{ opacity:0.12; }

        /* SLOTS (Step 2) */
        .slot{
          width:100%;
          border-radius:22px;
          padding:24px 28px;
          border:2px solid transparent;
          display:flex;align-items:center;gap:18px;
          cursor:pointer;
          transition: transform .22s cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow .22s cubic-bezier(0.34,1.56,0.64,1);
          margin-bottom:16px;
          position:relative;
          overflow:hidden;
        }
        .slot:hover{ transform:translateX(10px) scale(1.02); }
        .slot.blocked{ opacity:0.30; cursor:not-allowed; pointer-events:none; }
        .slot .em{
          font-size:42px;
          filter:drop-shadow(0 6px 16px rgba(0,0,0,0.35));
          animation: bounce var(--spd, 3s) ease-in-out infinite;
        }
        @keyframes bounce{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .slot .label{ min-width: 0; }
        .slot .label h3{
          font-family:'Fredoka One',cursive;
          font-size:22px;
          margin-bottom:4px;
          line-height:1.1;
        }
        .slot .label p{ font-size:14px; color:rgba(255,255,255,0.50); }
        .slot .meta{ margin-left:auto; display:flex; align-items:center; gap:16px; }
        .spots{
          font-family:'Fredoka One',cursive;
          font-size:18px;
          padding:10px 12px;
          border-radius:16px;
          border:1px solid rgba(255,255,255,0.14);
          background:rgba(0,0,0,0.18);
          min-width:170px;
          text-align:right;
        }
        .arr{
          font-size:28px;
          font-weight:900;
          opacity:0.35;
          transition: transform .22s cubic-bezier(0.34,1.56,0.64,1), opacity .22s;
        }
        .slot:hover .arr{ transform:translateX(7px); opacity:0.85; }

        .slot.pink{
          background:rgba(255,107,157,0.085);
          border-color:rgba(255,107,157,0.22);
        }
        .slot.pink:hover{ box-shadow:0 14px 46px rgba(255,107,157,0.30); border-color:rgba(255,107,157,0.70); }
        .slot.pink .label h3{ color:#FF6B9D; }
        .slot.pink .spots{ border-color:rgba(255,107,157,0.28); }

        .slot.gold{
          background:rgba(255,215,0,0.075);
          border-color:rgba(255,215,0,0.22);
        }
        .slot.gold:hover{ box-shadow:0 14px 46px rgba(255,215,0,0.24); border-color:rgba(255,215,0,0.75); }
        .slot.gold .label h3{ color:#FFD700; }
        .slot.gold .spots{ border-color:rgba(255,215,0,0.28); }

        .slot.aqua{
          background:rgba(127,255,212,0.075);
          border-color:rgba(127,255,212,0.22);
        }
        .slot.aqua:hover{ box-shadow:0 14px 46px rgba(127,255,212,0.24); border-color:rgba(127,255,212,0.75); }
        .slot.aqua .label h3{ color:#7FFFD4; }
        .slot.aqua .spots{ border-color:rgba(127,255,212,0.28); }

        /* COUNTERS (Step 3) */
        .rule-pill{
          background:rgba(255,215,0,0.10);
          border:1px solid rgba(255,215,0,0.26);
          color:#FFD700;
          padding:14px 18px;
          border-radius:16px;
          font-weight:800;
          line-height:1.5;
          margin-bottom:22px;
        }
        .ctr{
          background:rgba(255,255,255,0.05);
          border:2px solid rgba(255,255,255,0.09);
          border-radius:22px;
          padding:24px 28px;
          display:flex;align-items:center;justify-content:space-between;
          margin-bottom:14px;
        }
        .ctr h3{ font-family:'Fredoka One',cursive; font-size:22px; margin-bottom:4px; }
        .ctr p{ font-size:14px; color:rgba(255,255,255,0.52); }
        .ctrl{ display:flex; align-items:center; gap:20px; }
        .btn{
          width:52px;height:52px;
          border-radius:16px;
          border:2px solid;
          background:transparent;
          color:#fff;
          font-size:26px;
          font-weight:900;
          cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          transition: transform .16s cubic-bezier(0.34,1.56,0.64,1), background .16s, border-color .16s;
          font-family:'Nunito',sans-serif;
        }
        .btn:hover{ transform:scale(1.12); }
        .btn.pink{ border-color:rgba(255,107,157,0.55); background:rgba(255,107,157,0.12); color:#FF6B9D; }
        .btn.pink:hover{ background:rgba(255,107,157,0.22); }
        .btn.aqua{ border-color:rgba(127,255,212,0.55); background:rgba(127,255,212,0.12); color:#7FFFD4; }
        .btn.aqua:hover{ background:rgba(127,255,212,0.22); }
        .val{
          font-family:'Fredoka One',cursive;
          font-size:36px;
          min-width:52px;
          text-align:center;
        }

        .total{
          display:flex;align-items:center;justify-content:space-between;
          background:linear-gradient(135deg, rgba(255,107,157,0.10), rgba(255,215,0,0.07));
          border:2px solid rgba(255,165,0,0.22);
          border-radius:22px;
          padding:20px 28px;
          margin:18px 0 22px;
        }
        .total .lbl{ font-size:16px; font-weight:800; color:rgba(255,255,255,0.60); }
        .total .amt{
          font-family:'Fredoka One',cursive;
          font-size:38px;
          background:var(--grad);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }

        /* PAYMENT (Step 4) */
        .sum{
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:20px;
          padding:22px 26px;
          margin-bottom:18px;
        }
        .sum .row{ display:flex; justify-content:space-between; align-items:flex-end; gap:18px; margin-bottom:10px; }
        .sum .row span{ font-size:15px; color:rgba(255,255,255,0.62); font-weight:700; }
        .sum .row strong{ color:#fff; font-weight:900; }
        .sum .totalRow{
          border-top:1px solid rgba(255,255,255,0.10);
          padding-top:12px;
          margin-top:6px;
        }
        .sum .totalRow .tLabel{ font-family:'Fredoka One',cursive; font-size:16px; color:rgba(255,255,255,0.70); }
        .sum .totalRow .tVal{
          font-family:'Fredoka One',cursive;
          font-size:26px;
          background:var(--grad);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        .in{
          width:100%;
          padding:18px 22px;
          font-size:17px;
          border-radius:18px;
          border:2px solid rgba(255,255,255,0.11);
          background:rgba(255,255,255,0.07);
          color:#fff;
          font-family:'Nunito',sans-serif;
          font-weight:700;
          transition: box-shadow .2s, border-color .2s, background .2s;
          margin-bottom:14px;
        }
        .in:focus{
          outline:none;
          border-color:rgba(255,107,157,0.65);
          background:rgba(255,255,255,0.10);
          box-shadow:0 0 0 5px rgba(255,107,157,0.12);
        }
        .in::placeholder{ color:rgba(255,255,255,0.25); }

        .err{
          background:rgba(255,107,157,0.08);
          border:1px solid rgba(255,107,157,0.22);
          color:#FF6B9D;
          padding:14px 18px;
          border-radius:14px;
          font-weight:800;
          margin-bottom:14px;
        }

        .pay{
          width:100%;
          border:none;
          border-radius:20px;
          padding:22px;
          font-family:'Fredoka One',cursive;
          font-size:22px;
          cursor:pointer;
          color:#fff;
          background:linear-gradient(135deg,#FF4080,#FF8C00);
          box-shadow:0 10px 40px rgba(255,64,128,0.42);
          transition: transform .22s cubic-bezier(0.34,1.56,0.64,1), box-shadow .22s;
        }
        .pay:hover{ transform:translateY(-4px) scale(1.03); box-shadow:0 18px 58px rgba(255,64,128,0.58); }
        .pay:disabled{ opacity:0.62; cursor:not-allowed; transform:none; box-shadow:0 10px 40px rgba(255,64,128,0.28); }

        .ghost{
          width:100%;
          margin-top:12px;
          border:none;
          background:transparent;
          color:rgba(255,255,255,0.32);
          font-weight:800;
          font-size:15px;
          border-radius:16px;
          padding:14px;
          cursor:pointer;
        }
        .ghost:hover{ background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.60); }

        /* Pending / Success */
        .center{ text-align:center; padding:44px 0 10px; }
        .big{ font-size:96px; margin-bottom:18px; animation: pop 1.5s ease-in-out infinite; }
        @keyframes pop { 0%,100%{ transform:translateY(0) scale(1)} 50%{ transform:translateY(-14px) scale(1.05)} }
        .center h2{ font-family:'Fredoka One',cursive; font-size:38px; margin-bottom:12px; }
        .center p{ font-size:16px; color:rgba(255,255,255,0.55); line-height:1.7; }
        .dots{ display:flex; justify-content:center; gap:10px; margin-top:26px; }
        .dot{ width:12px; height:12px; border-radius:50%; animation: dot 1.2s ease-in-out infinite; }
        .d1{ background:#FF6B9D; } .d2{ background:#FFD700; animation-delay:.2s } .d3{ background:#7FFFD4; animation-delay:.4s }
        @keyframes dot { 0%,100%{ opacity:.2; transform:scale(.65)} 50%{ opacity:1; transform:scale(1.55)} }

        .ref{
          background:rgba(255,215,0,0.08);
          border:2px solid rgba(255,215,0,0.28);
          border-radius:20px;
          padding:18px 22px;
          margin:18px 0 22px;
          text-align:left;
        }
        .ref .rl{ font-size:12px; font-weight:900; letter-spacing:0.10em; text-transform:uppercase; color:rgba(255,255,255,0.36); margin-bottom:6px; }
        .ref .rv{ font-family:'Fredoka One',cursive; font-size:30px; color:#FFD700; letter-spacing:0.12em; }

        .ticket{
          display:block;
          text-decoration:none;
          text-align:center;
        }

        @media(max-width: 768px){
          .outer{ padding:18px 16px 60px; }
          .hdr-wrap{ padding:12px 16px; }
          .bcard{ padding:32px 24px; }
          .spots{ min-width: 150px; font-size:16px; }
          .center h2{ font-size:34px; }
        }
      `}</style>

      <div className="page">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />

        <div className="hdr">
          <div className="hdr-wrap">
            <div className="hdr-logo">🔬</div>
            <div>
              <div className="hdr-name">Little Scientist</div>
              <div className="hdr-sub">Children&apos;s Science Park · Sabaki, Mombasa Road</div>
            </div>
          </div>
          <div className="prog">
            <div
              className="prog-fill"
              style={{
                width: `${{ date: 18, slot: 42, count: 66, payment: 84, pending: 94, success: 100 }[step]}%`,
              }}
            />
          </div>
        </div>

        <div className="outer">
          <div className="bcard">
            <div className="steps" aria-label="Booking progress">
              {(['date', 'slot', 'count', 'payment'] as const).map((s, i) => {
                const cur = Math.min(progressIndex, 3)
                const cls = i < cur ? 'sbar done' : i === cur ? 'sbar active' : 'sbar'
                return <div key={s} className={cls} />
              })}
            </div>

            {/* STEP 1: DATE */}
            {step === 'date' && (
              <>
                <div className="kicker">📅 Step 1 of 4</div>
                <div className="h2">
                  Choose your <span className="grad">adventure day</span>
                </div>
                <div className="sub">Book 1–30 days ahead. Tap a date to continue — no extra buttons.</div>

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
                    aria-label="Previous month"
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
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="cal-grid" role="grid" aria-label="Select a date">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div className="dow" key={d}>
                      {d}
                    </div>
                  ))}

                  {calendarDays.map((day, idx) => {
                    if (!day.date) return <div key={`e-${idx}`} className="day empty" aria-hidden="true" />

                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                    const isSelected = day.dateStr === selectedDate
                    const isBookable = day.bookable

                    const cls = [
                      'day',
                      isBookable ? 'bookable' : '',
                      isWeekend ? 'weekend' : '',
                      isSelected ? 'selected' : '',
                      day.isPast ? 'past' : '',
                      day.tooFar ? 'toofar' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <div
                        key={day.dateStr}
                        className={cls}
                        role="gridcell"
                        aria-selected={isSelected}
                        onClick={() => {
                          if (!isBookable) return
                          setSelectedDate(day.dateStr)
                          setSelectedSession(null)
                          setError('')

                          if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
                          autoAdvanceTimer.current = setTimeout(() => setStep('slot'), 400)
                        }}
                      >
                        <div className="num">{day.date.getDate()}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* STEP 2: SLOT */}
            {step === 'slot' && (
              <>
                <button className="back" onClick={resetToDate}>
                  ← Back
                </button>

                <div className="kicker">🕙 Step 2 of 4</div>
                <div className="h2">
                  Pick your <span className="grad">session time</span>
                </div>
                <div className="sub">
                  {selectedDate
                    ? new Date(selectedDate).toLocaleDateString('en-KE', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })
                    : 'Select a date to view sessions.'}
                </div>

                {slotDefs.map(({ slot, theme, emoji, speed }) => {
                  const session = sessions.find(s => s.time_slot === slot) || null
                  const available = session ? session.capacity - session.booked_count : 100
                  const blocked = session?.is_blocked || available <= 0
                  return (
                    <div
                      key={slot}
                      className={`slot ${theme}${blocked ? ' blocked' : ''}`}
                      style={{ ['--spd' as any]: speed }}
                      onClick={() => {
                        if (blocked) return
                        setSelectedSession(session)
                        setError('')
                        setStep('count')
                      }}
                    >
                      <div className="em" aria-hidden="true">
                        {emoji}
                      </div>
                      <div className="label">
                        <h3>{SLOT_LABELS[slot]}</h3>
                        <p>{blocked ? '🔴 Full / Unavailable' : '2 hours of hands‑on discovery'}</p>
                      </div>
                      <div className="meta">
                        <div className="spots">{blocked ? 'FULL' : `${available} spots left`}</div>
                        {!blocked && <div className="arr">›</div>}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* STEP 3: COUNT */}
            {step === 'count' && (
              <>
                <button className="back" onClick={goBack}>
                  ← Back
                </button>

                <div className="kicker">👨‍👩‍👧 Step 3 of 4</div>
                <div className="h2">
                  Who&apos;s <span className="grad">joining?</span>
                </div>
                <div className="rule-pill">✨ Every booking requires at least 1 adult AND 1 child — thank you!</div>

                <div className="ctr">
                  <div>
                    <h3>🧑 Adults</h3>
                    <p style={{ color: '#FF6B9D', fontWeight: 800 }}>
                      KES {ADULT_PRICE.toLocaleString()} per person
                    </p>
                  </div>
                  <div className="ctrl">
                    <button className="btn pink" onClick={() => setAdults(Math.max(1, adults - 1))} aria-label="Decrease adults">
                      −
                    </button>
                    <div className="val">{adults}</div>
                    <button className="btn pink" onClick={() => setAdults(adults + 1)} aria-label="Increase adults">
                      +
                    </button>
                  </div>
                </div>

                <div className="ctr">
                  <div>
                    <h3>👧 Children</h3>
                    <p style={{ color: '#7FFFD4', fontWeight: 800 }}>
                      KES {CHILD_PRICE.toLocaleString()} per person
                    </p>
                  </div>
                  <div className="ctrl">
                    <button className="btn aqua" onClick={() => setChildren(Math.max(1, children - 1))} aria-label="Decrease children">
                      −
                    </button>
                    <div className="val">{children}</div>
                    <button className="btn aqua" onClick={() => setChildren(children + 1)} aria-label="Increase children">
                      +
                    </button>
                  </div>
                </div>

                <div className="total">
                  <div className="lbl">Total to pay</div>
                  <div className="amt">KES {total.toLocaleString()}</div>
                </div>

                <button className="pay" onClick={() => setStep('payment')}>
                  Continue to payment →
                </button>
              </>
            )}

            {/* STEP 4: PAYMENT */}
            {step === 'payment' && (
              <>
                <button className="back" onClick={goBack}>
                  ← Back
                </button>

                <div className="kicker">💳 Step 4 of 4</div>
                <div className="h2">
                  Pay with <span className="grad">M‑Pesa</span>
                </div>
                <div className="sub">Your phone will receive a prompt instantly. Enter your PIN to confirm.</div>

                <div className="sum">
                  <div className="row">
                    <span>📅 Date</span>
                    <strong>
                      {selectedDate
                        ? new Date(selectedDate).toLocaleDateString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </strong>
                  </div>
                  <div className="row">
                    <span>🕙 Session</span>
                    <strong>{SLOT_LABELS[selectedSession?.time_slot || '10:00-12:00']}</strong>
                  </div>
                  <div className="row">
                    <span>🧑 Adults × {adults}</span>
                    <strong>KES {(adults * ADULT_PRICE).toLocaleString()}</strong>
                  </div>
                  <div className="row">
                    <span>👧 Children × {children}</span>
                    <strong>KES {(children * CHILD_PRICE).toLocaleString()}</strong>
                  </div>
                  <div className="row totalRow">
                    <span className="tLabel">Total</span>
                    <span className="tVal">KES {total.toLocaleString()}</span>
                  </div>
                </div>

                <input className="in" placeholder="Booking name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input
                  className="in"
                  placeholder="M‑Pesa number e.g. 0700 101 425"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                />

                {error && <div className="err">{error}</div>}

                <button className="pay" onClick={handlePayment} disabled={loading}>
                  {loading ? '🔄 Sending prompt...' : `🔬 Pay KES ${total.toLocaleString()} →`}
                </button>
                <button className="ghost" onClick={() => setStep('count')}>
                  ← Change visitors
                </button>
              </>
            )}

            {/* PENDING */}
            {step === 'pending' && (
              <div className="center">
                <div className="big">📱</div>
                <h2>Check your phone!</h2>
                <p>
                  M‑Pesa prompt sent to
                  <br />
                  <strong style={{ color: '#FFD700', fontFamily: 'Fredoka One, cursive', fontSize: 22 }}>
                    {phone}
                  </strong>
                </p>
                <p style={{ marginTop: 12 }}>
                  Confirm payment of{' '}
                  <strong style={{ color: '#FF6B9D', fontFamily: 'Fredoka One, cursive', fontSize: 26 }}>
                    KES {total.toLocaleString()}
                  </strong>
                </p>
                <div className="dots">
                  <span className="dot d1" />
                  <span className="dot d2" />
                  <span className="dot d3" />
                </div>
                <p style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>
                  Waiting for confirmation — usually 30–60 seconds
                </p>
              </div>
            )}

            {/* SUCCESS */}
            {step === 'success' && (
              <div className="center">
                <div className="big" style={{ animation: 'none' }}>
                  🎉
                </div>
                <h2 style={{ background: 'linear-gradient(90deg,#7FFFD4,#00BFFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  You are all set!
                </h2>
                <p>Booking confirmed! Your QR tickets are ready below.</p>
                <div className="ref">
                  <div className="rl">Booking reference</div>
                  <div className="rv">{bookingRef}</div>
                </div>
                <a className="pay ticket" href={`/ticket/${bookingRef}`} style={{ textAlign: 'center' }}>
                  🎟️ View tickets and QR codes →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


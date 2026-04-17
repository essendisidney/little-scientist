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

type Session = { id: string; session_date: string; time_slot: string; capacity: number; booked_count: number; is_blocked: boolean }
type Step = 'date' | 'slot' | 'count' | 'payment' | 'pending' | 'success'

const MIN_DAYS = 1
const MAX_DAYS = 30

// ── SVG SCIENCE ILLUSTRATIONS ──────────────────────────────

const KidWithMicroscope = () => (
  <svg viewBox="0 0 120 160" fill="none" style={{ width: '100%', height: '100%' }}>
    {/* body */}
    <ellipse cx="60" cy="120" rx="22" ry="28" fill="#FF6B9D" opacity="0.9" />
    {/* lab coat */}
    <path
      d="M38 105 Q38 145 60 148 Q82 145 82 105 Q72 110 60 110 Q48 110 38 105Z"
      fill="#fff"
      opacity="0.85"
    />
    <path d="M55 110 L55 148 M65 110 L65 148" stroke="#e0e0e0" strokeWidth="1" opacity="0.6" />
    {/* head */}
    <circle cx="60" cy="70" r="22" fill="#FDBCB4" />
    {/* hair */}
    <path d="M38 62 Q40 45 60 43 Q80 45 82 62 Q78 50 60 49 Q42 50 38 62Z" fill="#4a2c0a" />
    <path d="M38 62 Q35 68 37 75" stroke="#4a2c0a" strokeWidth="4" strokeLinecap="round" />
    <path d="M82 62 Q85 68 83 75" stroke="#4a2c0a" strokeWidth="4" strokeLinecap="round" />
    {/* face */}
    <circle cx="53" cy="70" r="3.5" fill="#fff" />
    <circle cx="67" cy="70" r="3.5" fill="#fff" />
    <circle cx="54" cy="70" r="2" fill="#2d1b00" />
    <circle cx="68" cy="70" r="2" fill="#2d1b00" />
    <path d="M53 80 Q60 86 67 80" stroke="#e8756a" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* glasses */}
    <circle cx="53" cy="70" r="6" stroke="#6c4bc7" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="67" cy="70" r="6" stroke="#6c4bc7" strokeWidth="1.5" fill="none" opacity="0.7" />
    <path d="M59 70 L61 70" stroke="#6c4bc7" strokeWidth="1.5" />
    {/* arms */}
    <path d="M38 112 Q25 118 22 130" stroke="#FDBCB4" strokeWidth="8" strokeLinecap="round" />
    <path d="M82 112 Q92 118 95 128" stroke="#FDBCB4" strokeWidth="8" strokeLinecap="round" />
    {/* hands */}
    <circle cx="21" cy="132" r="6" fill="#FDBCB4" />
    <circle cx="96" cy="130" r="6" fill="#FDBCB4" />
    {/* microscope */}
    <rect x="85" y="110" width="8" height="32" rx="2" fill="#7c6fc7" />
    <rect x="80" y="138" width="18" height="5" rx="2" fill="#5a4fa0" />
    <rect x="83" y="105" width="12" height="8" rx="2" fill="#9b8fdf" />
    <circle cx="89" cy="102" r="5" fill="#c5bef5" stroke="#7c6fc7" strokeWidth="1.5" />
    <rect x="96" y="118" width="12" height="4" rx="2" fill="#ff6b9d" />
    {/* legs */}
    <rect x="50" y="145" width="9" height="16" rx="4" fill="#6c4bc7" />
    <rect x="62" y="145" width="9" height="16" rx="4" fill="#6c4bc7" />
    {/* shoes */}
    <ellipse cx="54" cy="161" rx="7" ry="4" fill="#2d1b69" />
    <ellipse cx="66" cy="161" rx="7" ry="4" fill="#2d1b69" />
    {/* stars around */}
    <text x="5" y="55" fontSize="12" fill="#FFD700">
      ✦
    </text>
    <text x="100" y="50" fontSize="10" fill="#FF6B9D">
      ✦
    </text>
    <text x="10" y="90" fontSize="8" fill="#7FFFD4">
      ★
    </text>
  </svg>
)

const KidWithBeaker = () => (
  <svg viewBox="0 0 120 160" fill="none" style={{ width: '100%', height: '100%' }}>
    {/* body */}
    <ellipse cx="60" cy="120" rx="22" ry="28" fill="#4ECDC4" opacity="0.9" />
    {/* shirt stripes */}
    <path
      d="M38 105 Q38 145 60 148 Q82 145 82 105 Q72 110 60 110 Q48 110 38 105Z"
      fill="#45B8AC"
      opacity="0.9"
    />
    <path
      d="M40 112 L80 112 M40 120 L80 120 M40 128 L80 128 M40 136 L80 136"
      stroke="#2d8a84"
      strokeWidth="1.5"
      opacity="0.5"
    />
    {/* head */}
    <circle cx="60" cy="68" r="23" fill="#FFD4B2" />
    {/* hair - afro style */}
    <ellipse cx="60" cy="52" rx="25" ry="18" fill="#1a0a00" />
    <path d="M37 58 Q34 70 36 78" stroke="#1a0a00" strokeWidth="5" strokeLinecap="round" />
    <path d="M83 58 Q86 70 84 78" stroke="#1a0a00" strokeWidth="5" strokeLinecap="round" />
    {/* face */}
    <circle cx="52" cy="68" r="4" fill="#fff" />
    <circle cx="68" cy="68" r="4" fill="#fff" />
    <circle cx="53" cy="68" r="2.2" fill="#1a0a00" />
    <circle cx="69" cy="68" r="2.2" fill="#1a0a00" />
    <ellipse cx="60" cy="78" rx="6" ry="3.5" fill="#e8756a" />
    <path d="M54 78 Q60 84 66 78" fill="#c0392b" />
    {/* cheeks */}
    <circle cx="46" cy="74" r="5" fill="#FFB3A3" opacity="0.6" />
    <circle cx="74" cy="74" r="5" fill="#FFB3A3" opacity="0.6" />
    {/* arms */}
    <path d="M38 112 Q20 115 15 125" stroke="#FFD4B2" strokeWidth="8" strokeLinecap="round" />
    <path d="M82 112 Q100 115 105 122" stroke="#FFD4B2" strokeWidth="8" strokeLinecap="round" />
    {/* beaker in right hand */}
    <path
      d="M98 118 L94 140 Q93 148 100 149 Q107 148 106 140 L102 118Z"
      fill="#a8e6cf"
      stroke="#2ecc71"
      strokeWidth="1.5"
    />
    <path d="M96 118 L104 118" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round" />
    {/* bubbles in beaker */}
    <circle cx="99" cy="138" r="2.5" fill="#fff" opacity="0.7" />
    <circle cx="103" cy="133" r="1.8" fill="#fff" opacity="0.6" />
    <circle cx="97" cy="143" r="1.5" fill="#fff" opacity="0.5" />
    {/* liquid color */}
    <path d="M95 130 L94 140 Q93 148 100 149 Q107 148 106 140 L105 130Z" fill="#2ecc71" opacity="0.5" />
    {/* bubbles floating */}
    <circle cx="110" cy="110" r="4" stroke="#2ecc71" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="115" cy="98" r="3" stroke="#a8e6cf" strokeWidth="1.2" fill="none" opacity="0.6" />
    <circle cx="108" cy="94" r="2" stroke="#2ecc71" strokeWidth="1" fill="none" opacity="0.5" />
    {/* left hand waving */}
    <circle cx="14" cy="127" r="6" fill="#FFD4B2" />
    {/* legs */}
    <rect x="50" y="145" width="9" height="16" rx="4" fill="#2d8a84" />
    <rect x="62" y="145" width="9" height="16" rx="4" fill="#2d8a84" />
    <ellipse cx="54" cy="161" rx="7" ry="4" fill="#1a5276" />
    <ellipse cx="66" cy="161" rx="7" ry="4" fill="#1a5276" />
    <text x="2" y="50" fontSize="14" fill="#FFD700">
      ✦
    </text>
    <text x="100" y="88" fontSize="10" fill="#FF6B9D">
      ✦
    </text>
  </svg>
)

const KidWithRocket = () => (
  <svg viewBox="0 0 120 170" fill="none" style={{ width: '100%', height: '100%' }}>
    {/* body */}
    <ellipse cx="60" cy="125" rx="22" ry="28" fill="#FF8C42" opacity="0.9" />
    <path d="M38 110 Q38 150 60 153 Q82 150 82 110 Q72 115 60 115 Q48 115 38 110Z" fill="#fff" opacity="0.9" />
    <path d="M58 115 L58 153" stroke="#ff8c42" strokeWidth="2" opacity="0.4" />
    {/* head */}
    <circle cx="60" cy="72" r="22" fill="#FDBCB4" />
    {/* hair */}
    <path d="M38 65 Q42 48 60 46 Q78 48 82 65" fill="#8B4513" />
    <path d="M38 65 Q36 70 38 78" stroke="#8B4513" strokeWidth="5" strokeLinecap="round" />
    <path d="M82 65 Q84 70 82 78" stroke="#8B4513" strokeWidth="5" strokeLinecap="round" />
    {/* spiky hair bits */}
    <path d="M45 50 L42 40 L48 50" fill="#8B4513" />
    <path d="M55 47 L55 36 L60 48" fill="#8B4513" />
    <path d="M65 47 L68 37 L70 49" fill="#8B4513" />
    {/* face */}
    <circle cx="52" cy="72" r="4" fill="#fff" />
    <circle cx="68" cy="72" r="4" fill="#fff" />
    <circle cx="53" cy="72" r="2" fill="#2d1b00" />
    <circle cx="69" cy="72" r="2" fill="#2d1b00" />
    {/* big smile */}
    <path d="M50 82 Q60 92 70 82" stroke="#e8756a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M50 82 Q60 94 70 82 Q60 90 50 82Z" fill="#e8756a" opacity="0.3" />
    {/* arms - one pointing up with rocket */}
    <path d="M38 115 Q25 110 20 100" stroke="#FDBCB4" strokeWidth="8" strokeLinecap="round" />
    <path d="M82 115 Q95 108 100 95" stroke="#FDBCB4" strokeWidth="8" strokeLinecap="round" />
    {/* rocket in raised hand */}
    <path d="M100 65 Q108 50 100 35 Q92 50 100 65Z" fill="#e74c3c" />
    <rect x="95" y="55" width="10" height="20" rx="2" fill="#c0392b" />
    <circle cx="100" cy="60" r="5" fill="#85C1E9" stroke="#2980b9" strokeWidth="1" />
    <path d="M93 72 Q88 80 90 82" stroke="#f39c12" strokeWidth="3" strokeLinecap="round" />
    <path d="M107 72 Q112 80 110 82" stroke="#f39c12" strokeWidth="3" strokeLinecap="round" />
    {/* fire */}
    <path d="M96 75 Q100 88 100 90 Q100 88 104 75" fill="#FF6B00" opacity="0.9" />
    <path d="M97 75 Q100 85 100 87 Q100 85 103 75" fill="#FFD700" opacity="0.8" />
    {/* stars around rocket */}
    <text x="108" y="50" fontSize="10" fill="#FFD700">
      ✦
    </text>
    <text x="112" y="65" fontSize="8" fill="#FF6B9D">
      ★
    </text>
    <text x="85" y="40" fontSize="12" fill="#7FFFD4">
      ✦
    </text>
    {/* left hand */}
    <circle cx="19" cy="102" r="6" fill="#FDBCB4" />
    {/* legs */}
    <rect x="50" y="150" width="9" height="16" rx="4" fill="#e74c3c" />
    <rect x="62" y="150" width="9" height="16" rx="4" fill="#e74c3c" />
    <ellipse cx="54" cy="166" rx="7" ry="4" fill="#922b21" />
    <ellipse cx="66" cy="166" rx="7" ry="4" fill="#922b21" />
  </svg>
)

const FloatingAtom = () => (
  <svg viewBox="0 0 100 100" fill="none" style={{ width: '100%', height: '100%' }}>
    <circle cx="50" cy="50" r="8" fill="#FFD700" />
    <ellipse cx="50" cy="50" rx="42" ry="18" stroke="#FF6B9D" strokeWidth="2.5" fill="none" />
    <ellipse cx="50" cy="50" rx="42" ry="18" stroke="#4ECDC4" strokeWidth="2.5" fill="none" transform="rotate(60 50 50)" />
    <ellipse cx="50" cy="50" rx="42" ry="18" stroke="#FF8C42" strokeWidth="2.5" fill="none" transform="rotate(120 50 50)" />
    <circle cx="92" cy="50" r="5" fill="#FF6B9D" />
    <circle cx="29" cy="19" r="5" fill="#4ECDC4" />
    <circle cx="29" cy="81" r="5" fill="#FF8C42" />
  </svg>
)

const FloatingDNA = () => (
  <svg viewBox="0 0 50 130" fill="none" style={{ width: '100%', height: '100%' }}>
    <path
      d="M12 5 Q38 20 12 35 Q38 50 12 65 Q38 80 12 95 Q38 110 12 125"
      stroke="#FF6B9D"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M38 5 Q12 20 38 35 Q12 50 38 65 Q12 80 38 95 Q12 110 38 125"
      stroke="#4ECDC4"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    <line x1="16" y1="12" x2="34" y2="12" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="22" x2="38" y2="22" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="32" x2="34" y2="32" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="48" x2="38" y2="48" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="58" x2="34" y2="58" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="70" x2="38" y2="70" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="80" x2="34" y2="80" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="95" x2="38" y2="95" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="108" x2="34" y2="108" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
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
      days.push({ date, dateStr, bookable: date >= minDate && date <= maxDate, isPast: date < minDate, tooFar: date > maxDate })
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
    return currentMonth.year < m.getFullYear() || (currentMonth.year === m.getFullYear() && currentMonth.month < m.getMonth())
  })()

  useEffect(() => {
    if (!selectedDate) return
    supabase.from('sessions').select('*').eq('session_date', selectedDate).then(({ data }) => setSessions(data || []))
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
        setError('Payment failed.')
        setStep('payment')
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [bookingRef])

  useEffect(() => {
    if (step === 'pending') return pollStatus()
  }, [step, pollStatus])

  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })

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
        body: JSON.stringify({ sessionId: selectedSession?.id, phone, name, adultCount: adults, childCount: children }),
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
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #07041a; overflow-x: hidden; }

        .page {
          min-height: 100vh;
          font-family: 'Nunito', sans-serif;
          color: #fff;
          background: radial-gradient(ellipse at 10% 0%, #2a0845 0%, transparent 50%), radial-gradient(ellipse at 90% 10%, #0a2d5c 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, #0a1f06 0%, transparent 60%), #07041a;
          overflow-x: hidden;
        }

        /* Floating science items - fixed positions */
        .sci-item { position: fixed; pointer-events: none; z-index: 1; }
        .sci-item.i1 { top: 5%; left: 2%; width: 90px; height: 110px; animation: sway1 18s ease-in-out infinite; }
        .sci-item.i2 { top: 20%; right: 1%; width: 80px; height: 100px; animation: sway2 22s ease-in-out infinite -5s; }
        .sci-item.i3 { bottom: 30%; left: 1%; width: 45px; height: 120px; animation: sway1 25s ease-in-out infinite -10s; }
        .sci-item.i4 { bottom: 15%; right: 2%; width: 85px; height: 85px; animation: sway2 20s ease-in-out infinite -7s; }
        .sci-item.i5 { top: 45%; left: 0%; width: 75px; height: 90px; animation: sway1 30s ease-in-out infinite -3s; }
        .sci-item.i6 { top: 60%; right: 0%; width: 40px; height: 110px; animation: sway2 24s ease-in-out infinite -12s; }
        @keyframes sway1 { 0%,100%{transform:translateY(0) rotate(-4deg)} 33%{transform:translateY(-20px) rotate(4deg)} 66%{transform:translateY(8px) rotate(-1deg)} }
        @keyframes sway2 { 0%,100%{transform:translateY(0) rotate(4deg)} 33%{transform:translateY(15px) rotate(-3deg)} 66%{transform:translateY(-10px) rotate(2deg)} }

        /* Glowing orbs */
        .orb { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(80px); }
        .orb1 { width: 400px; height: 400px; background: rgba(255,60,150,0.08); top: -100px; right: -100px; animation: orbdrift 20s ease-in-out infinite; }
        .orb2 { width: 350px; height: 350px; background: rgba(60,100,255,0.07); bottom: 0; left: -100px; animation: orbdrift 26s ease-in-out infinite -10s; }
        .orb3 { width: 300px; height: 300px; background: rgba(80,255,160,0.06); top: 40%; right: -80px; animation: orbdrift 22s ease-in-out infinite -5s; }
        @keyframes orbdrift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-50px)} }

        /* HEADER */
        .hdr { position: relative; z-index: 20; background: rgba(7,4,26,0.8); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .hdr-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: center; padding: 16px 24px; gap: 16px; }
        .hdr-logo { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#FF4080,#FF8C00,#FFD700); display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; animation: logobounce 2.5s ease-in-out infinite; box-shadow: 0 0 40px rgba(255,150,0,0.5); }
        @keyframes logobounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.05)} }
        .hdr-name { font-family: 'Fredoka One', cursive; font-size: 26px; background: linear-gradient(90deg,#FF6B9D,#FF8C00,#FFD700,#7FFFD4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height: 1; }
        .hdr-sub { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 3px; }
        .hdr-badges { margin-left: auto; display: flex; gap: 8px; }
        .hdr-badge { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; }
        .hdr-badge.gold { background: linear-gradient(135deg,#FFD700,#FF8C00); color: #2d1b00; }
        .hdr-badge.teal { background: linear-gradient(135deg,#4ECDC4,#2ecc71); color: #0a2d1a; }

        .prog { height: 4px; background: rgba(255,255,255,0.06); }
        .prog-fill { height: 100%; background: linear-gradient(90deg,#FF4080,#FF8C00,#FFD700); transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1); }

        /* HERO SECTION */
        .hero { position: relative; z-index: 5; max-width: 960px; margin: 0 auto; padding: 48px 24px 0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; align-items: end; }
        .hero-center { text-align: center; }
        .hero-title { font-family: 'Fredoka One', cursive; font-size: clamp(32px,5vw,52px); line-height: 1.1; margin-bottom: 12px; }
        .hero-title .line1 { display: block; background: linear-gradient(90deg,#FF6B9D,#FF8C00); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .hero-title .line2 { display: block; background: linear-gradient(90deg,#FFD700,#7FFFD4); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .hero-sub { font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 20px; }
        .hero-pills { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
        .hero-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; border: 1px solid; }
        .hp1 { background: rgba(255,107,157,0.12); border-color: rgba(255,107,157,0.3); color: #FF6B9D; }
        .hp2 { background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.25); color: #FFD700; }
        .hp3 { background: rgba(127,255,212,0.1); border-color: rgba(127,255,212,0.25); color: #7FFFD4; }
        .hero-kid { height: 200px; display: flex; justify-content: center; }
        .hero-kid.left { justify-content: flex-end; padding-right: 16px; }
        .hero-kid.right { justify-content: flex-start; padding-left: 16px; }

        /* EQUIPMENT STRIP */
        .equip-strip { position: relative; z-index: 5; max-width: 960px; margin: 0 auto 0; padding: 0 24px; }
        .equip-inner { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 16px 24px; display: flex; align-items: center; gap: 20px; overflow-x: auto; }
        .equip-item { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; cursor: default; animation: equipbounce var(--d,3s) ease-in-out infinite var(--del,0s); }
        @keyframes equipbounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .equip-icon { font-size: 32px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); }
        .equip-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }

        /* MAIN CONTENT */
        .main { position: relative; z-index: 5; max-width: 720px; margin: 32px auto 0; padding: 0 24px 80px; }

        /* BOOKING CARD */
        .booking-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 28px;
          padding: 40px;
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset;
          position: relative;
          overflow: hidden;
        }
        .booking-card::before {
          content: '';
          position: absolute;
          top: -1px; left: 20%; right: 20%; height: 2px;
          background: linear-gradient(90deg,transparent,#FF6B9D,#FFD700,#7FFFD4,transparent);
          border-radius: 2px;
        }

        .step-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.2); color: #FFD700; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; }
        .step-title { font-family: 'Fredoka One', cursive; font-size: clamp(28px,4vw,38px); line-height: 1.15; margin-bottom: 8px; }
        .step-title span { background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .step-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 28px; line-height: 1.5; }

        /* CALENDAR */
        .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .cal-month-name { font-family: 'Fredoka One', cursive; font-size: 24px; background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .cal-nav { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 38px; height: 38px; border-radius: 12px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-family: 'Nunito',sans-serif; }
        .cal-nav:hover { background: rgba(255,107,157,0.2); border-color: rgba(255,107,157,0.4); transform: scale(1.1); }
        .cal-nav:disabled { opacity: 0.25; cursor: not-allowed; transform: none; }
        .cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; }
        .cal-dow { text-align: center; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.3); padding: 4px 0 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .cal-day { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 14px; transition: all 0.2s; border: 1px solid transparent; cursor: default; position: relative; }
        .cal-day-num { font-size: 15px; font-weight: 800; line-height: 1; }
        .cal-day-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 3px; }
        .cal-day.bookable { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); cursor: pointer; }
        .cal-day.bookable:hover { transform: scale(1.15); box-shadow: 0 8px 24px rgba(255,107,157,0.3); background: rgba(255,107,157,0.15); border-color: rgba(255,107,157,0.5); }
        .cal-day.bookable:hover .cal-day-num { background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .cal-day.bookable .cal-day-dot { background: rgba(255,255,255,0.2); }
        .cal-day.wknd { background: rgba(127,255,212,0.06); border-color: rgba(127,255,212,0.15); }
        .cal-day.wknd .cal-day-num { background: linear-gradient(90deg,#7FFFD4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .cal-day.wknd .cal-day-dot { background: #7FFFD4; }
        .cal-day.wknd:hover { background: rgba(127,255,212,0.15); border-color: rgba(127,255,212,0.5); box-shadow: 0 8px 24px rgba(127,255,212,0.25); }
        .cal-day.selected { background: linear-gradient(135deg,rgba(255,107,157,0.25),rgba(255,215,0,0.15)); border-color: #FF6B9D; transform: scale(1.12); box-shadow: 0 8px 28px rgba(255,107,157,0.35); }
        .cal-day.selected .cal-day-num { background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .cal-day.past, .cal-day.toofar { opacity: 0.15; }
        .cal-day.empty { border: none; background: none; }
        .cal-legend { display: flex; gap: 18px; margin-top: 16px; flex-wrap: wrap; }
        .leg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 700; }
        .leg-sq { width: 12px; height: 12px; border-radius: 4px; }

        /* SLOT CARDS */
        .slot-card { display: flex; align-items: center; gap: 18px; border-radius: 18px; padding: 22px 24px; margin-bottom: 14px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); border: 2px solid transparent; position: relative; overflow: hidden; }
        .slot-card::before { content:''; position:absolute; inset:0; opacity:0; transition:opacity 0.2s; }
        .slot-card.s0 { background: rgba(255,107,157,0.08); border-color: rgba(255,107,157,0.2); }
        .slot-card.s0::before { background: linear-gradient(135deg,rgba(255,107,157,0.15),transparent); }
        .slot-card.s1 { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
        .slot-card.s1::before { background: linear-gradient(135deg,rgba(255,215,0,0.15),transparent); }
        .slot-card.s2 { background: rgba(127,255,212,0.08); border-color: rgba(127,255,212,0.2); }
        .slot-card.s2::before { background: linear-gradient(135deg,rgba(127,255,212,0.15),transparent); }
        .slot-card:hover { transform: translateX(8px) scale(1.02); }
        .slot-card.s0:hover { border-color: #FF6B9D; box-shadow: 0 8px 32px rgba(255,107,157,0.25); }
        .slot-card.s1:hover { border-color: #FFD700; box-shadow: 0 8px 32px rgba(255,215,0,0.25); }
        .slot-card.s2:hover { border-color: #7FFFD4; box-shadow: 0 8px 32px rgba(127,255,212,0.25); }
        .slot-card:hover::before { opacity: 1; }
        .slot-card.blocked { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
        .slot-emoji { font-size: 38px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); animation: slotbounce 2s ease-in-out infinite; }
        @keyframes slotbounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .slot-info h3 { font-family: 'Fredoka One', cursive; font-size: 20px; margin-bottom: 4px; }
        .slot-info p { font-size: 13px; color: rgba(255,255,255,0.5); }
        .slot-arr { margin-left: auto; font-size: 24px; color: rgba(255,255,255,0.2); font-weight: 900; transition: transform 0.2s; }
        .slot-card:hover .slot-arr { transform: translateX(4px); color: rgba(255,255,255,0.6); }

        /* COUNTER */
        .counter-row { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 20px 24px; margin-bottom: 14px; transition: all 0.2s; }
        .counter-row:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); }
        .counter-label h3 { font-family: 'Fredoka One', cursive; font-size: 20px; }
        .counter-label p { font-size: 13px; margin-top: 3px; }
        .counter-ctrl { display: flex; align-items: center; gap: 16px; }
        .cnt-btn { width: 44px; height: 44px; border-radius: 14px; border: 2px solid; cursor: pointer; font-size: 22px; font-weight: 900; display: flex; align-items: center; justify-content: center; transition: all 0.15s cubic-bezier(0.34,1.56,0.64,1); font-family: 'Nunito',sans-serif; }
        .cnt-btn:hover { transform: scale(1.2); }
        .cnt-btn.adult { background: rgba(255,107,157,0.12); border-color: rgba(255,107,157,0.4); color: #FF6B9D; }
        .cnt-btn.adult:hover { background: rgba(255,107,157,0.25); }
        .cnt-btn.child { background: rgba(127,255,212,0.12); border-color: rgba(127,255,212,0.4); color: #7FFFD4; }
        .cnt-btn.child:hover { background: rgba(127,255,212,0.25); }
        .cnt-val { font-family: 'Fredoka One', cursive; font-size: 28px; min-width: 36px; text-align: center; }

        /* TOTAL */
        .total-box { background: linear-gradient(135deg,rgba(255,107,157,0.1),rgba(255,215,0,0.06)); border: 2px solid rgba(255,165,0,0.2); border-radius: 18px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
        .total-label { font-size: 15px; color: rgba(255,255,255,0.6); font-weight: 700; }
        .total-amount { font-family: 'Fredoka One', cursive; font-size: 34px; background: linear-gradient(90deg,#FF6B9D,#FFD700); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

        /* INPUTS */
        .ls-input { display: block; width: 100%; background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px 20px; color: #fff; font-size: 16px; margin-bottom: 14px; font-family: 'Nunito',sans-serif; font-weight: 600; transition: all 0.2s; }
        .ls-input:focus { outline: none; border-color: rgba(255,107,157,0.6); background: rgba(255,255,255,0.08); box-shadow: 0 0 0 4px rgba(255,107,157,0.1); }
        .ls-input::placeholder { color: rgba(255,255,255,0.25); }

        /* SUMMARY */
        .summary { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 20px 24px; margin-bottom: 20px; }
        .summary h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); margin-bottom: 14px; font-weight: 800; }
        .sum-row { display: flex; justify-content: space-between; font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 8px; font-weight: 600; }
        .sum-row.bold { font-weight: 900; color: #fff; font-size: 17px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; margin-top: 4px; }

        /* BUTTONS */
        .btn-primary { display: block; width: 100%; background: linear-gradient(135deg,#FF4080,#FF8C00); color: #fff; border: none; border-radius: 18px; padding: 20px; font-family: 'Fredoka One', cursive; font-size: 20px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); box-shadow: 0 8px 32px rgba(255,64,128,0.35); letter-spacing: 0.02em; }
        .btn-primary:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 14px 48px rgba(255,64,128,0.5); }
        .btn-primary:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }
        .btn-ghost { display: block; width: 100%; background: transparent; color: rgba(255,255,255,0.35); border: none; padding: 14px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Nunito',sans-serif; margin-top: 10px; border-radius: 14px; transition: all 0.2s; }
        .btn-ghost:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); }
        .back-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; font-family: 'Nunito',sans-serif; margin-bottom: 20px; padding: 0; font-weight: 800; display: flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .back-btn:hover { color: rgba(255,255,255,0.8); }

        /* ALERTS */
        .warn { background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.2); color: #FFD700; font-size: 13px; padding: 12px 16px; border-radius: 14px; margin-bottom: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .err { color: #FF6B9D; font-size: 14px; margin-bottom: 14px; padding: 12px 16px; background: rgba(255,107,157,0.08); border-radius: 12px; border: 1px solid rgba(255,107,157,0.2); font-weight: 700; }

        /* PENDING */
        .pending-wrap { text-align: center; padding: 60px 0 20px; }
        .pending-wrap .big { font-size: 90px; margin-bottom: 24px; animation: bigbounce 1.5s ease-in-out infinite; }
        @keyframes bigbounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.05)} }
        .pending-wrap h2 { font-family: 'Fredoka One', cursive; font-size: 34px; margin-bottom: 12px; }
        .pending-wrap p { color: rgba(255,255,255,0.55); font-size: 15px; line-height: 1.7; }
        .dots { display: flex; justify-content: center; gap: 8px; margin-top: 28px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; animation: dotpop 1.2s ease-in-out infinite; }
        .dot1 { background: #FF6B9D; }
        .dot2 { background: #FFD700; animation-delay: 0.2s; }
        .dot3 { background: #7FFFD4; animation-delay: 0.4s; }
        @keyframes dotpop { 0%,100%{opacity:0.2;transform:scale(0.6)} 50%{opacity:1;transform:scale(1.4)} }

        /* SUCCESS */
        .success-wrap { text-align: center; padding: 40px 0 20px; }
        .success-wrap .big { font-size: 90px; margin-bottom: 16px; animation: popin 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes popin { 0%{transform:scale(0) rotate(-10deg)} 100%{transform:scale(1) rotate(0deg)} }
        .success-wrap h2 { font-family: 'Fredoka One', cursive; font-size: 36px; background: linear-gradient(90deg,#7FFFD4,#00bfff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom: 8px; }
        .ref-card { background: rgba(255,215,0,0.08); border: 2px solid rgba(255,215,0,0.25); border-radius: 18px; padding: 18px 24px; margin: 20px 0; text-align: left; }
        .ref-card .rl { font-size: 11px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; font-weight: 800; }
        .ref-card .rv { font-family: 'Fredoka One', cursive; font-size: 28px; color: #FFD700; letter-spacing: 0.1em; }
        .venue-card { margin-top: 20px; padding: 16px; background: rgba(127,255,212,0.04); border: 1px solid rgba(127,255,212,0.12); border-radius: 16px; font-size: 13px; color: rgba(255,255,255,0.4); text-align: center; line-height: 2; font-weight: 600; }

        /* KIDS SCIENCE STRIP at bottom */
        .kids-strip { position: relative; z-index: 5; max-width: 960px; margin: 0 auto; padding: 32px 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .kid-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 20px 16px; text-align: center; transition: all 0.3s; }
        .kid-card:hover { transform: translateY(-6px); }
        .kid-card .kid-img { height: 130px; }
        .kid-card h4 { font-family: 'Fredoka One', cursive; font-size: 16px; margin-top: 10px; }
        .kid-card p { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 4px; line-height: 1.5; }

        @media(max-width:640px){
          .hero { grid-template-columns: 1fr; }
          .hero-kid.left, .hero-kid.right { display: none; }
          .booking-card { padding: 24px 20px; }
          .kids-strip { grid-template-columns: 1fr; }
          .hdr-badges { display: none; }
        }
        @media(max-width:400px){ .cal-day-num{font-size:13px} }
      `}</style>

      <div className="page">
        {/* Glow orbs */}
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />

        {/* Floating science items */}
        <div className="sci-item i1" style={{ '--d': '22s', '--del': '0s', '--r0': '-5deg', '--r1': '5deg', '--r2': '0deg' } as React.CSSProperties}>
          <FloatingAtom />
        </div>
        <div className="sci-item i2" style={{ '--d': '18s', '--del': '-4s' } as React.CSSProperties}>
          <FloatingDNA />
        </div>
        <div className="sci-item i3" style={{ '--d': '28s', '--del': '-9s' } as React.CSSProperties}>
          <FloatingDNA />
        </div>
        <div className="sci-item i4" style={{ '--d': '20s', '--del': '-6s' } as React.CSSProperties}>
          <FloatingAtom />
        </div>
        <div className="sci-item i5" style={{ '--d': '25s', '--del': '-13s' } as React.CSSProperties}>
          <FloatingAtom />
        </div>
        <div className="sci-item i6" style={{ '--d': '16s', '--del': '-3s' } as React.CSSProperties}>
          <FloatingDNA />
        </div>

        {/* Header */}
        <div className="hdr">
          <div className="hdr-inner">
            <div className="hdr-logo">🔬</div>
            <div>
              <div className="hdr-name">Little Scientist</div>
              <div className="hdr-sub">Children's Science Park · Sabaki, Mombasa Road</div>
            </div>
            <div className="hdr-badges">
              <div className="hdr-badge gold">⭐ Award Winning</div>
              <div className="hdr-badge teal">🌍 Global Standard</div>
            </div>
          </div>
          <div className="prog">
            <div
              className="prog-fill"
              style={{ width: step === 'date' ? '8%' : step === 'slot' ? '30%' : step === 'count' ? '55%' : step === 'payment' ? '78%' : '100%' }}
            />
          </div>
        </div>

        {/* Hero */}
        {step === 'date' && (
          <div className="hero">
            <div className="hero-kid left">
              <KidWithMicroscope />
            </div>
            <div className="hero-center">
              <h1 className="hero-title">
                <span className="line1">Discover. Explore.</span>
                <span className="line2">Experiment!</span>
              </h1>
              <p className="hero-sub">
                Where young scientists come alive. Book your adventure at Kenya's premier children's science park.
              </p>
              <div className="hero-pills">
                <div className="hero-pill hp1">🧪 Hands-on Science</div>
                <div className="hero-pill hp2">🚀 Space & Astronomy</div>
                <div className="hero-pill hp3">🌿 Nature Lab</div>
              </div>
            </div>
            <div className="hero-kid right">
              <KidWithRocket />
            </div>
          </div>
        )}

        {/* Equipment strip */}
        {step === 'date' && (
          <div className="equip-strip" style={{ marginTop: 24 }}>
            <div className="equip-inner">
              {[
                { icon: '🔭', label: 'Telescope', d: '2.5s', del: '0s' },
                { icon: '⚗️', label: 'Chemistry', d: '3s', del: '0.3s' },
                { icon: '🧲', label: 'Magnetics', d: '2.8s', del: '0.6s' },
                { icon: '🦠', label: 'Biology', d: '3.2s', del: '0.9s' },
                { icon: '⚡', label: 'Electricity', d: '2.6s', del: '1.2s' },
                { icon: '🌋', label: 'Geology', d: '3.4s', del: '0.4s' },
                { icon: '🧬', label: 'DNA & Genetics', d: '2.9s', del: '0.7s' },
                { icon: '🤖', label: 'Robotics', d: '3.1s', del: '1s' },
                { icon: '🌊', label: 'Oceanography', d: '2.7s', del: '0.2s' },
                { icon: '🌞', label: 'Solar Energy', d: '3.3s', del: '0.5s' },
                { icon: '🧊', label: 'Cryogenics', d: '2.4s', del: '0.8s' },
                { icon: '🎨', label: 'Science Art', d: '3s', del: '1.1s' },
              ].map(({ icon, label, d, del }) => (
                <div className="equip-item" key={label} style={{ '--d': d, '--del': del } as React.CSSProperties}>
                  <div className="equip-icon">{icon}</div>
                  <div className="equip-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main booking area */}
        <div className="main">
          <div className="booking-card">
            {/* DATE */}
            {step === 'date' && (
              <>
                <div className="step-pill">📅 Step 1 of 4</div>
                <h2 className="step-title">
                  Pick your <span>adventure day</span>
                </h2>
                <p className="step-sub">
                  Browse the full month. Weekends glow aqua — they fill up fast! Book up to 30 days ahead, minimum 1 day notice.
                </p>

                <div className="cal-header">
                  <button
                    className="cal-nav"
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
                  <div className="cal-month-name">{monthName}</div>
                  <button
                    className="cal-nav"
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

                <div className="cal-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="cal-dow">
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((day, i) => {
                    if (!day.date) return <div key={`e${i}`} className="cal-day empty" />
                    const dow = day.date.getDay()
                    const isWknd = dow === 0 || dow === 6
                    const isSel = day.dateStr === selectedDate
                    let cls = 'cal-day'
                    if (day.isPast) cls += ' past'
                    else if (day.tooFar) cls += ' toofar'
                    else {
                      cls += ' bookable'
                      if (isWknd) cls += ' wknd'
                      if (isSel) cls += ' selected'
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

                <div className="cal-legend">
                  <div className="leg">
                    <div className="leg-sq" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }} />
                    Available
                  </div>
                  <div className="leg">
                    <div className="leg-sq" style={{ background: 'rgba(127,255,212,0.2)', border: '1px solid rgba(127,255,212,0.3)' }} />
                    Weekend ⭐
                  </div>
                  <div className="leg">
                    <div className="leg-sq" style={{ background: 'rgba(255,255,255,0.04)' }} />
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
                <div className="step-pill">🕙 Step 2 of 4</div>
                <h2 className="step-title">
                  Choose your <span>session time</span>
                </h2>
                <p className="step-sub">
                  {new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })} — pick a time that works for your little scientists!
                </p>

                {(['10:00-12:00', '12:00-14:00', '14:00-16:00'] as const).map((slot, idx) => {
                  const session = sessions.find(s => s.time_slot === slot)
                  const available = session ? session.capacity - session.booked_count : 100
                  const blocked = session?.is_blocked || available <= 0
                  const emojis = ['🌅', '☀️', '🌤️']
                  const colors = ['#FF6B9D', '#FFD700', '#7FFFD4']
                  return (
                    <div
                      key={slot}
                      className={`slot-card s${idx}${blocked ? ' blocked' : ''}`}
                      onClick={() => {
                        if (!blocked) {
                          setSelectedSession(session || null)
                          setStep('count')
                        }
                      }}
                    >
                      <div className="slot-emoji" style={{ animationDelay: `${idx * 0.3}s` }}>
                        {emojis[idx]}
                      </div>
                      <div className="slot-info">
                        <h3 style={{ color: colors[idx] }}>{SLOT_LABELS[slot]}</h3>
                        <p>{blocked ? '🔴 Full / Unavailable' : `🟢 ${available} spots remaining`}</p>
                      </div>
                      {!blocked && (
                        <div className="slot-arr" style={{ color: colors[idx] }}>
                          ›
                        </div>
                      )}
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
                <div className="step-pill">👨‍👩‍👧 Step 3 of 4</div>
                <h2 className="step-title">
                  Who&apos;s <span>coming along?</span>
                </h2>
                <div className="warn">⚠️ Every booking needs at least 1 adult AND 1 child</div>

                <div className="counter-row">
                  <div className="counter-label">
                    <h3>🧑 Adults</h3>
                    <p style={{ color: '#FF6B9D' }}>KES {ADULT_PRICE.toLocaleString()} per person</p>
                  </div>
                  <div className="counter-ctrl">
                    <button className="cnt-btn adult" onClick={() => setAdults(Math.max(1, adults - 1))}>
                      −
                    </button>
                    <span className="cnt-val">{adults}</span>
                    <button className="cnt-btn adult" onClick={() => setAdults(adults + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="counter-row">
                  <div className="counter-label">
                    <h3>👧 Children</h3>
                    <p style={{ color: '#7FFFD4' }}>KES {CHILD_PRICE.toLocaleString()} per person</p>
                  </div>
                  <div className="counter-ctrl">
                    <button className="cnt-btn child" onClick={() => setChildren(Math.max(1, children - 1))}>
                      −
                    </button>
                    <span className="cnt-val">{children}</span>
                    <button className="cnt-btn child" onClick={() => setChildren(children + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="total-box">
                  <div className="total-label">Total to pay</div>
                  <div className="total-amount">KES {total.toLocaleString()}</div>
                </div>

                <button className="btn-primary" onClick={() => setStep('payment')}>
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
                <div className="step-pill">💳 Step 4 of 4</div>
                <h2 className="step-title">
                  Pay via <span>M-Pesa</span>
                </h2>
                <p className="step-sub">You will receive a payment prompt on your phone. Enter your PIN to confirm.</p>

                <input className="ls-input" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input
                  className="ls-input"
                  placeholder="M-Pesa number e.g. 0700 101 425"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  type="tel"
                />

                <div className="summary">
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

                {error && <div className="err">{error}</div>}
                <button className="btn-primary" onClick={handlePayment} disabled={loading}>
                  {loading ? '🔄 Sending M-Pesa prompt...' : `🔬 Pay KES ${total.toLocaleString()} now →`}
                </button>
                <button className="btn-ghost" onClick={() => setStep('count')}>
                  ← Change visitors
                </button>
              </>
            )}

            {/* PENDING */}
            {step === 'pending' && (
              <div className="pending-wrap">
                <div className="big">📱</div>
                <h2>Check your phone!</h2>
                <p>
                  M-Pesa prompt sent to
                  <br />
                  <strong style={{ color: '#FFD700', fontSize: 18 }}>{phone}</strong>
                </p>
                <p style={{ marginTop: 12 }}>
                  Enter your PIN to confirm
                  <br />
                  <strong style={{ color: '#FF6B9D', fontSize: 22 }}>KES {total.toLocaleString()}</strong>
                </p>
                <div className="dots">
                  <span className="dot dot1" />
                  <span className="dot dot2" />
                  <span className="dot dot3" />
                </div>
                <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Waiting for confirmation...</p>
              </div>
            )}

            {/* SUCCESS */}
            {step === 'success' && (
              <div className="success-wrap">
                <div className="big">🎉</div>
                <h2>You are all set!</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)' }}>Booking confirmed! Your QR tickets are ready.</p>
                <div className="ref-card">
                  <div className="rl">Booking reference</div>
                  <div className="rv">{bookingRef}</div>
                </div>
                <div className="summary" style={{ textAlign: 'left' }}>
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
                <a href={`/ticket/${bookingRef}`} className="btn-primary" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                  🎟️ View tickets and QR codes →
                </a>
                <div className="venue-card">📍 Sabaki Estate, Mombasa Road &nbsp;·&nbsp; 📞 Dr. Syokau Ilovi &nbsp;·&nbsp; 0700 101 425</div>
              </div>
            )}
          </div>
        </div>

        {/* Kids science strip at bottom */}
        {(step === 'date' || step === 'success') && (
          <div className="kids-strip">
            <div className="kid-card">
              <div className="kid-img">
                <KidWithMicroscope />
              </div>
              <h4 style={{ color: '#FF6B9D' }}>Microscopy Lab</h4>
              <p>Discover the invisible world — cells, bacteria, and tiny wonders await!</p>
            </div>
            <div className="kid-card">
              <div className="kid-img">
                <KidWithBeaker />
              </div>
              <h4 style={{ color: '#4ECDC4' }}>Chemistry Zone</h4>
              <p>Mix, react, and explode! Safe and colourful chemistry experiments for all ages.</p>
            </div>
            <div className="kid-card">
              <div className="kid-img">
                <KidWithRocket />
              </div>
              <h4 style={{ color: '#FF8C42' }}>Space & Rockets</h4>
              <p>Build and launch! Explore astronomy, space travel, and the universe above.</p>
            </div>
          </div>
        )}

        {/* Bottom equipment strip */}
        {step === 'date' && (
          <div style={{ maxWidth: 960, margin: '0 auto 48px', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
              {[
                { icon: '🧪', title: '50+ Experiments', sub: 'New ones every visit' },
                { icon: '👨‍🔬', title: 'Expert Guides', sub: 'Trained science educators' },
                { icon: '🏆', title: 'Award Winning', sub: 'Best kids attraction 2024' },
                { icon: '🌍', title: 'Global Standards', sub: 'World-class safety & fun' },
                { icon: '📱', title: 'Cashless Entry', sub: 'M-Pesa powered' },
                { icon: '✅', title: 'All Ages Welcome', sub: 'From 3 to 16 years' },
              ].map(({ icon, title, sub }) => (
                <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: 15, marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

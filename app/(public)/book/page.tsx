'use client'
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { sessionOpenSpots } from '@/lib/session-capacity'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { computeBasket, BIRTHDAY_PRICING, BIRTHDAY_FOOD_NOTICE, type PriceTier } from '@/lib/pricing'
import { validatePaidCheckout, type PartyValidation } from '@/lib/booking-party'
import { parseVisitType, visitTypeLabel, type VisitType } from '@/lib/visit-type'
import {
  SegmentedTwo,
  FieldLabel,
  bookFieldStyle,
  TermsBoxes,
  EnquirySuccess,
  DirectReachOut,
} from './VisitTypeUi'
import Disclaimers from '@/components/portal/Disclaimers'
import TermsGate from '@/components/portal/TermsGate'
import WatermarkBg from '@/components/portal/WatermarkBg'

const DEFAULT_PRICING = {
  adult18PlusKes: 1000,
  child95cmTo17Kes: 800,
  childUnder95cmKes: 0,
} as const

type Pricing = {
  adult18PlusKes: number
  child95cmTo17Kes: number
  childUnder95cmKes: number
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
const MIN_DAYS = 0
const MAX_DAYS = 12

const BOOKABLE_SLOTS = [
  '09:00-11:00',
  '10:00-12:00',
  '11:00-13:00',
  '12:00-14:00',
  '13:00-15:00',
  '14:00-16:00',
  '15:00-17:00',
] as const

type Session = {
  id: string
  session_date: string
  time_slot: string
  capacity: number
  booked_count: number
  held_count?: number
  is_blocked: boolean
}
type Step = 'date' | 'slot' | 'count' | 'payment' | 'pending' | 'success'

/** Maps internal steps to 3 user-facing phases (Date & Time → Visitors & Pay → Confirmed). */
function bookingPhaseIndex(step: Step): 0 | 1 | 2 {
  if (step === 'date' || step === 'slot') return 0
  if (step === 'count' || step === 'payment' || step === 'pending') return 1
  return 2
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function slotStartMinutes(timeSlot: string): number {
  const [start] = String(timeSlot || '').split('-')
  const [hh, mm] = String(start || '').split(':')
  const h = Number(hh)
  const m = Number(mm)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN
  return h * 60 + m
}

const LAST_SLOT_START_MINUTES = Math.max(...BOOKABLE_SLOTS.map(slotStartMinutes).filter(Number.isFinite))

/** True if this calendar date still has at least one bookable start time left. */
function dateHasRemainingSlots(dateStr: string, now = new Date()): boolean {
  const todayKey = toLocalDateKey(now)
  if (dateStr !== todayKey) return true
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes < LAST_SLOT_START_MINUTES
}


export default function BookPage() {
  const router = useRouter()
  const [visitType, setVisitTypeState] = useState<VisitType>('general')
  const [step, setStep] = useState<Step>('date')
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [adults, setAdults] = useState(1)
  const [childrenPaid, setChildrenPaid] = useState(1)
  const [childrenFreeUnder95, setChildrenFreeUnder95] = useState(0)
  const counterSectionRef = useRef<HTMLDivElement | null>(null)
  const sessionCacheRef = useRef<Record<string, Session[]>>({})
  const [partyModal, setPartyModal] = useState<Extract<PartyValidation, { ok: false }> | null>(null)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [termsRead, setTermsRead] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  // Birthday contact (parent / guardian)
  const [sessionMode, setSessionMode] = useState<'shared' | 'exclusive'>('shared')
  const [birthdayEmail, setBirthdayEmail] = useState('')
  const [partyNotes, setPartyNotes] = useState('')

  // School
  const [schoolName, setSchoolName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [studentCount, setStudentCount] = useState(20)
  const [staffCount, setStaffCount] = useState(2)

  // Enquiry outcome inside /book
  const [enquiryDone, setEnquiryDone] = useState(false)
  const [enquiryRef, setEnquiryRef] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const next = parseVisitType(params.get('type'))
    if (next === 'birthday') {
      router.replace('/birthdays')
      return
    }
    if (next === 'school') {
      router.replace('/schools')
      return
    }
    setVisitTypeState(next)
  }, [router])

  function setVisitType(next: VisitType) {
    if (next === visitType) return
    setVisitTypeState(next)
    setSessionMode('shared')
    setEnquiryDone(false)
    setEnquiryRef('')
    setError('')
    setTermsRead(false)
    setTermsConsent(false)
    // Keep date/slot; reset only type-specific fields
    setBirthdayEmail('')
    setPartyNotes('')
    setSchoolName('')
    setContactEmail('')
    setStudentCount(20)
    setStaffCount(2)
    if (next === 'school') {
      setAdults(2)
      setChildrenPaid(20)
      setChildrenFreeUnder95(0)
    } else if (next === 'birthday') {
      setAdults(1)
      setChildrenPaid(1)
      setChildrenFreeUnder95(0)
    } else {
      setAdults(1)
      setChildrenPaid(1)
      setChildrenFreeUnder95(0)
    }
    if (step === 'payment' || step === 'pending' || step === 'success') setStep(selectedSession ? 'count' : selectedDate ? 'slot' : 'date')
    const url = next === 'general' ? '/book' : `/book?type=${next}`
    router.replace(url, { scroll: false })
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase.from('pricing_tiers').select('key, price_kes, active').eq('active', true)
        if (!alive) return
        const tiers = (data || []) as { key: string; price_kes: number; active: boolean }[]
        const adult = tiers.find(t => t.key === 'adult')?.price_kes
        const child = tiers.find(t => t.key === 'child')?.price_kes
        const infant = tiers.find(t => t.key === 'infant')?.price_kes
        setPricing({
          adult18PlusKes: typeof adult === 'number' ? adult : DEFAULT_PRICING.adult18PlusKes,
          child95cmTo17Kes: typeof child === 'number' ? child : DEFAULT_PRICING.child95cmTo17Kes,
          childUnder95cmKes: typeof infant === 'number' ? infant : DEFAULT_PRICING.childUnder95cmKes,
        })
      } catch {}
    })()
    return () => {
      alive = false
    }
  }, [])

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
    const now = new Date()
    const days: {
      date: Date | null
      dateStr: string
      bookable: boolean
      isPast: boolean
      tooFar: boolean
      isWeekend: boolean
    }[] = []
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: null, dateStr: '', bookable: false, isPast: false, tooFar: false, isWeekend: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dateStr = toLocalDateKey(date)
      const dow = date.getDay()
      const isWeekend = dow === 0 || dow === 6
      const isPast = date < minDate
      const tooFar = date > maxDate
      const withinWindow = !isPast && !tooFar
      const bookable = withinWindow && dateHasRemainingSlots(dateStr, now)
      days.push({
        date,
        dateStr,
        bookable,
        isPast,
        tooFar,
        isWeekend,
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

  async function loadSessionsForDate(dateStr: string): Promise<Session[]> {
    const cached = sessionCacheRef.current[dateStr]
    if (cached && cached.length >= BOOKABLE_SLOTS.length) return cached

    // Fast path: read existing rows from Supabase (no server ensure round-trip).
    const { data } = await supabase
      .from('sessions')
      .select('id, session_date, time_slot, capacity, booked_count, held_count, is_blocked')
      .eq('session_date', dateStr)
    let rows = (data || []) as Session[]
    const found = new Set(rows.map(r => r.time_slot))
    const missing = BOOKABLE_SLOTS.filter(s => !found.has(s))

    if (missing.length === 0 && rows.length >= BOOKABLE_SLOTS.length) {
      sessionCacheRef.current[dateStr] = rows
      return rows
    }

    // Slow path only when slots for that day are not seeded yet.
    const res = await fetch('/api/sessions/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDate: dateStr }),
    })
    const payload = await res.json().catch(() => null)
    rows = (payload?.sessions || rows) as Session[]
    if (!Array.isArray(rows) || rows.length === 0) {
      const { data: data2 } = await supabase
        .from('sessions')
        .select('id, session_date, time_slot, capacity, booked_count, held_count, is_blocked')
        .eq('session_date', dateStr)
      rows = (data2 || []) as Session[]
    }

    sessionCacheRef.current[dateStr] = rows
    return rows
  }

  // Prefetch the whole booking window so date clicks feel instant.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dates: string[] = []
      for (let i = MIN_DAYS; i <= MAX_DAYS; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        const key = toLocalDateKey(d)
        if (dateHasRemainingSlots(key, new Date())) dates.push(key)
      }
      if (dates.length === 0) return

      try {
        // One range query first — usually enough after days are seeded.
        const { data } = await supabase
          .from('sessions')
          .select('id, session_date, time_slot, capacity, booked_count, held_count, is_blocked')
          .gte('session_date', dates[0])
          .lte('session_date', dates[dates.length - 1])

        if (!alive) return
        const byDate: Record<string, Session[]> = {}
        for (const row of (data || []) as Session[]) {
          const key = row.session_date
          if (!byDate[key]) byDate[key] = []
          byDate[key].push(row)
        }
        for (const [dateKey, rows] of Object.entries(byDate)) {
          if (rows.length >= BOOKABLE_SLOTS.length) sessionCacheRef.current[dateKey] = rows
        }

        const needEnsure = dates.filter(d => {
          const rows = sessionCacheRef.current[d]
          return !(rows && rows.length >= BOOKABLE_SLOTS.length)
        })
        if (needEnsure.length === 0) return

        const res = await fetch('/api/sessions/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionDates: needEnsure }),
        })
        const payload = await res.json().catch(() => null)
        if (!alive || !payload?.byDate) return
        for (const [dateKey, rows] of Object.entries(payload.byDate as Record<string, Session[]>)) {
          sessionCacheRef.current[dateKey] = rows
        }
      } catch {
        /* ignore prefetch errors — single-date load still works */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const pollStatus = useCallback(() => {
    if (!bookingRef) return
    const iv = setInterval(async () => {
      const { data } = await supabase.from('bookings').select('payment_status').eq('booking_ref', bookingRef).single()
      if (data?.payment_status === 'paid') {
        clearInterval(iv)
        window.location.href = `/ticket/${bookingRef}`
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

  const activePricing: Pricing =
    visitType === 'birthday'
      ? {
          adult18PlusKes: BIRTHDAY_PRICING.adult18PlusKes,
          child95cmTo17Kes: BIRTHDAY_PRICING.child95cmTo17Kes,
          childUnder95cmKes: BIRTHDAY_PRICING.childUnder95cmKes,
        }
      : pricing

  const total =
    adults * activePricing.adult18PlusKes +
    childrenPaid * activePricing.child95cmTo17Kes +
    (visitType === 'birthday' ? childrenFreeUnder95 * activePricing.childUnder95cmKes : 0)
  const spotsLeft = selectedSession ? sessionOpenSpots(selectedSession) : 0
  const schoolHeadcount = Math.max(0, studentCount) + Math.max(0, staffCount)
  const schoolTooLarge = visitType === 'school' && schoolHeadcount > spotsLeft
  /** Birthday & school use dedicated enquiry pages; keep enquiry path for any residual in-wizard use. */
  const needsEnquiry: boolean =
    visitType === 'birthday' || visitType === 'school' || sessionMode === 'exclusive' || schoolTooLarge

  const tiersForBasket: PriceTier[] = [
    {
      key: 'adult',
      label: 'Adults (18+)',
      sublabel: '18 years and above',
      priceInclVat: activePricing.adult18PlusKes,
      free: false,
    },
    {
      key: 'child',
      label: 'Children (95cm – 17 yrs)',
      sublabel: '95cm height to 17 years',
      priceInclVat: activePricing.child95cmTo17Kes,
      free: false,
    },
    {
      key: 'infant',
      label: '94.9 cm and below',
      sublabel:
        visitType === 'birthday'
          ? 'Children 94.9cm and below — birthday rate'
          : 'Children 94.9cm and below — FREE entry',
      priceInclVat: visitType === 'birthday' ? activePricing.childUnder95cmKes : 0,
      free: visitType !== 'birthday',
    },
  ]
  const basket = computeBasket(
    adults,
    childrenPaid,
    tiersForBasket,
    visitType === 'birthday' ? childrenFreeUnder95 : 0,
  )
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  })

  async function pickDate(dateStr: string) {
    setSelectedDate(dateStr)
    setSelectedSession(null)
    setError('')
    setSlotsLoading(true)
    setSessions([])
    setStep('slot')
    try {
      const rows = await loadSessionsForDate(dateStr)
      setSessions(rows)
    } catch {
      setError('Could not load session times. Please try again.')
    } finally {
      setSlotsLoading(false)
    }
  }

  async function handlePayment() {
    setError('')
    if (!termsRead) {
      setError('Please read and accept the Terms and Conditions to continue.')
      return
    }
    if (!phone || phone.replace(/\s/g, '').length < 9) {
      setError('Enter a valid M-Pesa phone number')
      return
    }
    setLoading(true)
    try {
      const sessionId = selectedSession?.id
      const adultCount = visitType === 'school' ? staffCount : adults
      const childCount = visitType === 'school' ? studentCount : childrenPaid
      const infantCount = visitType === 'school' ? 0 : childrenFreeUnder95
      const payTotal =
        adultCount * activePricing.adult18PlusKes +
        childCount * activePricing.child95cmTo17Kes +
        (visitType === 'birthday' ? infantCount * activePricing.childUnder95cmKes : 0)

      const partyCheck = validatePaidCheckout(
        { adults: adultCount, children: childCount, infants: infantCount },
        payTotal,
      )
      if (!partyCheck.ok) {
        setPartyModal(partyCheck)
        setLoading(false)
        return
      }

      if (visitType === 'birthday') {
        if (!name.trim()) {
          setError('Enter the parent / guardian name.')
          setLoading(false)
          return
        }
        if (!birthdayEmail.trim() || !birthdayEmail.includes('@')) {
          setError('Enter a valid parent / guardian email.')
          setLoading(false)
          return
        }
      }

      const bookerName =
        visitType === 'school' ? name || schoolName : visitType === 'birthday' ? name : name

      const partyMeta =
        visitType === 'birthday'
          ? {
              guardianName: name,
              email: birthdayEmail.trim(),
              phone,
              notes: partyNotes || null,
              sessionMode: 'shared',
            }
          : visitType === 'school'
            ? {
                schoolName,
                contactEmail: contactEmail || null,
                studentCount,
                staffCount,
                notes: partyNotes || null,
                sessionMode: 'shared',
              }
            : null

      const res = await fetch('/api/mpesa/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          phone,
          name: bookerName,
          email: visitType === 'birthday' ? birthdayEmail.trim() : undefined,
          adultCount,
          childCount,
          infantCount,
          bookingKind: visitType,
          partyMeta,
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

  const phase = bookingPhaseIndex(step)

  function closeModals() {
    setPartyModal(null)
  }

  function syncSchoolCounts(nextStudents: number, nextStaff: number) {
    setStudentCount(nextStudents)
    setStaffCount(nextStaff)
    setChildrenPaid(Math.max(0, nextStudents))
    setAdults(Math.max(0, nextStaff))
    setChildrenFreeUnder95(0)
  }

  function proceedFromCountersToPayment() {
    closeModals()
    setError('')

    if (needsEnquiry) {
      void submitEnquiry()
      return
    }

    const payTotal =
      adults * activePricing.adult18PlusKes +
      childrenPaid * activePricing.child95cmTo17Kes

    const partyCheck = validatePaidCheckout(
      { adults, children: childrenPaid, infants: childrenFreeUnder95 },
      payTotal,
    )
    if (!partyCheck.ok) {
      setPartyModal(partyCheck)
      return
    }

    setStep('payment')
  }

  async function submitEnquiry() {
    setError('')
    if (!termsRead) {
      setError('Please read and accept the Terms and Conditions to continue.')
      return
    }
    setLoading(true)
    try {
      if (visitType === 'birthday') {
        if (!name.trim() || !phone.trim() || !birthdayEmail.trim() || !selectedDate) {
          throw new Error('Please fill in parent / guardian name, phone, email, and date.')
        }
        const guestCount = Math.max(1, adults + childrenPaid + childrenFreeUnder95)
        const res = await fetch('/api/birthdays/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentName: name,
            phone,
            email: birthdayEmail.trim(),
            guestCount,
            preferredDate: selectedDate,
            sessionPreference: sessionMode === 'exclusive' ? 'exclusive' : 'non-exclusive',
            specialRequirements: [
              `Children: ${childrenPaid + childrenFreeUnder95}`,
              `Adults: ${adults}`,
              partyNotes,
            ]
              .filter(Boolean)
              .join('\n'),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to submit enquiry')
        setEnquiryRef(String(data.enquiryRef || ''))
        setEnquiryDone(true)
        setStep('success')
        return
      }

      if (visitType === 'school') {
        if (!schoolName.trim() || !name.trim() || !phone.trim() || !contactEmail.trim() || !selectedDate) {
          throw new Error('Please fill in school name, contact details, email, phone, and date.')
        }
        if (studentCount < 20) throw new Error('School trips need at least 20 students.')
        const res = await fetch('/api/schools/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolName,
            contactName: name,
            contactPhone: phone,
            contactEmail,
            studentCount,
            preferredDate: selectedDate,
            sessionType: sessionMode === 'exclusive' ? 'exclusive' : 'non-exclusive',
            specialRequirements: [`Adults / staff: ${staffCount}`, partyNotes].filter(Boolean).join('\n'),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to submit enquiry')
        setEnquiryRef(String(data.enquiryRef || ''))
        setEnquiryDone(true)
        setStep('success')
        return
      }

      throw new Error('Enquiry is only available for birthday and school trips.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function acknowledgePartyModal() {
    setPartyModal(null)
    scrollToCounters()
  }

  function scrollToCounters() {
    counterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #08122e; overflow-x: hidden; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .page {
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: rgba(255,255,255,0.85);
          line-height: 1.65;
          background: #08122e;
          position: relative;
          overflow: hidden;
        }

        /* ── BLOBS ── */
        .blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; filter: blur(90px); }
        .b1 { width: 380px; height: 380px; background: rgba(168,100,255,0.1); top: -80px; right: -80px; animation: bd 22s ease-in-out infinite; }
        .b2 { width: 300px; height: 300px; background: rgba(78,205,196,0.09); bottom: 0; left: -70px; animation: bd 28s ease-in-out infinite -10s; }
        .b3 { width: 250px; height: 250px; background: rgba(255,107,157,0.07); top: 40%; right: -50px; animation: bd 24s ease-in-out infinite -6s; }
        @keyframes bd { 0%,100%{transform:translate(0,0)} 50%{transform:translate(35px,-45px)} }

        .prog-bar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

        /* ── OUTER ── */
        .outer { max-width: 860px; margin: 0 auto; padding: 32px 24px 60px; position: relative; z-index: 5; }

        @keyframes sdp { 0%,100%{opacity:1} 50%{opacity:0.6} }

        /* ── STEP PILL ── */
        .spill { display: inline-flex; align-items: center; gap: 8px; background: rgba(46,142,255,0.13); border: 1px solid rgba(46,142,255,0.28); color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 999px; margin-bottom: 18px; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* ── STEP TITLE ── */
        .stitle { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 28px; line-height: 1.15; margin-bottom: 8px; color: #fff; }
        .stitle span { color: #fff; }
        .ssub { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 24px; line-height: 1.65; max-width: 600px; }

        /* ── BOOKING CARD ── */
        .bcard {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 28px 28px;
          position: relative;
          overflow: hidden;
        }
        .bcard::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(255,255,255,0.06), transparent 40%); }

        /* ── CALENDAR ── */
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .cal-mth { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 22px; color: #2e8eff; }
        .cal-btn { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); font-size: 18px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .cal-btn:hover { border-color: rgba(46,142,255,0.75); box-shadow: 0 0 0 3px rgba(46,142,255,0.18); }
        .cal-btn:disabled { opacity: 0.2; cursor: not-allowed; transform: none; }
        .dow-row { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; margin-bottom: 8px; }
        .dow { text-align: center; font-size: 10px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; color: rgba(255,255,255,0.45); padding: 4px 0 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .days-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 8px; }

        /* DAY CELLS */
        .day { aspect-ratio: 1; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid transparent; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease; position: relative; cursor: default; }
        .day-num { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.01em; font-size: 17px; line-height: 1; color: rgba(255,255,255,0.85); }
        .day-dots { display:flex; gap:6px; margin-top: 6px; align-items:center; min-height: 8px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; }
        .dot-avail { background: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.22); }
        .dot-wknd { background: #00c8a0; }

        /* Unavailable — past / too far / no slots left today */
        .day.unavail {
          opacity: 0.28;
          background: rgba(255,255,255,0.03);
          border-color: transparent;
          cursor: not-allowed;
        }
        .day.unavail .day-num { color: rgba(255,255,255,0.45); }

        /* Available weekday */
        .day.avail {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.18);
          cursor: pointer;
        }
        .day.avail .day-num { color: #fff; }
        .day.avail:hover {
          border-color: rgba(255,255,255,0.45);
          transform: translateY(-2px);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
        }

        /* Available weekend */
        .day.wknd {
          background: rgba(0,200,160,0.08);
          border-color: rgba(0,200,160,0.35);
          cursor: pointer;
        }
        .day.wknd .day-num { color: #fff; }
        .day.wknd:hover {
          border-color: rgba(0,200,160,0.7);
          transform: translateY(-2px);
          box-shadow: 0 0 0 3px rgba(0,200,160,0.15);
        }

        /* Selected */
        .day.sel {
          background: #FFD94A;
          border-color: rgba(255,217,74,0.65);
          transform: translateY(-1px);
          box-shadow: 0 0 18px rgba(255,217,74,0.22);
          cursor: pointer;
        }
        .day.sel .day-num { color: #08122e; }
        .day.sel .dot-avail { background: #08122e; box-shadow: none; }
        .day.sel .dot-wknd { background: #08122e; }

        /* Calendar legend */
        .cal-leg { display: flex; gap: 18px; margin-top: 18px; flex-wrap: wrap; }
        .leg { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 600; font-family:'Plus Jakarta Sans',sans-serif; }
        .leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .leg-dot.avail-dot { background: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.22); }
        .leg-dot.wknd-dot { background: #00c8a0; }
        .leg-unavail-swatch { width: 12px; height: 12px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); flex-shrink: 0; opacity: 0.55; }

        /* ── SESSION SLOTS ── */
        .slots { display: flex; flex-direction: column; gap: 14px; }
        .slot { display: flex; align-items: center; gap: 20px; padding: 24px 28px; border-radius: 22px; border: 2px solid transparent; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .slot.s0 { background: rgba(255,107,157,0.08); border-color: rgba(255,107,157,0.2); }
        .slot.s1 { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
        .slot.s2 { background: rgba(127,255,212,0.08); border-color: rgba(127,255,212,0.2); }
        .slot.s0:hover { border-color: #FF6B9D; box-shadow: 0 10px 40px rgba(255,107,157,0.3); transform: translateX(10px) scale(1.02); }
        .slot.s1:hover { border-color: #FFD94A; box-shadow: 0 12px 44px rgba(255,217,74,0.26); transform: translateX(10px) scale(1.02); }
        .slot.s2:hover { border-color: #7FFFD4; box-shadow: 0 10px 40px rgba(127,255,212,0.3); transform: translateX(10px) scale(1.02); }
        .slot.blocked { opacity: 0.3; cursor: not-allowed; pointer-events: none; }
        .slot-emoji { font-size: 42px; animation: se var(--sd,2.5s) ease-in-out infinite; }
        @keyframes se { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-8px) rotate(3deg)} }
        .slot-label h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.01em; font-size: 20px; margin-bottom: 5px; color: #fff; }
        .slot-label p { font-size: 13px; color: rgba(255,255,255,0.48); }
        .slot-spots { margin-left: auto; text-align: right; }
        .slot-spots-num { font-family: 'DM Mono', monospace; font-weight: 500; font-size: 20px; color: rgba(255,255,255,0.85); }
        .slot-spots-lbl { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .slot-arr { font-size: 26px; font-weight: 900; opacity: 0.25; margin-left: 12px; transition: all 0.2s; }
        .slot:hover .slot-arr { opacity: 0.8; transform: translateX(6px); }

        /* ── VISITOR COUNTER ── */
        .ctr { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.09); border-radius: 22px; padding: 22px 28px; margin-bottom: 14px; transition: all 0.2s; }
        .ctr:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }
        .ctr-info h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; letter-spacing: -0.01em; font-size: 20px; margin-bottom: 5px; color: #fff; }
        .ctr-info p { font-size: 14px; font-weight: 700; margin-top: 0; }
        .ctr-ctrl { display: flex; align-items: center; gap: 18px; }
        .ctr-btn { width: 52px; height: 52px; border-radius: 16px; border: 2px solid; font-size: 28px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s cubic-bezier(0.34,1.56,0.64,1); font-family: 'Plus Jakarta Sans', sans-serif; }
        .ctr-btn:hover { transform: scale(1.28); }
        .ba { background: rgba(255,107,157,0.12); border-color: rgba(255,107,157,0.45); color: #FF6B9D; }
        .ba:hover { background: rgba(255,107,157,0.28); }
        .bc { background: rgba(127,255,212,0.12); border-color: rgba(127,255,212,0.45); color: #7FFFD4; }
        .bc:hover { background: rgba(127,255,212,0.28); }
        .ctr-val { font-family: 'DM Mono', monospace; font-weight: 500; font-size: 30px; min-width: 44px; text-align: center; color: rgba(255,255,255,0.90); }

        /* Total */
        .total { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg,rgba(255,107,157,0.1),rgba(255,215,0,0.07)); border: 2px solid rgba(255,165,0,0.22); border-radius: 22px; padding: 20px 28px; margin: 20px 0 28px; }
        .total-lbl { font-size: 15px; color: rgba(255,255,255,0.58); font-weight: 700; }
        .total-val { font-family: 'DM Mono', monospace; font-weight: 500; font-size: 34px; background: linear-gradient(90deg,#FFD94A,#FFC107); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        /* ── INPUTS ── */
        .inp { display: block; width: 100%; background: rgba(255,255,255,0.07); border: 2px solid rgba(255,255,255,0.11); border-radius: 18px; padding: 18px 22px; color: rgba(255,255,255,0.90); font-size: 15px; margin-bottom: 16px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; transition: all 0.2s; line-height: 1.65; }
        .inp::placeholder { color: rgba(255,255,255,0.35); }
        .inp:focus { outline: none; border-color: rgba(255,107,157,0.65); background: rgba(255,255,255,0.1); box-shadow: 0 0 0 5px rgba(255,107,157,0.12); }
        .inp::placeholder { color: rgba(255,255,255,0.25); }

        /* ── SUMMARY ── */
        .sum { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 24px 28px; margin-bottom: 22px; }
        .sum h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); margin-bottom: 16px; font-weight: 800; }
        .sum-row { display: flex; justify-content: space-between; font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 10px; font-weight: 600; }
        .sum-row.b { font-weight: 900; color: #fff; font-size: 18px; border-top: 1px solid rgba(255,255,255,0.09); padding-top: 14px; margin-top: 6px; }

        /* ── BUTTONS ── */
        .btn-go { display: block; width: 100%; background: linear-gradient(135deg,#FFD94A,#FFC107); color: #08122e; border: none; border-radius: 20px; padding: 22px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1); box-shadow: 0 10px 38px rgba(255,217,74,0.22); letter-spacing: 0.01em; text-align: center; text-decoration: none; }
        .btn-go:hover { transform: translateY(-4px) scale(1.02); filter: brightness(1.03); box-shadow: 0 16px 56px rgba(255,217,74,0.28); }
        .btn-go:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }
        .btn-back { background: none; border: none; color: rgba(255,255,255,0.55); cursor: pointer; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 24px; padding: 0; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .btn-back:hover { color: rgba(255,255,255,0.75); }
        .btn-ghost { display: block; width: 100%; background: transparent; color: rgba(255,255,255,0.55); border: none; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; margin-top: 12px; border-radius: 16px; transition: all 0.2s; line-height: 1.65; }
        .btn-ghost:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); }

        /* ── WARN / ERR ── */
        .warn { background: rgba(255,217,74,0.07); border: 1px solid rgba(255,217,74,0.22); color: #FFD94A; font-size: 14px; padding: 14px 20px; border-radius: 16px; margin-bottom: 24px; font-weight: 700; line-height: 1.5; }
        .err { color: #FF6B9D; font-size: 15px; margin-bottom: 16px; padding: 14px 20px; background: rgba(255,107,157,0.08); border-radius: 14px; border: 1px solid rgba(255,107,157,0.22); font-weight: 700; }

        /* ── PENDING ── */
        .pend { text-align: center; padding: 60px 0 20px; }
        .pend .big { font-size: 96px; margin-bottom: 24px; animation: bp 1.5s ease-in-out infinite; }
        @keyframes bp { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.07)} }
        .pend h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 34px; margin-bottom: 14px; color: #fff; }
        .pend p { color: rgba(255,255,255,0.52); font-size: 16px; line-height: 1.7; }
        .dots { display: flex; justify-content: center; gap: 10px; margin-top: 30px; }
        .dot { width: 12px; height: 12px; border-radius: 50%; animation: dp 1.2s ease-in-out infinite; }
        .d1 { background: #FF6B9D; }
        .d2 { background: #FFD94A; animation-delay: 0.2s; }
        .d3 { background: #7FFFD4; animation-delay: 0.4s; }
        @keyframes dp { 0%,100%{opacity:0.2;transform:scale(0.6)} 50%{opacity:1;transform:scale(1.5)} }

        /* ── SUCCESS ── */
        .succ { text-align: center; padding: 40px 0 20px; }
        .succ .big { font-size: 96px; margin-bottom: 16px; animation: pop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes pop { 0%{transform:scale(0) rotate(-15deg)} 100%{transform:scale(1) rotate(0)} }
        .succ h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 38px; color: #fff; margin-bottom: 10px; }
        .ref-card { background: rgba(255,215,0,0.08); border: 2px solid rgba(255,215,0,0.28); border-radius: 20px; padding: 20px 28px; margin: 22px 0; text-align: left; }
        .ref-card .rl { font-size: 12px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; font-weight: 800; }
        .ref-card .rv { font-family: 'DM Mono', monospace; font-weight: 500; font-size: 24px; color: #FFD94A; letter-spacing: 0.08em; }
        .venue { margin-top: 22px; padding: 16px; background: rgba(127,255,212,0.04); border: 1px solid rgba(127,255,212,0.12); border-radius: 16px; font-size: 13px; color: rgba(255,255,255,0.38); text-align: center; line-height: 2; font-weight: 600; }

        @media(max-width:640px) {
          .bcard { padding: 28px 20px; }
          .outer { padding: 24px 16px 60px; }
        }
        @media(max-width:400px) {
          .day-num { font-size: 14px; }
          .days-grid { gap: 5px; }
        }
      `}</style>

      <div className="page">
        <div style={{ animation: 'fadeIn 0.4s ease both', minHeight: '100vh' }}>
          {/* Grid */}
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
          {/* Glows */}
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(8,18,46,0.95)',
              backdropFilter: 'blur(12px)',
              position: 'sticky',
              top: 0,
              zIndex: 50,
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
            <div className="prog-bar">
              {(['Date & Time', 'Visitors & Pay', 'Confirmed'] as const).map((label, i) => {
                const state = i < phase ? 'done' : i === phase ? 'active' : 'upcoming'
                const bg = state === 'active' ? '#FFD94A' : state === 'done' ? 'rgba(0,200,180,0.2)' : 'rgba(255,255,255,0.06)'
                const color = state === 'active' ? '#08122e' : state === 'done' ? '#00c8a0' : 'rgba(255,255,255,0.30)'
                const border =
                  state === 'active'
                    ? 'rgba(255,217,74,0.55)'
                    : state === 'done'
                      ? 'rgba(0,200,180,0.25)'
                      : 'rgba(255,255,255,0.10)'
                return (
                  <span
                    key={label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: bg,
                      border: `1px solid ${border}`,
                      color,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: 12,
                      letterSpacing: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {state === 'done' ? '✓' : null}
                    {label}
                  </span>
                )
              })}
            </div>
          </div>

          <div
            style={{
              position: 'sticky',
              top: 56,
              zIndex: 48,
              background: 'rgba(8,18,46,0.94)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 20px',
            }}
          >
            <div
              style={{
                maxWidth: 860,
                margin: '0 auto',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => setVisitType('general')}
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255,217,74,0.45)',
                  background: 'rgba(255,217,74,0.12)',
                  color: '#FFD94A',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                General visit
              </button>
              <a
                href="/birthdays"
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.55)',
                  padding: '8px 14px',
                  textDecoration: 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Birthday
              </a>
              <a
                href="/schools"
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.55)',
                  padding: '8px 14px',
                  textDecoration: 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                School trip
              </a>
            </div>
          </div>

          {(step === 'date' || step === 'slot') && (
            <div style={{ maxWidth: 600, margin: '16px auto 0', padding: '0 20px' }}>
              <Disclaimers compact />
            </div>
          )}

          {step === 'pending' && (
            <div
              style={{
                position: 'sticky',
                top: 108,
                zIndex: 47,
                background: 'rgba(255,217,74,0.12)',
                borderBottom: '1px solid rgba(255,217,74,0.28)',
                padding: '10px 20px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 600, lineHeight: 1.7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: '#FFD94A' }} />
                📱 M-Pesa prompt sent to {phone || 'your phone'} — enter your PIN now
              </span>
            </div>
          )}

        <div className="outer">
          <div className="bcard">
            {step === 'date' && (
              <>
                <div className="spill">📅 Pick a day</div>
                <h2 className="stitle">
                  {visitType === 'birthday'
                    ? 'Pick a party day'
                    : visitType === 'school'
                      ? 'Pick your trip day'
                      : 'Choose your day'}
                </h2>
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
                    const isSel = day.dateStr === selectedDate
                    let cls = 'day'
                    if (!day.bookable) cls += ' unavail'
                    else if (isSel) cls += ' sel'
                    else if (day.isWeekend) cls += ' wknd'
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
                        <div className="day-dots" aria-hidden>
                          {day.bookable && day.isWeekend && <span className="dot dot-wknd" />}
                          {day.bookable && !day.isWeekend && <span className="dot dot-avail" />}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="cal-leg">
                  <div className="leg">
                    <span className="leg-dot avail-dot" aria-hidden />
                    Available
                  </div>
                  <div className="leg">
                    <span className="leg-dot wknd-dot" aria-hidden />
                    Weekend
                  </div>
                  <div className="leg">
                    <span className="leg-unavail-swatch" aria-hidden />
                    Unavailable
                  </div>
                </div>
              </>
            )}

            {step === 'slot' && (
              <>
                <button className="btn-back" onClick={() => setStep('date')}>
                  ← Back
                </button>
                <div className="spill">🕙 Pick a time</div>
                <h2 className="stitle">
                  Pick your <span>session time</span>
                </h2>
                <p className="ssub">
                  {parseLocalDateKey(selectedDate).toLocaleDateString('en-KE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}{' '}
                  — 2-hour sessions, starting every hour (overlapping slots).
                </p>

                <div className="slots">
                  {slotsLoading ? (
                    <div
                      style={{
                        padding: '28px 16px',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.65)',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Loading available times…
                    </div>
                  ) : (
                  BOOKABLE_SLOTS.map((slot, idx) => {
                    const session = sessions.find(s => s.time_slot === slot) || null
                    const available = session ? sessionOpenSpots(session) : 0
                    const now = new Date()
                    const todayKey = toLocalDateKey(now)
                    const isToday = selectedDate === todayKey
                    const nowMinutes = now.getHours() * 60 + now.getMinutes()
                    const startMins = slotStartMinutes(slot)
                    const isPastSlot = isToday && Number.isFinite(startMins) && startMins <= nowMinutes
                    const isFull = !!session && (session.is_blocked || available <= 0)
                    const missing = !session
                    const blocked = missing || isFull || isPastSlot
                    const showSpotCount = !blocked && available > 0 && available <= 10

                    let statusText = '🟢 Available'
                    if (isPastSlot) statusText = '⏱ Session already started'
                    else if (missing) statusText = '🔴 Unavailable'
                    else if (isFull) statusText = '🔴 Full'
                    else if (showSpotCount) statusText = `🟢 Only ${available} spot${available === 1 ? '' : 's'} left`

                    const palette = ['#FF6B9D', '#FFD94A', '#7FFFD4'] as const
                    const emojis = ['🔬', '🧪', '⚗️', '🧬', '🚀', '⚡', '🌍'] as const
                    const colors = palette.map(c => c)
                    const delays = ['2.2s', '2.5s', '2.8s', '3.1s', '3.4s', '3.7s', '4.0s'] as const
                    const color = colors[idx % colors.length]
                    return (
                      <div
                        key={slot}
                        className={`slot s${idx % 3}${blocked ? ' blocked' : ''}`}
                        style={{ ['--sd' as any]: delays[idx % delays.length] } as CSSProperties}
                        onClick={() => {
                          if (!blocked && session) {
                            setSelectedSession(session)
                            setStep('count')
                          }
                        }}
                      >
                        <div className="slot-emoji">{emojis[idx % emojis.length]}</div>
                        <div className="slot-label">
                          <h3 style={{ color }}>{SLOT_LABELS[slot]}</h3>
                          <p>{statusText}</p>
                        </div>
                        <div className="slot-spots">
                          <div className="slot-spots-num" style={{ color }}>
                            {blocked ? '—' : showSpotCount ? available : '✓'}
                          </div>
                          <div className="slot-spots-lbl">{showSpotCount ? 'spots left' : blocked ? 'spots left' : 'open'}</div>
                        </div>
                        {!blocked && (
                          <div className="slot-arr" style={{ color }}>
                            ›
                          </div>
                        )}
                      </div>
                    )
                  })
                  )}
                </div>
              </>
            )}

            {step === 'count' && (
              <>
                <button className="btn-back" onClick={() => setStep('slot')}>
                  ← Back
                </button>
                <div className="spill">
                  {visitType === 'birthday' ? '🎂 Party details' : visitType === 'school' ? '🏫 School details' : '👨‍👩‍👧‍👦 Visitors & pay'}
                </div>
                <h2 className="stitle">
                  {visitType === 'birthday'
                    ? 'Party details'
                    : visitType === 'school'
                      ? 'School trip details'
                      : (
                          <>
                            Who&apos;s <span>joining today?</span>
                          </>
                        )}
                </h2>

                {(visitType === 'birthday' || visitType === 'school') && (
                  <>
                    <FieldLabel>How would you like to book?</FieldLabel>
                    <SegmentedTwo
                      value={sessionMode}
                      onChange={id => setSessionMode(id as 'shared' | 'exclusive')}
                      left={{
                        id: 'shared',
                        label: 'Shared Session',
                        hint: 'Park is open to other attendees.',
                      }}
                      right={{
                        id: 'exclusive',
                        label: 'Exclusive Session',
                        hint: 'Park is closed to other attendees.',
                      }}
                    />
                    <DirectReachOut
                      context={
                        visitType === 'school'
                          ? 'Need a tailored school package? Call / WhatsApp / Email us.'
                          : 'Need a tailored birthday package? Call / WhatsApp / Email us.'
                      }
                      presetMessage={
                        visitType === 'school'
                          ? `Hi Little Scientist — I'd like a school trip plan${schoolName ? ` for ${schoolName}` : ''}${selectedDate ? ` around ${selectedDate}` : ''}.`
                          : `Hi Little Scientist — I'd like a birthday plan${name ? ` (${name})` : ''}${selectedDate ? ` around ${selectedDate}` : ''}.`
                      }
                    />
                  </>
                )}

                {visitType === 'birthday' && (
                  <div style={{ marginBottom: 8 }}>
                    <FieldLabel>Parent / guardian name *</FieldLabel>
                    <input
                      style={bookFieldStyle}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Full name"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Telephone *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="e.g. 0700 101 425"
                          type="tel"
                        />
                      </div>
                      <div>
                        <FieldLabel>Email *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          value={birthdayEmail}
                          onChange={e => setBirthdayEmail(e.target.value)}
                          placeholder="name@email.com"
                          type="email"
                        />
                      </div>
                    </div>
                    {sessionMode === 'exclusive' && (
                      <>
                        <FieldLabel>Approx. number of guests *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          type="number"
                          min={1}
                          value={Math.max(1, adults + childrenPaid + childrenFreeUnder95)}
                          onChange={e => {
                            const n = Math.max(1, Number(e.target.value) || 1)
                            setAdults(1)
                            setChildrenPaid(Math.max(0, n - 1))
                            setChildrenFreeUnder95(0)
                          }}
                        />
                        <FieldLabel>Optional Notes</FieldLabel>
                        <textarea
                          style={{ ...bookFieldStyle, minHeight: 88, resize: 'vertical' }}
                          value={partyNotes}
                          onChange={e => setPartyNotes(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                )}

                {visitType === 'school' && (
                  <div style={{ marginBottom: 8 }}>
                    <FieldLabel>School name *</FieldLabel>
                    <input
                      style={bookFieldStyle}
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="School name"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Contact person *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Teacher / coordinator"
                        />
                      </div>
                      <div>
                        <FieldLabel>Email *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          placeholder="school@email.com"
                          type="email"
                        />
                      </div>
                    </div>
                    {(sessionMode === 'exclusive' || schoolTooLarge) && (
                      <>
                        <FieldLabel>Phone *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="e.g. 0700 101 425"
                          type="tel"
                        />
                      </>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Students * (min 20)</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          type="number"
                          min={20}
                          value={studentCount}
                          onChange={e => syncSchoolCounts(Number(e.target.value) || 0, staffCount)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Number of Adults *</FieldLabel>
                        <input
                          style={bookFieldStyle}
                          type="number"
                          min={1}
                          value={staffCount}
                          onChange={e => syncSchoolCounts(studentCount, Number(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    {schoolTooLarge && sessionMode === 'shared' && (
                      <div
                        style={{
                          marginBottom: 14,
                          padding: '12px 14px',
                          borderRadius: 14,
                          border: '1px solid rgba(255,217,74,0.25)',
                          background: 'rgba(255,217,74,0.08)',
                          color: 'rgba(255,255,255,0.82)',
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.5,
                        }}
                      >
                        This group ({schoolHeadcount}) is larger than remaining spots ({spotsLeft}). We&apos;ll send an
                        enquiry so the team can help with another slot or exclusive hire.
                      </div>
                    )}
                    <FieldLabel>Optional Notes</FieldLabel>
                    <textarea
                      style={{ ...bookFieldStyle, minHeight: 88, resize: 'vertical' }}
                      value={partyNotes}
                      onChange={e => setPartyNotes(e.target.value)}
                    />
                  </div>
                )}

                {!needsEnquiry && visitType !== 'school' && (
                  <>
                    {visitType === 'general' && (
                      <div className="warn" style={{ background: 'rgba(255,217,74,0.07)' }}>
                        👶🏾 Children <strong>94.9cm and below</strong> enter <strong>FREE</strong> — no ticket needed.
                        Please inform gate staff.
                      </div>
                    )}

                    <div
                      className="ctr"
                      ref={counterSectionRef}
                    >
                      <div className="ctr-info">
                        <h3>👶🏾 Children (94.9cm and below)</h3>
                        <p style={{ color: visitType === 'birthday' ? '#FFD94A' : 'rgba(255,255,255,0.5)' }}>
                          {visitType === 'birthday'
                            ? `KES ${activePricing.childUnder95cmKes.toLocaleString()}`
                            : 'FREE'}
                        </p>
                      </div>
                      <div className="ctr-ctrl">
                        <button
                          className="ctr-btn bc"
                          onClick={() => setChildrenFreeUnder95(Math.max(0, childrenFreeUnder95 - 1))}
                        >
                          −
                        </button>
                        <span className="ctr-val">{childrenFreeUnder95}</span>
                        <button className="ctr-btn bc" onClick={() => setChildrenFreeUnder95(childrenFreeUnder95 + 1)}>
                          +
                        </button>
                      </div>
                    </div>

                    <div className="ctr">
                      <div className="ctr-info">
                        <h3>👧🏾 Children (95cm – 17 years)</h3>
                        <p style={{ color: '#FFD94A' }}>KES {activePricing.child95cmTo17Kes.toLocaleString()}</p>
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

                    <div className="ctr">
                      <div className="ctr-info">
                        <h3>🧑🏾 Adults (18 and above)</h3>
                        <p style={{ color: '#FFD94A' }}>KES {activePricing.adult18PlusKes.toLocaleString()}</p>
                      </div>
                      <div className="ctr-ctrl">
                        <button className="ctr-btn ba" onClick={() => setAdults(Math.max(0, adults - 1))}>
                          −
                        </button>
                        <span className="ctr-val">{adults}</span>
                        <button className="ctr-btn ba" onClick={() => setAdults(adults + 1)}>
                          +
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const hint = validatePaidCheckout(
                        { adults, children: childrenPaid, infants: childrenFreeUnder95 },
                        total,
                      )
                      if (hint.ok) return null
                      return (
                        <div
                          style={{
                            marginTop: 14,
                            padding: '12px 14px',
                            borderRadius: 14,
                            border: '1px solid rgba(255,217,74,0.25)',
                            background: 'rgba(255,217,74,0.08)',
                            color: 'rgba(255,255,255,0.82)',
                            fontSize: 13,
                            fontWeight: 600,
                            lineHeight: 1.5,
                          }}
                        >
                          {hint.message}
                        </div>
                      )
                    })()}
                  </>
                )}

                {!needsEnquiry && visitType === 'school' && (
                  <div
                    ref={counterSectionRef}
                    style={{
                      marginTop: 8,
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.7)',
                      lineHeight: 1.55,
                    }}
                  >
                    Shared school trips are charged at standard admission: students as children (KES{' '}
                    {pricing.child95cmTo17Kes.toLocaleString()}) and staff as adults (KES{' '}
                    {pricing.adult18PlusKes.toLocaleString()}).
                    {spotsLeft <= 10
                      ? ` Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left in this session.`
                      : ' This session is open for booking.'}
                    {(() => {
                      const hint = validatePaidCheckout(
                        { adults: staffCount, children: studentCount, infants: 0 },
                        staffCount * pricing.adult18PlusKes + studentCount * pricing.child95cmTo17Kes,
                      )
                      if (hint.ok) return null
                      return <div style={{ marginTop: 10, color: '#FFD94A' }}>{hint.message}</div>
                    })()}
                  </div>
                )}

                {needsEnquiry ? (
                  <>
                    <TermsBoxes
                      termsRead={termsRead}
                      setTermsRead={setTermsRead}
                      setTermsConsent={setTermsConsent}
                    />
                    {error && <div className="err">{error}</div>}
                    <button
                      className="btn-go"
                      onClick={proceedFromCountersToPayment}
                      disabled={loading || !termsRead}
                    >
                      {loading ? 'Sending…' : 'Send'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="total">
                      <div className="total-lbl">Total</div>
                      <div className="total-val">
                        KES{' '}
                        {(visitType === 'school'
                          ? staffCount * pricing.adult18PlusKes + studentCount * pricing.child95cmTo17Kes
                          : total
                        ).toLocaleString()}
                      </div>
                    </div>

                    {visitType === 'general' && (
                      <>
                        <p className="ssub" style={{ marginTop: 8 }}>
                          Almost done — enter your M-Pesa number and pay.
                        </p>
                        <input
                          className="inp"
                          placeholder="Your name (optional)"
                          value={name}
                          onChange={e => setName(e.target.value)}
                        />
                        <input
                          className="inp"
                          placeholder="M-Pesa number e.g. 0700 101 425"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                        <TermsGate
                          checked={termsRead}
                          onCheckedChange={v => {
                            setTermsRead(v)
                            setTermsConsent(v)
                          }}
                        />
                        {error && <div className="err">{error}</div>}
                        <button
                          type="button"
                          className="btn-go"
                          onClick={handlePayment}
                          disabled={loading || !termsRead}
                        >
                          {loading
                            ? 'Sending M-Pesa…'
                            : !termsRead
                              ? 'Tick the box above to pay'
                              : `Pay KES ${total.toLocaleString()} with M-Pesa`}
                        </button>
                      </>
                    )}

                    {visitType !== 'general' && (
                      <>
                        {error && <div className="err">{error}</div>}
                        <button className="btn-go" onClick={proceedFromCountersToPayment}>
                          Continue to payment →
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}


            {step === 'payment' && (
              <>
                <button className="btn-back" onClick={() => setStep('count')}>
                  ← Back
                </button>
                <div className="spill">💳 Almost done</div>
                <h2 className="stitle">Pay with M-Pesa</h2>
                <p className="ssub">You’ll get an STK prompt on your phone — enter your PIN to finish.</p>

                <div className="sum">
                  <h4>Booking summary</h4>
                  <div className="sum-row">
                    <span>📅 Date</span>
                    <span>
                      {parseLocalDateKey(selectedDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                <div className="sum-row">
                  <span>🕙 Time</span>
                    <span>{SLOT_LABELS[selectedSession?.time_slot || '09:00-11:00']}</span>
                </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '10px 0' }} />
                  {visitType !== 'general' && (
                    <div className="sum-row">
                      <span>Visit type</span>
                      <span>{visitTypeLabel(visitType)}</span>
                    </div>
                  )}
                  {visitType === 'birthday' && name && (
                    <div className="sum-row">
                      <span>Parent / guardian</span>
                      <span>{name}</span>
                    </div>
                  )}
                  {visitType === 'birthday' && birthdayEmail && (
                    <div className="sum-row">
                      <span>Email</span>
                      <span>{birthdayEmail}</span>
                    </div>
                  )}
                  {visitType === 'school' && (
                    <div className="sum-row">
                      <span>School</span>
                      <span>{schoolName || '—'}</span>
                    </div>
                  )}
                  <div className="sum-row">
                    <span>
                      🧑🏾 {visitType === 'school' ? 'Staff' : 'Adults'} × {visitType === 'school' ? staffCount : adults}
                    </span>
                    <span>
                      KES{' '}
                      {((visitType === 'school' ? staffCount : adults) * activePricing.adult18PlusKes).toLocaleString()}
                    </span>
                  </div>
                  <div className="sum-row">
                    <span>
                      👧🏾 {visitType === 'school' ? 'Students' : 'Children (95cm – 17 years)'} ×{' '}
                      {visitType === 'school' ? studentCount : childrenPaid}
                    </span>
                    <span>
                      KES{' '}
                      {(
                        (visitType === 'school' ? studentCount : childrenPaid) * activePricing.child95cmTo17Kes
                      ).toLocaleString()}
                    </span>
                  </div>
                  {visitType !== 'school' && (
                    <div className="sum-row">
                      <span>
                        👶🏾 Children (94.9cm and below)
                        {visitType === 'birthday' ? '' : ' (FREE)'} × {childrenFreeUnder95}
                      </span>
                      <span>
                        KES{' '}
                        {(visitType === 'birthday'
                          ? childrenFreeUnder95 * activePricing.childUnder95cmKes
                          : 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {visitType === 'birthday' && (
                    <div
                      style={{
                        margin: '8px 0 4px',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(255,217,74,0.07)',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.55)',
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {BIRTHDAY_FOOD_NOTICE}
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '10px 0' }} />
                  <div className="sum-row b">
                    <span>Total</span>
                    <span style={{ color: '#FFD94A' }}>
                      KES{' '}
                      {computeBasket(
                        visitType === 'school' ? staffCount : adults,
                        visitType === 'school' ? studentCount : childrenPaid,
                        tiersForBasket,
                        visitType === 'birthday' ? childrenFreeUnder95 : 0,
                      ).grandTotalFormatted}
                    </span>
                  </div>
                </div>

                <input
                  className="inp"
                  placeholder={
                    visitType === 'school' ? 'Contact name' : visitType === 'birthday' ? 'Parent / guardian name *' : 'Your name (optional)'
                  }
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                {visitType === 'birthday' && (
                  <input
                    className="inp"
                    placeholder="Parent / guardian email *"
                    value={birthdayEmail}
                    onChange={e => setBirthdayEmail(e.target.value)}
                    type="email"
                  />
                )}
                <input
                  className="inp"
                  placeholder="M-Pesa number e.g. 0700 101 425"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                />

                <TermsGate
                  checked={termsRead}
                  onCheckedChange={v => {
                    setTermsRead(v)
                    setTermsConsent(v)
                  }}
                />

                {error && <div className="err">{error}</div>}
                <button
                  type="button"
                  className="btn-go"
                  onClick={handlePayment}
                  disabled={loading || !termsRead}
                >
                  {loading
                    ? 'Sending M-Pesa…'
                    : !termsRead
                      ? 'Tick the box above to pay'
                      : `Pay KES ${basket.grandTotalFormatted} with M-Pesa`}
                </button>
                <button className="btn-ghost" onClick={() => setStep('count')}>
                  ← Change visitors
                </button>

                <div className="venue" style={{ marginTop: 20 }}>
                  Sabaki Estate, Athi River · 0700 101 425
                </div>
              </>
            )}

            {step === 'pending' && (
              <div className="pend">
                <div className="spill">📱 Enter your PIN on your phone</div>
                <div className="big">📱</div>
                <h2>Check your phone!</h2>
                <p>
                  Prompt sent to{' '}
                  <strong style={{ color: '#FFD94A', fontSize: 20 }}>{phone}</strong>
                </p>
                <p style={{ marginTop: 14 }}>
                  Enter your PIN to confirm
                  <br />
                  <strong style={{ color: '#FFD94A', fontSize: 24 }}>KES {total.toLocaleString()}</strong>
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
                {enquiryDone ? (
                  <EnquirySuccess
                    title={visitType === 'school' ? 'School enquiry received!' : 'Birthday enquiry received!'}
                    enquiryRef={enquiryRef}
                  />
                ) : (
                  <>
                    <div className="spill">✅ Step 3 of 3</div>
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
                          {parseLocalDateKey(selectedDate).toLocaleDateString('en-KE', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </span>
                      </div>
                      <div className="sum-row">
                        <span>🕙</span>
                        <span>{SLOT_LABELS[selectedSession?.time_slot || '09:00-11:00']}</span>
                      </div>
                      <div className="sum-row">
                        <span>👨‍👩‍👧‍👦</span>
                        <span>
                          {visitType === 'school'
                            ? `${staffCount} staff · ${studentCount} students`
                            : `${adults} adult${adults > 1 ? 's' : ''} · ${childrenPaid + childrenFreeUnder95} child${
                                childrenPaid + childrenFreeUnder95 > 1 ? 'ren' : ''
                              }`}
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {partyModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
          }}
          onMouseDown={() => setPartyModal(null)}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(380px, calc(100vw - 28px))',
              background: '#08122e',
              border:
                partyModal.code === 'ADULTS_ONLY'
                  ? '1px solid rgba(255,217,74,0.30)'
                  : '1px solid rgba(46,142,255,0.30)',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 10 }}>
              {partyModal.title}
            </div>
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
                fontSize: 15,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.82)',
                marginBottom: 16,
              }}
            >
              {partyModal.message}
            </div>
            <button
              type="button"
              onClick={acknowledgePartyModal}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                color: '#08122e',
                background: 'linear-gradient(135deg, #FFD94A, #FFC107)',
                boxShadow: '0 10px 34px rgba(255,217,74,0.18)',
              }}
            >
              {partyModal.actionLabel}
            </button>
          </div>
        </div>
      )}
    </>
  )
}


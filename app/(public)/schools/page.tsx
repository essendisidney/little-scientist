'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import WatermarkBg from '@/components/portal/WatermarkBg'
import Disclaimers from '@/components/portal/Disclaimers'
import TermsGate from '@/components/portal/TermsGate'
import { DirectReachOut, FieldLabel, bookFieldStyle, SegmentedTwo } from '../book/VisitTypeUi'
import { toLocalDateKey } from '@/lib/dates'
import { isValidKenyaPhone } from '@/lib/phone'

export default function SchoolsPage() {
  const [sessionMode, setSessionMode] = useState<'shared' | 'exclusive'>('shared')
  const [schoolName, setSchoolName] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [date, setDate] = useState('')
  const [children, setChildren] = useState(20)
  const [adults, setAdults] = useState(2)
  const [notes, setNotes] = useState('')
  const [termsOk, setTermsOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [enquiryRef, setEnquiryRef] = useState('')

  const minDate = useMemo(() => toLocalDateKey(), [])

  async function submit() {
    setError('')
    if (!termsOk) {
      setError('Please read and accept the Terms and Conditions.')
      return
    }
    if (!schoolName.trim() || !name.trim() || !phone.trim() || !email.includes('@') || !date || adults < 1) {
      setError('Please complete all required fields.')
      return
    }
    if (!isValidKenyaPhone(phone)) {
      setError('Enter a valid Kenyan mobile number (07… / 01… / 254…).')
      return
    }
    if (children < 20) {
      setError('School trips require a minimum of 20 students.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/schools/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          contactName: name.trim(),
          contactPhone: phone.trim(),
          contactEmail: email.trim(),
          studentCount: children,
          preferredDate: date,
          sessionType: sessionMode === 'exclusive' ? 'exclusive' : 'non-exclusive',
          specialRequirements: [`Adults / staff: ${adults}`, notes.trim() || ''].filter(Boolean).join('\n'),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setEnquiryRef(String(data.enquiryRef || ''))
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-ls-bg text-white">
      <WatermarkBg />
      <div className="relative z-10 mx-auto max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">School Trip Booking</h1>
          <Link href="/" className="text-sm font-semibold text-ls-yellow">
            ← Home
          </Link>
        </div>
        <div className="mb-6">
          <Disclaimers compact variant="group" />
        </div>

        {success ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-3xl" aria-hidden>
              ✓
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-xl font-bold">Request sent</h2>
            {enquiryRef && <p className="mt-2 font-mono text-ls-yellow">{enquiryRef}</p>}
            <p className="mt-2 text-sm text-white/70">We will contact you by email or phone.</p>
            <DirectReachOut context="Need a tailored school package? Call / WhatsApp / Email us." />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <FieldLabel>Session type</FieldLabel>
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

            <FieldLabel>School name *</FieldLabel>
            <input style={bookFieldStyle} value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Greenfield Academy" />
            <FieldLabel>Contact person (adult) *</FieldLabel>
            <input style={bookFieldStyle} value={name} onChange={e => setName(e.target.value)} />
            <FieldLabel>Phone *</FieldLabel>
            <input style={bookFieldStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <FieldLabel>Email *</FieldLabel>
            <input style={bookFieldStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <FieldLabel>Date *</FieldLabel>
            <input
              style={bookFieldStyle}
              type="date"
              min={minDate}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Number of Children * (min 20)</FieldLabel>
                <input
                  style={bookFieldStyle}
                  type="number"
                  min={20}
                  value={children}
                  onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <FieldLabel>Number of Adults *</FieldLabel>
                <input
                  style={bookFieldStyle}
                  type="number"
                  min={1}
                  value={adults}
                  onChange={e => setAdults(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>
            <FieldLabel>Optional Notes</FieldLabel>
            <textarea
              style={{ ...bookFieldStyle, minHeight: 88, resize: 'vertical' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <DirectReachOut context="Need a tailored school package? Call / WhatsApp / Email us." />
            <TermsGate visitType="school" checked={termsOk} onCheckedChange={setTermsOk} />
            {error && (
              <p className="mb-3 text-sm font-semibold text-red-300" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={loading || !termsOk}
              className="w-full rounded-xl bg-ls-yellow py-3.5 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#07132D] disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

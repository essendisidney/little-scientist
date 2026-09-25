'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import WatermarkBg from '@/components/portal/WatermarkBg'
import Disclaimers from '@/components/portal/Disclaimers'
import TermsGate from '@/components/portal/TermsGate'
import { DirectReachOut, FieldLabel, bookFieldStyle, SegmentedTwo, venueWhatsAppUrl } from '../book/VisitTypeUi'
import { toLocalDateKey } from '@/lib/dates'
import { isValidKenyaPhone } from '@/lib/phone'

const MIN_CHILDREN = 1
const MIN_ADULTS = 1

export default function BirthdaysPage() {
  const [sessionMode, setSessionMode] = useState<'shared' | 'exclusive'>('shared')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [children, setChildren] = useState(MIN_CHILDREN)
  const [adults, setAdults] = useState(MIN_ADULTS)
  const [notes, setNotes] = useState('')
  const [termsOk, setTermsOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [enquiryRef, setEnquiryRef] = useState('')
  const [whatsAppUrl, setWhatsAppUrl] = useState('')

  const minDate = useMemo(() => toLocalDateKey(), [])

  async function submit() {
    setError('')
    if (!termsOk) {
      setError('Please read and accept the Terms and Conditions.')
      return
    }
    if (!name.trim() || !phone.trim() || !date) {
      setError('Please complete all required fields.')
      return
    }
    if (!isValidKenyaPhone(phone)) {
      setError('Enter a valid Kenyan mobile number (07… / 01… / 254…).')
      return
    }
    if (children < MIN_CHILDREN) {
      setError(`Birthday bookings require a minimum of ${MIN_CHILDREN} children.`)
      return
    }
    if (adults < MIN_ADULTS) {
      setError(`Birthday bookings require a minimum of ${MIN_ADULTS} adults.`)
      return
    }
    if (date < minDate) {
      setError('Choose today or any later date for the birthday party.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/birthdays/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: name.trim(),
          phone: phone.trim(),
          guestCount: children + adults,
          preferredDate: date,
          sessionPreference: sessionMode === 'exclusive' ? 'exclusive' : 'non-exclusive',
          specialRequirements: [`Children: ${children}`, `Adults: ${adults}`, notes.trim() || '']
            .filter(Boolean)
            .join('\n'),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      const ref = String(data.enquiryRef || '')
      setEnquiryRef(ref)
      const wa = venueWhatsAppUrl(
        [
          `Birthday party request ${ref}`,
          `Name: ${name.trim()}`,
          `Phone: ${phone.trim()}`,
          `Date of birthday party: ${date}`,
          `Children: ${children}`,
          `Adults: ${adults}`,
          sessionMode === 'exclusive' ? 'Exclusive session' : 'Shared session',
          notes.trim() ? `Notes: ${notes.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      setWhatsAppUrl(wa)
      window.open(wa, '_blank', 'noopener,noreferrer')
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
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">Birthday Booking</h1>
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
            <p className="mt-2 text-sm text-white/70">
              Sent to info@littlescientist.ke. Send the same request on WhatsApp so the team gets it there too.
            </p>
            {whatsAppUrl && (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-[#07132D]"
              >
                Send on WhatsApp
              </a>
            )}
            <DirectReachOut />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <p className="mb-4 text-sm font-semibold text-white/70">
              Birthday rates apply.
              <br />
              This form sends a request. We confirm by phone or whatsapp.
            </p>
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

            <FieldLabel>Adult&apos;s Full Name *</FieldLabel>
            <input style={bookFieldStyle} value={name} onChange={e => setName(e.target.value)} />
            <FieldLabel>Phone *</FieldLabel>
            <input style={bookFieldStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            <FieldLabel>Date of Birthday party *</FieldLabel>
            <input
              style={bookFieldStyle}
              type="date"
              min={minDate}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Number of Children * (min {MIN_CHILDREN})</FieldLabel>
                <input
                  style={bookFieldStyle}
                  type="number"
                  min={MIN_CHILDREN}
                  value={children}
                  onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <FieldLabel>Number of Adults * (min {MIN_ADULTS})</FieldLabel>
                <input
                  style={bookFieldStyle}
                  type="number"
                  min={MIN_ADULTS}
                  value={adults}
                  onChange={e => setAdults(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
            <FieldLabel>Optional Notes</FieldLabel>
            <textarea
              style={{ ...bookFieldStyle, minHeight: 88, resize: 'vertical' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <DirectReachOut />
            <TermsGate visitType="birthday" checked={termsOk} onCheckedChange={setTermsOk} />
            {error && <p className="mb-3 text-sm font-semibold text-red-300">{error}</p>}
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

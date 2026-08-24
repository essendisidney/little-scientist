'use client'

import type { CSSProperties, ReactNode } from 'react'
import TermsGate from '@/components/portal/TermsGate'

export function SegmentedTwo({
  left,
  right,
  value,
  onChange,
}: {
  left: { id: string; label: string; hint: string }
  right: { id: string; label: string; hint: string }
  value: string
  onChange: (id: string) => void
}) {
  const btn = (id: string, label: string, hint: string): ReactNode => {
    const on = value === id
    return (
      <button
        type="button"
        key={id}
        onClick={() => onChange(id)}
        style={{
          flex: 1,
          textAlign: 'left',
          borderRadius: 14,
          border: on ? '2px solid rgba(46,142,255,0.65)' : '1px solid rgba(255,255,255,0.12)',
          background: on
            ? 'linear-gradient(135deg,rgba(46,142,255,0.22),rgba(255,217,74,0.12))'
            : 'rgba(255,255,255,0.03)',
          color: '#fff',
          padding: '14px 14px',
          cursor: 'pointer',
          fontFamily: 'var(--font-body), sans-serif',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{hint}</div>
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      {btn(left.id, left.label, left.hint)}
      {btn(right.id, right.label, right.hint)}
    </div>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-body), sans-serif',
        fontWeight: 500,
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.04em',
        margin: '0 0 8px',
      }}
    >
      {children}
    </div>
  )
}

export const bookFieldStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '2px solid rgba(255,255,255,0.11)',
  borderRadius: 14,
  padding: '14px 16px',
  color: 'rgba(255,255,255,0.90)',
  fontSize: 15,
  fontFamily: 'var(--font-body), sans-serif',
  fontWeight: 500,
  marginBottom: 14,
}

/** @deprecated Prefer TermsGate — kept for gradual migration */
export function TermsBoxes({
  termsRead,
  setTermsRead,
  setTermsConsent,
  visitType = 'general',
}: {
  termsRead: boolean
  termsConsent?: boolean
  setTermsRead: (v: boolean) => void
  setTermsConsent?: (v: boolean) => void
  readLabel?: string
  consentLabel?: string
  visitType?: 'general' | 'birthday' | 'school'
}) {
  return (
    <TermsGate
      visitType={visitType}
      checked={termsRead}
      onCheckedChange={v => {
        setTermsRead(v)
        setTermsConsent?.(v)
      }}
    />
  )
}

export function EnquirySuccess({ title, enquiryRef }: { title: string; enquiryRef: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          background: 'rgba(0,200,180,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 36,
        }}
      >
        ✓
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-heading), sans-serif',
          fontWeight: 700,
          fontSize: 28,
          color: '#fff',
          marginBottom: 10,
        }}
      >
        {title}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
        We will confirm availability and get back to you shortly.
      </p>
      {enquiryRef ? (
        <div
          style={{
            margin: '18px auto 0',
            maxWidth: 420,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 18px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Reference</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#FFD94A' }}>{enquiryRef}</div>
        </div>
      ) : null}
      <DirectReachOut
        context="Need a tailored birthday package? Call / WhatsApp / Email us."
        presetMessage="Hi Little Scientist — I just submitted an enquiry and would like to discuss details."
      />
    </div>
  )
}

const REACH_PHONE_DISPLAY = '0700 101 425'
const REACH_PHONE_E164 = '254700101425'
const REACH_EMAIL = 'info@littlescientist.ke'

export function DirectReachOut({
  context = 'Need a tailored birthday package? Call / WhatsApp / Email us.',
  presetMessage = 'Hi Little Scientist — I would like a birthday/school plan.',
}: {
  context?: string
  presetMessage?: string
}) {
  const wa = `https://wa.me/${REACH_PHONE_E164}?text=${encodeURIComponent(presetMessage)}`
  const mail = `mailto:${REACH_EMAIL}?subject=${encodeURIComponent('Booking enquiry')}&body=${encodeURIComponent(presetMessage)}`
  const linkStyle: CSSProperties = {
    flex: 1,
    minWidth: 100,
    textAlign: 'center',
    textDecoration: 'none',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.85)',
    padding: '12px 10px',
    fontFamily: 'var(--font-body), sans-serif',
    fontWeight: 700,
    fontSize: 13,
  }
  return (
    <div
      style={{
        marginTop: 16,
        marginBottom: 8,
        padding: '14px 14px',
        borderRadius: 14,
        border: '1px solid rgba(46,142,255,0.22)',
        background: 'rgba(46,142,255,0.08)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body), sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
          marginBottom: 10,
          lineHeight: 1.45,
        }}
      >
        {context}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={`tel:+${REACH_PHONE_E164}`} style={linkStyle}>
          Call
          <div style={{ fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {REACH_PHONE_DISPLAY}
          </div>
        </a>
        <a href={wa} target="_blank" rel="noreferrer" style={linkStyle}>
          WhatsApp
          <div style={{ fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {REACH_PHONE_DISPLAY}
          </div>
        </a>
        <a href={mail} style={linkStyle}>
          Email
          <div style={{ fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            {REACH_EMAIL}
          </div>
        </a>
      </div>
    </div>
  )
}

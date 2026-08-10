'use client'

import { useState, type MouseEvent } from 'react'

const TERMS_URL = '/terms.pdf'
const TERMS_PAGE = '/terms'

const TERMS_POINTS = [
  'Bookings are confirmed only after successful payment or written confirmation from Little Scientist.',
  'Tickets sold are not refundable or transferable. For rebooking, please call customer care on 0700 101 425.',
  'Adults may enter only when accompanied by children. Minors may enter only when accompanied by adults.',
  'Alcohol and drugs are strictly prohibited on site.',
  'Outside food and drinks are not allowed for general visits. For birthday and school bookings, food and drinks are the responsibility of the booking party. There is no restaurant on site.',
  'Session times must be observed. Late arrival may reduce available play time without refund.',
  'Little Scientist may refuse entry or remove guests who breach safety or conduct rules.',
  'Prices and availability are as shown at the time of booking and may change for future dates.',
  'Contact: Sabaki Estate, Athi River · 0700 101 425 · info@littlescientist.ke',
]

export default function TermsGate({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const [opened, setOpened] = useState(false)
  const [modal, setModal] = useState(false)

  function markOpened() {
    setOpened(true)
  }

  function acceptTerms() {
    setOpened(true)
    onCheckedChange(true)
    setModal(false)
  }

  function openTerms(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    markOpened()
    setModal(true)
  }

  function openNewTab(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    markOpened()
    window.open(TERMS_PAGE, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      style={{
        margin: '16px 0',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.05)',
        padding: 16,
        position: 'relative',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={openTerms}
          style={{
            borderRadius: 10,
            background: '#FFD94A',
            color: '#07132D',
            border: 'none',
            padding: '12px 16px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Read Terms and Conditions
        </button>
        <button
          type="button"
          onClick={openNewTab}
          style={{
            borderRadius: 10,
            background: 'transparent',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.25)',
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Open in new tab
        </button>
        <a
          href={TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markOpened()}
          style={{
            borderRadius: 10,
            background: 'transparent',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.25)',
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Open PDF
        </a>
      </div>

      {!opened && (
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#FDE68A' }}>
          Open the Terms and Conditions, then confirm below to enable payment.
        </p>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.45,
          cursor: opened ? 'pointer' : 'not-allowed',
          color: opened ? '#fff' : 'rgba(255,255,255,0.4)',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!opened}
          onChange={e => onCheckedChange(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, accentColor: '#FFC933', flexShrink: 0 }}
          aria-describedby="terms-gate-hint"
        />
        <span>I have read and understood the Terms and Conditions.</span>
      </label>
      <p id="terms-gate-hint" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Checkbox enables only after you open the terms.
      </p>

      {opened && !checked && (
        <button
          type="button"
          onClick={acceptTerms}
          style={{
            marginTop: 12,
            width: '100%',
            borderRadius: 10,
            background: 'rgba(255,217,74,0.15)',
            border: '1px solid rgba(255,217,74,0.45)',
            color: '#FFD94A',
            padding: '12px 14px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Confirm I have read the terms
        </button>
      )}

      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Terms and Conditions"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            padding: 12,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.15)',
              background: '#0E204F',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Terms and Conditions</h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.8)',
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '16px 18px', background: '#fff', color: '#111', flex: 1 }}>
              <p style={{ marginTop: 0, fontSize: 14, color: '#444' }}>Please read before confirming a booking.</p>
              <ol style={{ paddingLeft: 20, margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                {TERMS_POINTS.map(point => (
                  <li key={point} style={{ marginBottom: 10 }}>
                    {point}
                  </li>
                ))}
              </ol>
              <p style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
                Full page also at <a href={TERMS_PAGE}>/terms</a> · PDF at <a href={TERMS_URL}>/terms.pdf</a>
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: 8,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px',
              }}
            >
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={markOpened}
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.85)',
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={acceptTerms}
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: '#FFD94A',
                  color: '#07132D',
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                I have read this — enable payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

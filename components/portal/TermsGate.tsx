'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { VisitType } from '@/lib/visit-type'

const WAIVER_PDF: Record<VisitType, string> = {
  general: '/waivers/general-visit.pdf',
  birthday: '/waivers/birthday-visit.pdf',
  school: '/waivers/school-visit.pdf',
}

const WAIVER_LABEL: Record<VisitType, string> = {
  general: 'General Visit Entry Agreement & Risk Release',
  birthday: 'Birthday Visit Entry Agreement & Risk Release',
  school: 'School Visit Entry Agreement & Risk Release',
}

/**
 * Waiver acceptance: viewing the visit PDF inline is required before the checkbox unlocks.
 */
export default function TermsGate({
  checked,
  onCheckedChange,
  visitType = 'general',
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  visitType?: VisitType
}) {
  const pdfHref = WAIVER_PDF[visitType]
  const label = WAIVER_LABEL[visitType]
  const [opened, setOpened] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const prevVisit = useRef(visitType)

  useEffect(() => {
    if (prevVisit.current === visitType) return
    prevVisit.current = visitType
    setOpened(false)
    setViewerOpen(false)
    if (checked) onCheckedChange(false)
  }, [visitType, checked, onCheckedChange])

  function openWaiver(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpened(true)
    setViewerOpen(true)
  }

  function onCheckChange(next: boolean) {
    if (next && !opened) return
    onCheckedChange(next)
  }

  return (
    <div
      style={{
        margin: '14px 0 18px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.05)',
        padding: '14px 16px',
      }}
    >
      {!opened && (
        <p
          style={{
            margin: '0 0 12px',
            color: 'rgba(255,217,74,0.9)',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          Open and read the waiver below before you can accept.
        </p>
      )}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: opened ? 'pointer' : 'not-allowed',
          color: opened ? '#fff' : 'rgba(255,255,255,0.55)',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!opened}
          onChange={e => onCheckChange(e.target.checked)}
          style={{
            marginTop: 3,
            width: 20,
            height: 20,
            accentColor: '#FFC933',
            flexShrink: 0,
            cursor: opened ? 'pointer' : 'not-allowed',
          }}
        />
        <span>
          I confirm that I have read, understood and agree to the{' '}
          <button
            type="button"
            onClick={openWaiver}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#FFD94A',
              textDecoration: 'underline',
              font: 'inherit',
              fontWeight: 'inherit',
              cursor: 'pointer',
            }}
            title={label}
          >
            terms and conditions
          </button>
          .
        </span>
      </label>

      {viewerOpen && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Hide
              </button>
              <a
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}
              >
                Open full screen
              </a>
            </div>
          </div>
          <iframe
            src={`${pdfHref}#toolbar=0&navpanes=0`}
            title={label}
            style={{
              width: '100%',
              height: 'min(420px, 55vh)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              background: '#fff',
            }}
          />
        </div>
      )}
    </div>
  )
}

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
 * Waiver acceptance: opening the visit PDF is required before the checkbox unlocks.
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
  const prevVisit = useRef(visitType)

  useEffect(() => {
    if (prevVisit.current === visitType) return
    prevVisit.current = visitType
    setOpened(false)
    if (checked) onCheckedChange(false)
  }, [visitType, checked, onCheckedChange])

  function openWaiver(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.open(pdfHref, '_blank', 'noopener,noreferrer')
    setOpened(true)
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
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openWaiver}
            style={{ color: '#FFD94A', textDecoration: 'underline' }}
            title={label}
          >
            terms and conditions
          </a>
          .
        </span>
      </label>
    </div>
  )
}

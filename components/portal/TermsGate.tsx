'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { VisitType } from '@/lib/visit-type'

const FALLBACK_PDF: Record<VisitType, string> = {
  general: '/waivers/general-visit.pdf',
  birthday: '/waivers/birthday-visit.pdf',
  school: '/waivers/school-visit.pdf',
}

const FALLBACK_LABEL: Record<VisitType, string> = {
  general: 'General Visit Entry Agreement & Risk Release',
  birthday: 'Birthday Visit Entry Agreement & Risk Release',
  school: 'School Visit Entry Agreement & Risk Release',
}

const DOC_KEY: Record<VisitType, string> = {
  general: 'general_waiver',
  birthday: 'birthday_waiver',
  school: 'school_waiver',
}

/**
 * Waiver acceptance: guest must open the PDF (new tab or on-page preview)
 * before the checkbox unlocks. Checkbox alone is not enough to pay.
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
  const [pdfHref, setPdfHref] = useState(FALLBACK_PDF[visitType])
  const [label, setLabel] = useState(FALLBACK_LABEL[visitType])
  const [opened, setOpened] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const prevVisit = useRef(visitType)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/documents?key=${encodeURIComponent(DOC_KEY[visitType])}`)
        const data = await res.json().catch(() => null)
        if (!alive || !res.ok || !data?.document) return
        if (data.document.public_url) setPdfHref(String(data.document.public_url))
        if (data.document.title) setLabel(String(data.document.title))
      } catch {
        /* keep fallbacks */
      }
    })()
    return () => {
      alive = false
    }
  }, [visitType])

  useEffect(() => {
    if (prevVisit.current === visitType) return
    prevVisit.current = visitType
    setPdfHref(FALLBACK_PDF[visitType])
    setLabel(FALLBACK_LABEL[visitType])
    setOpened(false)
    setViewerOpen(false)
    if (checked) onCheckedChange(false)
  }, [visitType, checked, onCheckedChange])

  function markOpened() {
    setOpened(true)
  }

  function openInNewTab(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    window.open(pdfHref, '_blank', 'noopener,noreferrer')
    markOpened()
  }

  function openPreview() {
    setViewerOpen(true)
    markOpened()
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
          Open the waiver PDF first. Tap <strong>Open document</strong> (or Preview) — the checkbox stays locked until you do.
        </p>
      )}

      <button
        type="button"
        onClick={openInNewTab}
        style={{
          display: 'block',
          width: '100%',
          marginBottom: 12,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(255,217,74,0.45)',
          background: opened ? 'rgba(74,222,128,0.12)' : 'rgba(255,217,74,0.12)',
          color: opened ? '#4ade80' : '#FFD94A',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {opened ? '✓ Document opened — you can accept below' : 'Open document (required)'}
      </button>

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
          onChange={(e) => onCheckChange(e.target.checked)}
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
            onClick={openInNewTab}
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

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button"
          onClick={openPreview}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {viewerOpen ? 'Preview open' : 'Preview on page'}
        </button>
        {viewerOpen && (
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hide preview
          </button>
        )}
      </div>

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
          <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            If the preview shows only a PDF icon, use <strong>Open document</strong> above.
          </p>
        </div>
      )}
    </div>
  )
}

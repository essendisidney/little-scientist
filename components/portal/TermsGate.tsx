'use client'

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
 * Simple one-tap waiver acceptance.
 * Link opens the visit-specific PDF; checkbox alone is enough to continue.
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
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          cursor: 'pointer',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onCheckedChange(e.target.checked)}
          style={{ marginTop: 3, width: 20, height: 20, accentColor: '#FFC933', flexShrink: 0, cursor: 'pointer' }}
        />
        <span>
          I confirm that I have read, understood and agree to the{' '}
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
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

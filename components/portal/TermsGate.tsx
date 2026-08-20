'use client'

const TERMS_PAGE = '/terms'
const TERMS_PDF = '/terms.pdf'

/**
 * Simple one-tap terms acceptance.
 * Link opens the full terms; checkbox alone is enough to continue.
 */
export default function TermsGate({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
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
          I agree to the{' '}
          <a
            href={TERMS_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: '#FFD94A', textDecoration: 'underline' }}
          >
            Terms and Conditions
          </a>
          {' '}
          (tickets are non-refundable or transferable).{' '}
          <a
            href={TERMS_PDF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600 }}
          >
            PDF
          </a>
        </span>
      </label>
    </div>
  )
}

const GENERAL_RULES = [
  'No entry for adults unless accompanied by children.',
  'No entry for minors unless accompanied by adults.',
  'No alcohol or drugs.',
  'Outside food and drinks are not allowed.',
  'No restaurant available on site.',
]

const GROUP_RULES = [
  'No entry for adults unless accompanied by children.',
  'No entry for minors unless accompanied by adults.',
  'No alcohol or drugs.',
  'Food and drinks are the responsibility of the booking party.',
  'No restaurant available on site.',
]

export default function Disclaimers({
  compact = false,
  variant = 'general',
}: {
  compact?: boolean
  /** general = walk-in visitors; group = birthday / school */
  variant?: 'general' | 'group'
}) {
  const rules = variant === 'group' ? GROUP_RULES : GENERAL_RULES

  return (
    <aside
      role="note"
      aria-label="Important visit rules"
      className={`rounded-2xl border-2 border-amber-400/70 bg-amber-400/15 text-amber-50 ${
        compact ? 'px-4 py-4' : 'px-5 py-5 sm:px-6 sm:py-6'
      }`}
    >
      <p
        className={`font-[family-name:var(--font-heading)] font-extrabold tracking-wide text-amber-200 uppercase ${
          compact ? 'mb-2 text-sm' : 'mb-3 text-base sm:text-lg'
        }`}
      >
        Important — please read before booking
      </p>
      <ul className={`space-y-2 font-semibold text-white ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
        {rules.map(rule => (
          <li key={rule} className="flex gap-2 leading-snug">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300" aria-hidden />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

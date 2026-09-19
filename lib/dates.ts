/** Local calendar date key YYYY-MM-DD (avoids UTC off-by-one in EAT). */
export function toLocalDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Africa/Nairobi calendar date YYYY-MM-DD — use for gate / session “today” checks. */
export function todayInNairobi(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

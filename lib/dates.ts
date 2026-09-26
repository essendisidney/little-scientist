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

/** True for today or any later calendar day in Nairobi. No upper limit. */
export function isOnOrAfterNairobiToday(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey >= todayInNairobi()
}

/** Nairobi calendar date and minutes since midnight. */
export function nairobiNow(d = new Date()): { dateKey: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  }
}

/** Add calendar days to a YYYY-MM-DD key without using the machine timezone. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

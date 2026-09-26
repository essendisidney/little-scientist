import { describe, expect, it } from 'vitest'
import { addDaysToDateKey, nairobiNow } from '@/lib/dates'

describe('nairobi dates', () => {
  it('uses Nairobi time after UTC midnight', () => {
    const now = nairobiNow(new Date('2026-09-25T22:30:00.000Z'))
    expect(now.dateKey).toBe('2026-09-26')
    expect(now.minutes).toBe(90)
  })

  it('adds calendar days without shifting the date key', () => {
    expect(addDaysToDateKey('2026-09-26', 12)).toBe('2026-10-08')
  })
})

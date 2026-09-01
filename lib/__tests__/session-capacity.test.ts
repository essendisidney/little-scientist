import { describe, expect, it } from 'vitest'
import { sessionOpenSpots } from '@/lib/session-capacity'

describe('sessionOpenSpots', () => {
  it('subtracts booked, held, and pending', () => {
    expect(
      sessionOpenSpots({
        capacity: 100,
        booked_count: 40,
        held_count: 5,
        pending_count: 10,
        is_blocked: false,
      }),
    ).toBe(45)
  })

  it('returns 0 when blocked', () => {
    expect(sessionOpenSpots({ capacity: 100, booked_count: 0, is_blocked: true })).toBe(0)
  })

  it('never returns negative', () => {
    expect(
      sessionOpenSpots({
        capacity: 10,
        booked_count: 8,
        held_count: 2,
        pending_count: 5,
      }),
    ).toBe(0)
  })
})

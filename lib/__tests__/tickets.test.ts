import { describe, expect, it } from 'vitest'
import { buildTicketRows } from '../ticket-rows'
import { todayInNairobi } from '../dates'

describe('buildTicketRows', () => {
  it('issues adult and child tickets for general visits', () => {
    const rows = buildTicketRows({
      id: 'b1',
      adult_count: 2,
      child_count: 1,
      infant_count: 1,
      booking_kind: 'general',
    })
    expect(rows).toEqual([
      { booking_id: 'b1', ticket_type: 'Adult' },
      { booking_id: 'b1', ticket_type: 'Adult' },
      { booking_id: 'b1', ticket_type: 'Child' },
    ])
  })

  it('issues under-95cm tickets for birthday infants', () => {
    const rows = buildTicketRows({
      id: 'b2',
      adult_count: 1,
      child_count: 0,
      infant_count: 2,
      booking_kind: 'birthday',
    })
    expect(rows.filter((r) => r.ticket_type === 'Child under 95cm')).toHaveLength(2)
  })
})

describe('todayInNairobi', () => {
  it('returns YYYY-MM-DD', () => {
    expect(todayInNairobi()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

import { supabaseAdmin } from '@/lib/supabase'
import { bookingHeadcount, confirmSessionBooking } from '@/lib/session-pending'
import { buildTicketRows, type BookingTicketSource } from '@/lib/ticket-rows'

export type { BookingTicketSource }
export { buildTicketRows }

/**
 * Ensure tickets exist for a paid booking. Idempotent: skips insert if any tickets already exist.
 * Optionally bumps session booked_count when creating tickets for the first time.
 */
export async function ensureTicketsIssued(
  booking: BookingTicketSource,
  opts?: { confirmCapacity?: boolean },
): Promise<{ issued: number; alreadyHad: number }> {
  const { data: existing, error: listErr } = await supabaseAdmin
    .from('tickets')
    .select('ticket_type')
    .eq('booking_id', booking.id)

  if (listErr) throw new Error(`Failed to list tickets: ${listErr.message}`)

  const remaining = new Map<string, number>()
  for (const ticket of existing || []) {
    const type = String(ticket.ticket_type || '')
    remaining.set(type, (remaining.get(type) || 0) + 1)
  }

  const missing: { booking_id: string; ticket_type: string }[] = []
  for (const row of buildTicketRows(booking)) {
    const left = remaining.get(row.ticket_type) || 0
    if (left > 0) remaining.set(row.ticket_type, left - 1)
    else missing.push(row)
  }

  const alreadyHad = (existing || []).length
  if (!missing.length) return { issued: 0, alreadyHad }

  const { error } = await supabaseAdmin.from('tickets').insert(missing)
  if (error) throw new Error(`Failed to issue tickets: ${error.message}`)

  // Only the first issue confirms capacity. Later gap-fills must not double-count the session.
  if (alreadyHad === 0 && opts?.confirmCapacity !== false && booking.session_id) {
    await confirmSessionBooking(String(booking.session_id), bookingHeadcount(booking))
  }

  return { issued: missing.length, alreadyHad }
}

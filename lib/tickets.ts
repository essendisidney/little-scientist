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
  const { count } = await supabaseAdmin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', booking.id)

  const alreadyHad = count || 0
  if (alreadyHad > 0) return { issued: 0, alreadyHad }

  const rows = buildTicketRows(booking)
  if (!rows.length) return { issued: 0, alreadyHad: 0 }

  const { error } = await supabaseAdmin.from('tickets').insert(rows)
  if (error) throw new Error(`Failed to issue tickets: ${error.message}`)

  if (opts?.confirmCapacity !== false && booking.session_id) {
    await confirmSessionBooking(String(booking.session_id), bookingHeadcount(booking))
  }

  return { issued: rows.length, alreadyHad: 0 }
}

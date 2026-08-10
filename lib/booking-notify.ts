import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingTicketsEmail } from '@/lib/email'

function emailFromBooking(booking: Record<string, unknown>): string | null {
  const meta = booking.party_meta
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>
    const candidates = [m.email, m.contactEmail, m.guardianEmail]
    for (const c of candidates) {
      const s = String(c || '').trim()
      if (s.includes('@')) return s
    }
  }
  return null
}

/** Fire-and-forget safe: never throws to caller settlement path. */
export async function notifyBookingPaid(bookingId: string, mpesaReceipt?: string | null) {
  try {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, sessions(session_date, time_slot)')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking || booking.payment_status !== 'paid') return

    const to = emailFromBooking(booking as Record<string, unknown>)
    if (!to) return

    const session = booking.sessions as { session_date?: string; time_slot?: string } | null
    await sendBookingTicketsEmail({
      to,
      bookingRef: String(booking.booking_ref),
      bookerName: booking.booker_name ? String(booking.booker_name) : null,
      sessionDate: session?.session_date || null,
      timeSlot: session?.time_slot || null,
      adultCount: Number(booking.adult_count || 0),
      childCount: Number(booking.child_count || 0),
      totalKes: Number(booking.total_amount_kes || 0),
      mpesaReceipt: mpesaReceipt || null,
    })
  } catch (err) {
    console.error('notifyBookingPaid failed', err instanceof Error ? err.message : err)
  }
}

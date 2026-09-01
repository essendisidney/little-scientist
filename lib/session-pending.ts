import { supabaseAdmin } from '@/lib/supabase'
import { partyHeadcount, type PartyCounts } from '@/lib/booking-party'

export function bookingHeadcount(booking: {
  adult_count?: number | null
  child_count?: number | null
  infant_count?: number | null
}): number {
  return partyHeadcount({
    adults: Number(booking.adult_count || 0),
    children: Number(booking.child_count || 0),
    infants: Number(booking.infant_count || 0),
  })
}

export function partyToHeadcount(party: PartyCounts): number {
  return partyHeadcount(party)
}

export async function reserveSessionPending(sessionId: string, count: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('reserve_session_pending', {
    p_session_id: sessionId,
    p_count: count,
  })
  if (error) {
    console.error('reserve_session_pending failed', error.message)
    return false
  }
  return Boolean(data)
}

export async function releaseSessionPending(sessionId: string, count: number): Promise<void> {
  const { error } = await supabaseAdmin.rpc('release_session_pending', {
    p_session_id: sessionId,
    p_count: count,
  })
  if (error) console.error('release_session_pending failed', error.message)
}

export async function confirmSessionBooking(sessionId: string, count: number): Promise<void> {
  const { error } = await supabaseAdmin.rpc('confirm_session_booking', {
    p_session_id: sessionId,
    p_count: count,
  })
  if (error) console.error('confirm_session_booking failed', error.message)
}

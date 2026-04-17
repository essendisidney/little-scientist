import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('qr_code, is_used, used_at, ticket_type, bookings(booking_ref, booker_name, adult_count, child_count, payment_status, sessions(session_date, time_slot))')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tickets = (data || [])
    .map((t: any) => {
      const b = t.bookings
      const s = b?.sessions
      return {
        qr: t.qr_code,
        isUsed: Boolean(t.is_used),
        usedAt: t.used_at || null,
        type: t.ticket_type,
        bookingRef: b?.booking_ref || null,
        bookerName: b?.booker_name || null,
        adultCount: b?.adult_count ?? 0,
        childCount: b?.child_count ?? 0,
        paymentStatus: b?.payment_status || null,
        sessionDate: s?.session_date || null,
        timeSlot: s?.time_slot || null,
      }
    })
    .filter(t => t.qr && t.paymentStatus === 'paid' && t.sessionDate === today)

  return NextResponse.json({ today, tickets })
}


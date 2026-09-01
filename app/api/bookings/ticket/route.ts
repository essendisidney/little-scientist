import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { reconcileBookingFromKcb } from '@/lib/kcb/service'

/**
 * GET /api/bookings/ticket?ref=LST-...
 * Public ticket page data — avoids anon Supabase RLS mismatch.
 */
export async function GET(req: NextRequest) {
  try {
    const ref = String(req.nextUrl.searchParams.get('ref') || '')
      .trim()
      .toUpperCase()
    if (!ref) {
      return NextResponse.json({ error: 'Missing booking ref' }, { status: 400 })
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_ref, booker_name, adult_count, child_count, infant_count, total_amount_kes, payment_status, booking_kind, sessions(session_date, time_slot)')
      .eq('booking_ref', ref)
      .maybeSingle()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    let paymentStatus = String(booking.payment_status || 'pending')
    if (paymentStatus === 'pending' || paymentStatus === 'processing') {
      const reconciled = await reconcileBookingFromKcb(booking.id)
      if (reconciled.ok && reconciled.status === 'paid') {
        paymentStatus = 'paid'
      }
    }

    let tickets: unknown[] = []
    if (paymentStatus === 'paid') {
      const { data: tix } = await supabaseAdmin
        .from('tickets')
        .select('id, ticket_type, qr_code, is_used, used_at')
        .eq('booking_id', booking.id)
        .order('ticket_type')
      tickets = tix || []
    }

    return NextResponse.json({
      booking: { ...booking, payment_status: paymentStatus },
      tickets,
    })
  } catch (err) {
    console.error('ticket lookup error', err)
    return NextResponse.json({ error: 'Could not load ticket' }, { status: 500 })
  }
}

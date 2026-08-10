import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { reconcileBookingFromKcb } from '@/lib/kcb/service'

/**
 * GET /api/bookings/status?ref=LST-...
 * Returns payment_status; if still pending, attempts KCB reconcile (missed IPN).
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
      .select('id, booking_ref, payment_status')
      .eq('booking_ref', ref)
      .maybeSingle()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    let status = String(booking.payment_status || 'pending')
    if (status === 'pending' || status === 'processing') {
      const reconciled = await reconcileBookingFromKcb(booking.id)
      if (reconciled.ok && reconciled.status === 'paid') {
        status = 'paid'
      }
    }

    return NextResponse.json({
      bookingRef: booking.booking_ref,
      paymentStatus: status,
    })
  } catch (err) {
    console.error('booking status error', err)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}

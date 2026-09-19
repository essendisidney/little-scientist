import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { reconcileBookingFromKcb } from '@/lib/kcb/service'
import { ensureTicketsIssued } from '@/lib/tickets'

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
      .select(
        'id, booking_ref, booker_name, adult_count, child_count, infant_count, total_amount_kes, payment_status, booking_kind, session_id, sessions(session_date, time_slot)',
      )
      .eq('booking_ref', ref)
      .maybeSingle()

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    let paymentStatus = String(booking.payment_status || 'pending')
    let ticketsError: string | null = null

    if (paymentStatus === 'pending' || paymentStatus === 'processing') {
      // KCB missed-IPN recovery
      const reconciled = await reconcileBookingFromKcb(booking.id).catch(() => null)
      if (reconciled?.ok && reconciled.status === 'paid') {
        paymentStatus = 'paid'
      } else {
        // Daraja: completed payment row but booking still pending
        const { data: pay } = await supabaseAdmin
          .from('payments')
          .select('id, status, mpesa_receipt_number')
          .eq('booking_id', booking.id)
          .eq('status', 'completed')
          .order('settled_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (pay) {
          try {
            await ensureTicketsIssued({
              id: booking.id,
              adult_count: booking.adult_count,
              child_count: booking.child_count,
              infant_count: booking.infant_count,
              booking_kind: booking.booking_kind,
              session_id: booking.session_id,
            })
            await supabaseAdmin
              .from('bookings')
              .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', booking.id)
              .neq('payment_status', 'paid')
            paymentStatus = 'paid'
          } catch (e) {
            ticketsError = e instanceof Error ? e.message : 'Could not issue tickets'
          }
        }
      }
    }

    let tickets: unknown[] = []
    if (paymentStatus === 'paid') {
      try {
        await ensureTicketsIssued({
          id: booking.id,
          adult_count: booking.adult_count,
          child_count: booking.child_count,
          infant_count: booking.infant_count,
          booking_kind: booking.booking_kind,
          session_id: booking.session_id,
        })
      } catch (e) {
        ticketsError = e instanceof Error ? e.message : 'Could not issue tickets'
      }

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
      ...(ticketsError ? { ticketsError } : {}),
    })
  } catch (err) {
    console.error('ticket lookup error', err)
    return NextResponse.json({ error: 'Could not load ticket' }, { status: 500 })
  }
}

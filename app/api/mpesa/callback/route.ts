import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMpesaCallback } from '@/lib/mpesa'
import { postTicketPayment } from '@/lib/accounting'
import { notifyBookingPaid } from '@/lib/booking-notify'
import { ensureTicketsIssued } from '@/lib/tickets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseMpesaCallback(body)
    if (!parsed) return NextResponse.json({ ok: true })

    const { success, checkoutRequestId, mpesaReceiptNumber, resultDesc } = parsed

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, bookings(*)')
      .eq('mpesa_checkout_request_id', checkoutRequestId)
      .single()

    if (!payment) return NextResponse.json({ ok: true })

    const booking = payment.bookings as Record<string, unknown>

    if (success && mpesaReceiptNumber) {
      // Idempotent: already paid → ensure tickets only, skip double GL/capacity.
      if (booking.payment_status === 'paid') {
        await ensureTicketsIssued({
          id: String(booking.id),
          adult_count: booking.adult_count as number,
          child_count: booking.child_count as number,
          infant_count: (booking as { infant_count?: number }).infant_count,
          booking_kind: (booking as { booking_kind?: string }).booking_kind,
          session_id: booking.session_id as string,
        })
        return NextResponse.json({ ok: true })
      }

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'completed',
          mpesa_receipt_number: mpesaReceiptNumber,
          settled_at: new Date().toISOString(),
          raw_callback: body,
        })
        .eq('id', payment.id)

      await ensureTicketsIssued({
        id: String(booking.id),
        adult_count: booking.adult_count as number,
        child_count: booking.child_count as number,
        infant_count: (booking as { infant_count?: number }).infant_count,
        booking_kind: (booking as { booking_kind?: string }).booking_kind,
        session_id: booking.session_id as string,
      })

      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      await supabaseAdmin.from('etr_receipts').insert({
        booking_id: booking.id,
        payment_id: payment.id,
        receipt_number: `LST-${Date.now()}`,
        amount_kes: booking.total_amount_kes,
        source_type: 'booking',
        source_id: booking.id,
      })

      const bookingKind = String((booking as { booking_kind?: string }).booking_kind || 'general')
      await postTicketPayment({
        bookingId: booking.id as string,
        ticketAmountKes: booking.total_amount_kes as number,
        platformFeeKes: 0,
        mpesaReceipt: mpesaReceiptNumber,
        bookingKind,
      })

      await supabaseAdmin.from('audit_log').insert({
        action: 'PAYMENT_CONFIRMED',
        entity: 'bookings',
        entity_id: booking.id,
        performed_by: 'system',
        metadata: {
          mpesa_receipt: mpesaReceiptNumber,
          amount: booking.total_amount_kes,
        },
      })

      await notifyBookingPaid(booking.id as string, mpesaReceiptNumber)
    } else {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: resultDesc,
          raw_callback: body,
        })
        .eq('id', payment.id)

      await supabaseAdmin
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', payment.booking_id)
        .eq('payment_status', 'pending')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.json({ ok: true })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMpesaCallback } from '@/lib/mpesa'
import { postTicketPayment } from '@/lib/accounting'

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

    if (success && mpesaReceiptNumber) {
      const booking = payment.bookings as Record<string, unknown>

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'completed',
          mpesa_receipt_number: mpesaReceiptNumber,
          settled_at: new Date().toISOString(),
          raw_callback: body,
        })
        .eq('id', payment.id)

      await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      const tickets = []
      for (let i = 0; i < (booking.adult_count as number); i++) {
        tickets.push({ booking_id: booking.id, ticket_type: 'Adult' })
      }
      for (let i = 0; i < (booking.child_count as number); i++) {
        tickets.push({ booking_id: booking.id, ticket_type: 'Child' })
      }
      await supabaseAdmin.from('tickets').insert(tickets)

      await supabaseAdmin
        .from('sessions')
        .update({
          booked_count: (booking.adult_count as number) + (booking.child_count as number),
        })
        .eq('id', booking.session_id)

      await supabaseAdmin.from('etr_receipts').insert({
        booking_id: booking.id,
        payment_id: payment.id,
        receipt_number: `LST-${Date.now()}`,
        amount_kes: booking.total_amount_kes,
        source_type: 'booking',
        source_id: booking.id,
      })

      await postTicketPayment({
        bookingId: booking.id as string,
        ticketAmountKes: booking.total_amount_kes as number,
        platformFeeKes: 0,
        mpesaReceipt: mpesaReceiptNumber,
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
    } else {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: resultDesc,
          raw_callback: body,
        })
        .eq('id', payment.id)

      await supabaseAdmin.from('bookings').update({ payment_status: 'failed' }).eq('id', payment.booking_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.json({ ok: true })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'
import { ensureTicketsIssued } from '@/lib/tickets'
import { postTicketPayment } from '@/lib/accounting'
import { notifyBookingPaid } from '@/lib/booking-notify'
import { sanitizePayload } from '@/lib/kcb/persistence'

/**
 * Admin booking ops:
 * POST { action: 'mark_paid' | 'reissue_tickets' | 'reset_ticket', bookingRef, ticketId?, note? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin'])
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const action = String(body?.action || '')
    const bookingRef = String(body?.bookingRef || '')
      .trim()
      .toUpperCase()

    if (!bookingRef) {
      return NextResponse.json({ error: 'bookingRef required' }, { status: 400 })
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('booking_ref', bookingRef)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    if (action === 'mark_paid') {
      const note = String(body?.note || 'Manual mark paid by admin').slice(0, 200)
      const receipt = String(body?.receipt || `MANUAL-${Date.now()}`).slice(0, 40)

      if (booking.payment_status !== 'paid') {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .insert({
            booking_id: booking.id,
            payment_channel: 'mpesa',
            amount_kes: booking.total_amount_kes,
            mpesa_receipt_number: receipt,
            mpesa_phone: booking.booker_phone,
            status: 'completed',
            settled_at: new Date().toISOString(),
            raw_callback: sanitizePayload({ note, by: auth.staffId }),
          })
          .select('id')
          .single()

        const issued = await ensureTicketsIssued(booking)

        await supabaseAdmin
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: 'manual',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)

        if (payment?.id) {
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
            mpesaReceipt: receipt,
            bookingKind: String(booking.booking_kind || 'general'),
          })
        }

        await notifyBookingPaid(booking.id as string, receipt).catch(() => {})

        await supabaseAdmin.from('audit_log').insert({
          action: 'BOOKING_MARK_PAID',
          entity: 'bookings',
          entity_id: booking.id,
          performed_by: auth.staffId,
          metadata: { note, receipt, tickets_issued: issued.issued },
        })

        const { data: tickets } = await supabaseAdmin
          .from('tickets')
          .select('id, ticket_type, qr_code, is_used')
          .eq('booking_id', booking.id)

        return NextResponse.json({
          ok: true,
          action,
          bookingRef,
          ticketsIssued: issued.issued,
          tickets: tickets || [],
        })
      }

      const issued = await ensureTicketsIssued(booking)
      const { data: tickets } = await supabaseAdmin
        .from('tickets')
        .select('id, ticket_type, qr_code, is_used')
        .eq('booking_id', booking.id)

      return NextResponse.json({
        ok: true,
        action,
        bookingRef,
        alreadyPaid: true,
        ticketsIssued: issued.issued,
        tickets: tickets || [],
      })
    }

    if (action === 'reissue_tickets') {
      if (booking.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Booking must be paid before issuing tickets' }, { status: 400 })
      }

      const issued = await ensureTicketsIssued(booking)
      const { data: tickets } = await supabaseAdmin
        .from('tickets')
        .select('id, ticket_type, qr_code, is_used, used_at')
        .eq('booking_id', booking.id)
        .order('ticket_type')

      await supabaseAdmin.from('audit_log').insert({
        action: 'TICKETS_REISSUED',
        entity: 'bookings',
        entity_id: booking.id,
        performed_by: auth.staffId,
        metadata: { tickets_issued: issued.issued, already_had: issued.alreadyHad },
      })

      return NextResponse.json({
        ok: true,
        action,
        bookingRef,
        ticketsIssued: issued.issued,
        alreadyHad: issued.alreadyHad,
        tickets: tickets || [],
      })
    }

    if (action === 'reset_ticket') {
      const ticketId = String(body?.ticketId || '')
      if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 })

      const { data: ticket } = await supabaseAdmin
        .from('tickets')
        .select('id, booking_id, is_used')
        .eq('id', ticketId)
        .eq('booking_id', booking.id)
        .maybeSingle()

      if (!ticket) return NextResponse.json({ error: 'Ticket not found on this booking' }, { status: 404 })

      await supabaseAdmin
        .from('tickets')
        .update({ is_used: false, used_at: null, used_by: null })
        .eq('id', ticketId)

      await supabaseAdmin.from('audit_log').insert({
        action: 'TICKET_RESET',
        entity: 'tickets',
        entity_id: ticketId,
        performed_by: auth.staffId,
        metadata: { booking_ref: bookingRef },
      })

      return NextResponse.json({ ok: true, action, ticketId, bookingRef })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('admin booking action error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 },
    )
  }
}

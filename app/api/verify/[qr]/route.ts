import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'
import { todayInNairobi } from '@/lib/dates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ qr: string }> }) {
  const auth = await requireStaff(req, ['admin', 'gate'])
  if ('error' in auth) return auth.error

  const staffId = auth.staffId
  try {
    const { qr: rawQr } = await params
    const qr = decodeURIComponent(rawQr).trim()

    async function audit(action: string, entityId: string | null, metadata: Record<string, unknown>) {
      try {
        await supabaseAdmin.from('audit_log').insert({
          action,
          entity: 'tickets',
          entity_id: entityId,
          performed_by: staffId || 'gate',
          metadata: { qr, ...metadata },
        })
      } catch {
        // ignore audit failures
      }
    }

    // Direct QR lookup, or booking_ref → first unused ticket for today.
    let ticket: Record<string, unknown> | null = null

    const { data: byQr } = await supabaseAdmin
      .from('tickets')
      .select('*, bookings(*, sessions(*))')
      .eq('qr_code', qr)
      .maybeSingle()

    if (byQr) {
      ticket = byQr as Record<string, unknown>
    } else {
      const ref = qr.toUpperCase()
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, booking_ref, payment_status, booker_name, adult_count, child_count, sessions(session_date, time_slot)')
        .eq('booking_ref', ref)
        .maybeSingle()

      if (booking) {
        const today = todayInNairobi()
        const session = booking.sessions as { session_date?: string; time_slot?: string } | null
        if (booking.payment_status !== 'paid') {
          await audit('TICKET_SCAN_REJECTED', null, { reason: 'payment_not_confirmed', booking_ref: ref })
          return NextResponse.json({ valid: false, message: 'Payment not confirmed.' }, { status: 402 })
        }
        if (session?.session_date !== today) {
          await audit('TICKET_SCAN_REJECTED', null, {
            reason: 'wrong_date',
            session_date: session?.session_date,
            today,
            booking_ref: ref,
          })
          return NextResponse.json(
            { valid: false, message: `Booking is for ${session?.session_date || 'another day'}, not today.` },
            { status: 400 },
          )
        }

        const { data: bookingTickets } = await supabaseAdmin
          .from('tickets')
          .select('*, bookings(*, sessions(*))')
          .eq('booking_id', booking.id)
          .eq('is_used', false)
          .order('ticket_type')

        if (!bookingTickets?.length) {
          await audit('TICKET_SCAN_REJECTED', null, { reason: 'no_unused_tickets', booking_ref: ref })
          return NextResponse.json(
            { valid: false, message: 'No unused tickets left for this booking.' },
            { status: 409 },
          )
        }

        // If multiple unused, return list so gate can pick; if one, admit that one.
        if (bookingTickets.length > 1) {
          return NextResponse.json({
            valid: false,
            needsSelection: true,
            message: `Booking ${ref} has ${bookingTickets.length} unused tickets. Scan a QR or pick one.`,
            tickets: bookingTickets.map((t) => ({
              qr: t.qr_code,
              type: t.ticket_type,
              id: t.id,
            })),
            bookingRef: ref,
            bookerName: booking.booker_name,
          })
        }

        ticket = bookingTickets[0] as Record<string, unknown>
      }
    }

    if (!ticket) {
      await audit('TICKET_SCAN_REJECTED', null, { reason: 'not_found' })
      return NextResponse.json({ valid: false, message: 'Ticket not found.' }, { status: 404 })
    }

    if (ticket.is_used) {
      await audit('TICKET_SCAN_REJECTED', String(ticket.id), {
        reason: 'already_used',
        used_at: ticket.used_at || null,
      })
      return NextResponse.json(
        { valid: false, message: `Already used at ${new Date(String(ticket.used_at)).toLocaleString('en-KE')}` },
        { status: 409 },
      )
    }

    const booking = ticket.bookings as Record<string, unknown>
    if (booking.payment_status !== 'paid') {
      await audit('TICKET_SCAN_REJECTED', String(ticket.id), {
        reason: 'payment_not_confirmed',
        payment_status: booking.payment_status,
      })
      return NextResponse.json({ valid: false, message: 'Payment not confirmed.' }, { status: 402 })
    }

    const session = booking.sessions as Record<string, unknown>
    const today = todayInNairobi()
    if (session.session_date !== today) {
      await audit('TICKET_SCAN_REJECTED', String(ticket.id), {
        reason: 'wrong_date',
        session_date: session.session_date,
        today,
      })
      return NextResponse.json(
        { valid: false, message: `Ticket is for ${session.session_date}, not today.` },
        { status: 400 },
      )
    }

    // Time window validation (EAT): allow entry 30 minutes before start to 30 minutes after end
    const timeSlot = String(session.time_slot || '')
    const m = timeSlot.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
    if (m) {
      const sh = parseInt(m[1], 10)
      const sm = parseInt(m[2], 10)
      const eh = parseInt(m[3], 10)
      const em = parseInt(m[4], 10)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em
      const windowStart = startMin - 30
      const windowEnd = endMin + 30

      const nowUtc = new Date()
      const nowEat = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000)
      const nowMin = nowEat.getUTCHours() * 60 + nowEat.getUTCMinutes()

      if (nowMin < windowStart || nowMin > windowEnd) {
        await audit('TICKET_SCAN_REJECTED', String(ticket.id), { reason: 'outside_time_window', time_slot: timeSlot })
        return NextResponse.json(
          {
            valid: false,
            message: `This ticket is for the ${timeSlot} session. Please arrive within your booked session time.`,
          },
          { status: 400 },
        )
      }
    }

    // Atomic claim — prevents double-admit from two devices.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('tickets')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by: staffId || 'gate',
      })
      .eq('id', ticket.id)
      .eq('is_used', false)
      .select('id')
      .maybeSingle()

    if (claimErr || !claimed) {
      await audit('TICKET_SCAN_REJECTED', String(ticket.id), { reason: 'already_used_race' })
      return NextResponse.json({ valid: false, message: 'Ticket was just used by another gate.' }, { status: 409 })
    }

    await supabaseAdmin.from('audit_log').insert({
      action: 'TICKET_SCANNED',
      entity: 'tickets',
      entity_id: ticket.id,
      performed_by: staffId || 'gate',
      metadata: {
        booking_ref: booking.booking_ref,
        ticket_type: ticket.ticket_type,
        session: `${session.session_date} ${session.time_slot}`,
      },
    })

    return NextResponse.json({
      valid: true,
      message: 'Welcome to Little Scientist!',
      ticket: {
        type: ticket.ticket_type,
        bookingRef: booking.booking_ref,
        session: `${session.session_date} ${session.time_slot}`,
        bookerName: booking.booker_name,
        adultCount: booking.adult_count,
        childCount: booking.child_count,
        infantCount: Number(booking.infant_count || 0),
      },
    })
  } catch (err) {
    console.error('Verify error:', err)
    try {
      await supabaseAdmin.from('audit_log').insert({
        action: 'TICKET_SCAN_ERROR',
        entity: 'tickets',
        entity_id: null,
        performed_by: staffId || 'gate',
        metadata: { error: err instanceof Error ? err.message : String(err) },
      })
    } catch {}
    return NextResponse.json({ valid: false, message: 'Verification error. Try again.' }, { status: 500 })
  }
}

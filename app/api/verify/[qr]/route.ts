import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ qr: string }> }) {
  let staffId = 'gate'
  try {
    staffId = (await req.json().catch(() => ({ staffId: 'gate' }))).staffId || 'gate'
    const { qr: rawQr } = await params
    const qr = decodeURIComponent(rawQr)

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

    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select('*, bookings(*, sessions(*))')
      .eq('qr_code', qr)
      .single()

    if (!ticket) {
      await audit('TICKET_SCAN_REJECTED', null, { reason: 'not_found' })
      return NextResponse.json({ valid: false, message: 'Ticket not found.' }, { status: 404 })
    }

    if (ticket.is_used) {
      await audit('TICKET_SCAN_REJECTED', ticket.id, { reason: 'already_used', used_at: ticket.used_at || null })
      return NextResponse.json(
        { valid: false, message: `Already used at ${new Date(ticket.used_at).toLocaleString('en-KE')}` },
        { status: 409 }
      )
    }

    const booking = ticket.bookings as Record<string, unknown>
    if (booking.payment_status !== 'paid') {
      await audit('TICKET_SCAN_REJECTED', ticket.id, { reason: 'payment_not_confirmed', payment_status: booking.payment_status })
      return NextResponse.json({ valid: false, message: 'Payment not confirmed.' }, { status: 402 })
    }

    const session = booking.sessions as Record<string, unknown>
    const today = new Date().toISOString().split('T')[0]
    if (session.session_date !== today) {
      await audit('TICKET_SCAN_REJECTED', ticket.id, { reason: 'wrong_date', session_date: session.session_date, today })
      return NextResponse.json({ valid: false, message: `Ticket is for ${session.session_date}, not today.` }, { status: 400 })
    }

    // Time window validation (EAT, UTC+3): allow entry 30 minutes before start to 30 minutes after end
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
        await audit('TICKET_SCAN_REJECTED', ticket.id, { reason: 'outside_time_window', time_slot: timeSlot })
        return NextResponse.json(
          {
            valid: false,
            message: `This ticket is for the ${timeSlot} session. Please arrive within your booked session time.`,
          },
          { status: 400 }
        )
      }
    }

    await supabaseAdmin
      .from('tickets')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        used_by: staffId || 'gate',
      })
      .eq('id', ticket.id)

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

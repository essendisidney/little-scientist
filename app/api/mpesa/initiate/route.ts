import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'

const ADULT_PRICE = 500
const CHILD_PRICE = 300

export async function POST(req: NextRequest) {
  try {
    const { sessionId, phone, name, adultCount, childCount } = await req.json()

    if (!sessionId || !phone || adultCount < 1 || childCount < 1) {
      return NextResponse.json(
        { error: 'Invalid request. Must have at least 1 adult and 1 child.' },
        { status: 400 }
      )
    }

    const { data: session } = await supabaseAdmin.from('sessions').select('*').eq('id', sessionId).single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.is_blocked) return NextResponse.json({ error: 'This session is not available' }, { status: 409 })
    if (session.booked_count + adultCount + childCount > session.capacity) {
      return NextResponse.json({ error: 'Not enough spots in this session' }, { status: 409 })
    }

    const sessionDate = new Date(session.session_date)
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 14)
    if (sessionDate > maxDate) {
      return NextResponse.json({ error: 'Cannot book more than 14 days ahead' }, { status: 400 })
    }

    const total = adultCount * ADULT_PRICE + childCount * CHILD_PRICE

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        session_id: sessionId,
        booker_phone: phone,
        booker_name: name || null,
        adult_count: adultCount,
        child_count: childCount,
        total_amount_kes: total,
        platform_fee_kes: 0,
        payment_method: 'mpesa',
        payment_status: 'pending',
      })
      .select()
      .single()

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`

    const stk = await initiateSTKPush({
      phone,
      amount: total,
      reference: booking.booking_ref,
      description: 'LS Tickets',
      callbackUrl,
    })

    await supabaseAdmin.from('payments').insert({
      booking_id: booking.id,
      payment_channel: 'mpesa',
      amount_kes: total,
      mpesa_checkout_request_id: stk.checkoutRequestId,
      mpesa_merchant_request_id: stk.merchantRequestId,
      mpesa_phone: phone,
      status: 'processing',
    })

    return NextResponse.json({
      success: true,
      bookingRef: booking.booking_ref,
      bookingId: booking.id,
      checkoutRequestId: stk.checkoutRequestId,
    })
  } catch (err) {
    console.error('Initiate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment initiation failed' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 })

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      *,
      sessions(session_date, time_slot),
      in_venue_purchases(
        id, purchase_ref, category, description,
        total_kes, payment_status, created_at
      )
    `
    )
    .eq('booking_ref', ref.toUpperCase())
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json({ booking })
}

export async function POST(req: NextRequest) {
  try {
    const { bookingRef, category, description, quantity, unitPriceKes, staffId } = await req.json()

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, booker_phone, payment_status, booking_ref')
      .eq('booking_ref', bookingRef.toUpperCase())
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Booking not paid' }, { status: 402 })
    }

    const totalKes = Math.round(unitPriceKes * quantity * 100) / 100

    const { data: purchase } = await supabaseAdmin
      .from('in_venue_purchases')
      .insert({
        booking_id: booking.id,
        category,
        description,
        quantity,
        unit_price_kes: unitPriceKes,
        total_kes: totalKes,
        payment_status: 'pending',
        served_by: staffId || null,
      })
      .select()
      .single()

    if (!purchase) return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 })

    const callbackUrl =
      process.env.MPESA_INVENUE_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/invenue/callback`

    const stk = await initiateSTKPush({
      phone: booking.booker_phone,
      amount: totalKes,
      reference: purchase.purchase_ref,
      description: description.slice(0, 13),
      callbackUrl,
    })

    await supabaseAdmin
      .from('in_venue_purchases')
      .update({ mpesa_checkout_request_id: stk.checkoutRequestId })
      .eq('id', purchase.id)

    return NextResponse.json({
      success: true,
      purchaseRef: purchase.purchase_ref,
      purchaseId: purchase.id,
      phone: booking.booker_phone,
      totalKes,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

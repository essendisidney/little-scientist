import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'

export async function POST(req: NextRequest) {
  try {
    const { bookingRef, productId, quantity, unitPrice } = await req.json()

    if (!bookingRef || !productId || !quantity || !unitPrice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const qty = Number(quantity)
    const unit = Number(unitPrice)
    if (!Number.isFinite(qty) || qty < 1) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    if (!Number.isFinite(unit) || unit < 0) return NextResponse.json({ error: 'Invalid unit price' }, { status: 400 })

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_ref, booker_phone, payment_status')
      .eq('booking_ref', String(bookingRef).toUpperCase())
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Booking not paid' }, { status: 402 })
    }

    const totalKes = Math.round(unit * qty * 100) / 100

    const { data: order, error: oErr } = await supabaseAdmin
      .from('merch_orders')
      .insert({
        booking_id: booking.id,
        order_type: 'pos',
        status: 'pending',
        amount_kes: totalKes,
        product_id: productId,
        quantity: qty,
        unit_price_kes: unit,
      })
      .select()
      .single()

    if (oErr || !order) return NextResponse.json({ error: oErr?.message || 'Failed to create order' }, { status: 500 })

    const callbackUrl =
      process.env.MPESA_MERCH_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/merch/callback`

    const stk = await initiateSTKPush({
      phone: booking.booker_phone,
      amount: totalKes,
      reference: order.id,
      description: 'Merch POS',
      callbackUrl,
    })

    await supabaseAdmin
      .from('merch_orders')
      .update({ mpesa_checkout_request_id: stk.checkoutRequestId, mpesa_merchant_request_id: stk.merchantRequestId })
      .eq('id', order.id)

    return NextResponse.json({
      success: true,
      orderId: order.id,
      checkoutRequestId: stk.checkoutRequestId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate merch payment' },
      { status: 500 }
    )
  }
}


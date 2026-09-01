import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'
import { requireStaff } from '@/lib/admin-auth'
import { createAndSendKcbPayment } from '@/lib/kcb/service'
import { isKcbConfigured } from '@/lib/kcb/config'
import { toPublicError } from '@/lib/kcb/errors'
import { useKcbPayments } from '@/lib/payment-provider'
import { normalizeKenyaPhone } from '@/lib/phone'
import { sanitizeGuestError } from '@/lib/guest-errors'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  try {
    const { bookingRef, productId, quantity, unitPrice } = await req.json()

    if (!bookingRef || !productId || !quantity || unitPrice == null) {
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

    let phone: string
    try {
      phone = normalizeKenyaPhone(String(booking.booker_phone))
    } catch {
      return NextResponse.json({ error: 'Booking has an invalid M-Pesa number.' }, { status: 400 })
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

    const provider = (process.env.PAYMENT_PROVIDER || (isKcbConfigured() ? 'kcb' : 'daraja')).toLowerCase()
    const useKcb = useKcbPayments()

    if (useKcb) {
      if (!isKcbConfigured()) {
        return NextResponse.json({ error: 'KCB payment gateway is not configured' }, { status: 503 })
      }

      try {
        const kcb = await createAndSendKcbPayment({
          amount: totalKes,
          phoneNumber: phone,
          reference: String(order.id).slice(0, 24),
          description: 'LS Merch',
          idempotencyKey: `merch:${order.id}`,
          sourceType: 'merch_order',
          sourceId: order.id,
        })

        await supabaseAdmin
          .from('merch_orders')
          .update({
            mpesa_checkout_request_id: kcb.payment.kcb_reference,
            mpesa_merchant_request_id: kcb.payment.merchant_request_id || null,
          })
          .eq('id', order.id)

        return NextResponse.json({
          success: true,
          orderId: order.id,
          checkoutRequestId: kcb.payment.kcb_reference,
          provider: 'kcb',
        })
      } catch (kcbErr) {
        if (provider === 'kcb') {
          const pub = toPublicError(kcbErr)
          return NextResponse.json({ error: pub.error }, { status: pub.status })
        }
        console.error('KCB merch initiate failed, falling back to Daraja:', kcbErr instanceof Error ? kcbErr.message : kcbErr)
      }
    }

    const callbackUrl =
      process.env.MPESA_MERCH_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/merch/callback`

    const stk = await initiateSTKPush({
      phone: booking.booker_phone,
      amount: totalKes,
      reference: order.id,
      description: 'LS Merch',
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
      provider: 'daraja',
    })
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeGuestError(err instanceof Error ? err.message : 'Failed to initiate merch payment') },
      { status: 500 },
    )
  }
}

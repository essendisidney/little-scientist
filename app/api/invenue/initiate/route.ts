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

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 })

  const selectBooking = `
      *,
      sessions(session_date, time_slot),
      in_venue_purchases(
        id, purchase_ref, category, description,
        total_kes, payment_status, created_at
      )
    `

  const { data: byRef } = await supabaseAdmin
    .from('bookings')
    .select(selectBooking)
    .eq('booking_ref', ref.toUpperCase())
    .single()

  if (byRef) return NextResponse.json({ booking: byRef })

  const { data: t } = await supabaseAdmin
    .from('tickets')
    .select(`booking_id, bookings(${selectBooking})`)
    .eq('qr_code', ref)
    .single()

  const booking = (t as { bookings?: unknown })?.bookings || null

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json({ booking })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  try {
    const { bookingRef, category, description, quantity, unitPriceKes } = await req.json()
    const staffId = auth.staffId

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, booker_phone, payment_status, booking_ref')
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

    const totalKes = Math.round(Number(unitPriceKes) * Number(quantity) * 100) / 100
    if (!Number.isFinite(totalKes) || totalKes < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

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

    const stkDescription = String(description || 'LS In-venue').slice(0, 13)
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
          reference: purchase.purchase_ref,
          description: stkDescription,
          idempotencyKey: `invenue:${purchase.id}`,
          sourceType: 'in_venue_purchase',
          sourceId: purchase.id,
        })

        await supabaseAdmin
          .from('in_venue_purchases')
          .update({ mpesa_checkout_request_id: kcb.payment.kcb_reference })
          .eq('id', purchase.id)

        await supabaseAdmin.from('audit_log').insert({
          action: 'INVENUE_PAYMENT_INITIATED',
          entity: 'in_venue_purchases',
          entity_id: purchase.id,
          performed_by: staffId,
          metadata: { provider: 'kcb_buni', purchase_ref: purchase.purchase_ref, amount: totalKes },
        })

        return NextResponse.json({
          success: true,
          purchaseRef: purchase.purchase_ref,
          purchaseId: purchase.id,
          phone: booking.booker_phone,
          totalKes,
          provider: 'kcb',
          checkoutRequestId: kcb.payment.kcb_reference,
        })
      } catch (kcbErr) {
        if (provider === 'kcb') {
          const pub = toPublicError(kcbErr)
          return NextResponse.json({ error: pub.error }, { status: pub.status })
        }
        console.error('KCB in-venue initiate failed, falling back to Daraja:', kcbErr instanceof Error ? kcbErr.message : kcbErr)
      }
    }

    const callbackUrl =
      process.env.MPESA_INVENUE_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/invenue/callback`

    const stk = await initiateSTKPush({
      phone: booking.booker_phone,
      amount: totalKes,
      reference: purchase.purchase_ref,
      description: stkDescription,
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
      provider: 'daraja',
      checkoutRequestId: stk.checkoutRequestId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeGuestError(err instanceof Error ? err.message : 'Failed') },
      { status: 500 },
    )
  }
}

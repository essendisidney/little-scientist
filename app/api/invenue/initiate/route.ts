import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'
import { requireStaff } from '@/lib/admin-auth'
import { createAndSendKcbPayment, reconcileInVenueFromKcb } from '@/lib/kcb/service'
import { isKcbConfigured } from '@/lib/kcb/config'
import { toPublicError } from '@/lib/kcb/errors'
import { useKcbPayments } from '@/lib/payment-provider'
import { normalizeKenyaPhone } from '@/lib/phone'
import { sanitizeGuestError } from '@/lib/guest-errors'

export const maxDuration = 60

const selectBooking = `
  *,
  sessions(session_date, time_slot),
  in_venue_purchases(
    id, purchase_ref, category, description,
    total_kes, payment_status, created_at, mpesa_receipt_number
  )
`

async function refreshPendingPurchases(booking: Record<string, unknown>) {
  const purchases = (booking.in_venue_purchases || []) as { id: string; payment_status: string }[]
  for (const p of purchases.filter((x) => x.payment_status === 'pending')) {
    await reconcileInVenueFromKcb(p.id).catch(() => {})
  }
  const { data: refreshed } = await supabaseAdmin
    .from('bookings')
    .select(selectBooking)
    .eq('id', booking.id as string)
    .single()
  return refreshed || booking
}

async function findBookingByQuery(raw: string) {
  const q = raw.trim()
  if (!q) return null

  // 1) Booking ref
  const { data: byRef } = await supabaseAdmin
    .from('bookings')
    .select(selectBooking)
    .eq('booking_ref', q.toUpperCase())
    .maybeSingle()
  if (byRef) return byRef

  // 2) Ticket QR
  const { data: t } = await supabaseAdmin
    .from('tickets')
    .select(`booking_id, bookings(${selectBooking})`)
    .eq('qr_code', q)
    .maybeSingle()
  const fromTicket = (t as { bookings?: Record<string, unknown> } | null)?.bookings
  if (fromTicket) return fromTicket

  // 3) M-Pesa receipt on payments
  const { data: pay } = await supabaseAdmin
    .from('payments')
    .select('booking_id')
    .ilike('mpesa_receipt_number', q)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pay?.booking_id) {
    const { data: b } = await supabaseAdmin.from('bookings').select(selectBooking).eq('id', pay.booking_id).maybeSingle()
    if (b) return b
  }

  // 4) M-Pesa receipt on in-venue purchases
  const { data: inv } = await supabaseAdmin
    .from('in_venue_purchases')
    .select('booking_id')
    .ilike('mpesa_receipt_number', q)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (inv?.booking_id) {
    const { data: b } = await supabaseAdmin.from('bookings').select(selectBooking).eq('id', inv.booking_id).maybeSingle()
    if (b) return b
  }

  // 5) KCB payment requests receipt in response payload is harder; match kcb_reference / phone as last resort
  const { data: kcb } = await supabaseAdmin
    .from('kcb_payment_requests')
    .select('source_type, source_id, status')
    .eq('status', 'SUCCESS')
    .or(`kcb_reference.ilike.%${q}%,internal_reference.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (kcb?.source_type === 'booking' && kcb.source_id) {
    const { data: b } = await supabaseAdmin.from('bookings').select(selectBooking).eq('id', kcb.source_id).maybeSingle()
    if (b) return b
  }

  return null
}

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  const ref = req.nextUrl.searchParams.get('ref')
  const purchaseId = req.nextUrl.searchParams.get('purchaseId')

  if (purchaseId) {
    await reconcileInVenueFromKcb(purchaseId).catch(() => {})
    const { data: purchase } = await supabaseAdmin.from('in_venue_purchases').select('*').eq('id', purchaseId).maybeSingle()
    if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    return NextResponse.json({ purchase })
  }

  if (!ref) return NextResponse.json({ error: 'ref or purchaseId required' }, { status: 400 })

  const booking = await findBookingByQuery(ref)
  if (!booking) {
    return NextResponse.json(
      {
        error:
          'Booking not found. Try booking ref (LST-…), ticket QR, or M-Pesa receipt. For walk-up merch, use Walk-up sale.',
      },
      { status: 404 },
    )
  }

  const refreshed = await refreshPendingPurchases(booking as Record<string, unknown>)
  return NextResponse.json({ booking: refreshed })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const {
      bookingRef,
      category,
      description,
      quantity,
      unitPriceKes,
      walkUp,
      phone: walkUpPhone,
      customerName,
    } = body as Record<string, unknown>
    const staffId = auth.staffId

    let bookingId: string | null = null
    let bookerPhone: string
    let displayPhone: string

    if (walkUp || (!bookingRef && walkUpPhone)) {
      try {
        bookerPhone = normalizeKenyaPhone(String(walkUpPhone || ''))
        displayPhone = bookerPhone
      } catch {
        return NextResponse.json(
          { error: 'Enter a valid Kenyan mobile for walk-up STK (07… / 01… / 254…).' },
          { status: 400 },
        )
      }
    } else {
      if (!bookingRef) {
        return NextResponse.json(
          { error: 'Provide a booking ref, or use walk-up with a phone number.' },
          { status: 400 },
        )
      }

      const booking = await findBookingByQuery(String(bookingRef))
      if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      if ((booking as { payment_status?: string }).payment_status !== 'paid') {
        return NextResponse.json({ error: 'Booking not paid' }, { status: 402 })
      }

      bookingId = String((booking as { id: string }).id)
      displayPhone = String((booking as { booker_phone: string }).booker_phone)
      try {
        bookerPhone = normalizeKenyaPhone(displayPhone)
      } catch {
        return NextResponse.json({ error: 'Booking has an invalid M-Pesa number.' }, { status: 400 })
      }
    }

    const totalKes = Math.round(Number(unitPriceKes) * Number(quantity) * 100) / 100
    if (!Number.isFinite(totalKes) || totalKes < 1) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const insertRow: Record<string, unknown> = {
      booking_id: bookingId,
      category: String(category || 'other'),
      description: String(description || (walkUp ? `Walk-up: ${customerName || displayPhone}` : 'In-venue')),
      quantity: Number(quantity) || 1,
      unit_price_kes: Number(unitPriceKes),
      total_kes: totalKes,
      payment_status: 'pending',
      served_by: staffId || null,
    }

    const { data: purchase, error: pErr } = await supabaseAdmin
      .from('in_venue_purchases')
      .insert(insertRow)
      .select()
      .single()

    if (pErr || !purchase) {
      // booking_id may be NOT NULL on older schemas — create a soft walk-up booking shell
      if (!bookingId && /null value|booking_id/i.test(pErr?.message || '')) {
        return NextResponse.json(
          {
            error:
              'Walk-up sales need a DB update (booking_id nullable). Apply migration 016, or look up any paid booking temporarily.',
          },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: pErr?.message || 'Failed to create purchase' }, { status: 500 })
    }

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
          phoneNumber: bookerPhone,
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
          metadata: {
            provider: 'kcb_buni',
            purchase_ref: purchase.purchase_ref,
            amount: totalKes,
            walk_up: Boolean(walkUp || !bookingId),
            phone: bookerPhone,
          },
        })

        return NextResponse.json({
          success: true,
          purchaseRef: purchase.purchase_ref,
          purchaseId: purchase.id,
          phone: displayPhone,
          totalKes,
          provider: 'kcb',
          walkUp: Boolean(walkUp || !bookingId),
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
      phone: bookerPhone,
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
      phone: displayPhone,
      totalKes,
      provider: 'daraja',
      walkUp: Boolean(walkUp || !bookingId),
      checkoutRequestId: stk.checkoutRequestId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeGuestError(err instanceof Error ? err.message : 'Failed') },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'
import { normalizeParty, partyHeadcount, validatePaidCheckout } from '@/lib/booking-party'
import { parseVisitType } from '@/lib/visit-type'
import { BIRTHDAY_PRICING } from '@/lib/pricing'

const DEFAULT_ADULT_PRICE = 1000
const DEFAULT_CHILD_PRICE = 800
const DEFAULT_INFANT_PRICE = 0
const MIN_DAYS = 0
const MAX_DAYS = 12

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionId = body?.sessionId
    const phone = body?.phone
    const name = body?.name
    const bookingKind = parseVisitType(body?.bookingKind)
    const partyMeta = body?.partyMeta && typeof body.partyMeta === 'object' ? body.partyMeta : null

    if (body?.exclusive === true || body?.sessionPreference === 'exclusive' || body?.sessionType === 'exclusive') {
      return NextResponse.json(
        { error: 'Exclusive sessions are request-only. Please submit an enquiry instead of paying online.' },
        { status: 400 },
      )
    }

    const party = normalizeParty({
      adults: parseInt(String(body?.adultCount ?? '0'), 10) || 0,
      children: parseInt(String(body?.childCount ?? '0'), 10) || 0,
      infants: parseInt(String(body?.infantCount ?? '0'), 10) || 0,
    })
    const adultCount = party.adults
    const childCount = party.children
    const infantCount = party.infants

    if (!sessionId || !phone) {
      return NextResponse.json(
        { error: 'Please select a session and enter your M-Pesa number.' },
        { status: 400 },
      )
    }

    if (bookingKind === 'birthday') {
      const email = String((partyMeta as { email?: string } | null)?.email || body?.email || '').trim()
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Enter the parent / guardian name.' }, { status: 400 })
      }
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Enter a valid parent / guardian email.' }, { status: 400 })
      }
    }

    let adultPrice = DEFAULT_ADULT_PRICE
    let childPrice = DEFAULT_CHILD_PRICE
    let infantPrice = DEFAULT_INFANT_PRICE

    if (bookingKind === 'birthday') {
      adultPrice = BIRTHDAY_PRICING.adult18PlusKes
      childPrice = BIRTHDAY_PRICING.child95cmTo17Kes
      infantPrice = BIRTHDAY_PRICING.childUnder95cmKes
    } else {
      const { data: tiers } = await supabaseAdmin
        .from('pricing_tiers')
        .select('key, price_kes, active')
        .eq('active', true)
        .in('key', ['adult', 'child', 'infant'])

      adultPrice = (tiers || []).find((t: any) => t.key === 'adult')?.price_kes ?? DEFAULT_ADULT_PRICE
      childPrice = (tiers || []).find((t: any) => t.key === 'child')?.price_kes ?? DEFAULT_CHILD_PRICE
      infantPrice = (tiers || []).find((t: any) => t.key === 'infant')?.price_kes ?? DEFAULT_INFANT_PRICE
    }

    const total =
      adultCount * Number(adultPrice) + childCount * Number(childPrice) + infantCount * Number(infantPrice)

    const partyCheck = validatePaidCheckout(party, total)
    if (!partyCheck.ok) {
      return NextResponse.json({ error: partyCheck.message }, { status: 400 })
    }

    const { data: session } = await supabaseAdmin.from('sessions').select('*').eq('id', sessionId).single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.is_blocked) return NextResponse.json({ error: 'This session is not available' }, { status: 409 })
    if (session.booked_count + partyHeadcount(party) > session.capacity) {
      return NextResponse.json({ error: 'Not enough spots in this session' }, { status: 409 })
    }

    const sessionDate = new Date(session.session_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() + MIN_DAYS)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS)
    if (sessionDate < minDate) return NextResponse.json({ error: 'Selected date is not bookable yet' }, { status: 400 })
    if (sessionDate > maxDate) return NextResponse.json({ error: 'Cannot book more than 12 days ahead' }, { status: 400 })

    const bookingPayload: Record<string, unknown> = {
      session_id: sessionId,
      booker_phone: phone,
      booker_name: name || null,
      adult_count: adultCount,
      child_count: childCount,
      infant_count: infantCount,
      booking_kind: bookingKind,
      party_meta: partyMeta,
      total_amount_kes: total,
      platform_fee_kes: 0,
      payment_method: 'mpesa',
      payment_status: 'pending',
    }

    let { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .insert(bookingPayload)
      .select()
      .single()

    if (bErr && /(infant_count|booking_kind|party_meta)/i.test(bErr.message || '')) {
      const retry = { ...bookingPayload }
      if (/infant_count/i.test(bErr.message || '')) {
        delete retry.infant_count
        if (childCount === 0 && infantCount > 0) {
          return NextResponse.json(
            {
              error:
                'Under-95cm tickets need the infant_count database update. Apply migration 006_booking_infant_count.sql.',
            },
            { status: 400 },
          )
        }
      }
      if (/booking_kind|party_meta/i.test(bErr.message || '')) {
        delete retry.booking_kind
        delete retry.party_meta
      }
      ;({ data: booking, error: bErr } = await supabaseAdmin.from('bookings').insert(retry).select().single())
    }

    if (bErr || !booking) {
      return NextResponse.json({ error: bErr?.message || 'Failed to create booking' }, { status: 500 })
    }

    const stkDescription =
      bookingKind === 'birthday' ? 'LS Birthday' : bookingKind === 'school' ? 'LS School Trip' : 'LS Tickets'

    const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`

    const stk = await initiateSTKPush({
      phone,
      amount: total,
      reference: booking.booking_ref,
      description: stkDescription,
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

    await supabaseAdmin.from('audit_log').insert({
      action: 'PAYMENT_INITIATED',
      entity: 'bookings',
      entity_id: booking.id,
      performed_by: 'public',
      metadata: { booking_kind: bookingKind, party_meta: partyMeta },
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
      { status: 500 },
    )
  }
}

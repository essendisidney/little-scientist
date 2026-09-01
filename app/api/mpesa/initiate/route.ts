import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initiateSTKPush } from '@/lib/mpesa'
import { normalizeParty, partyHeadcount, validatePaidCheckout } from '@/lib/booking-party'
import { parseVisitType } from '@/lib/visit-type'
import { BIRTHDAY_PRICING } from '@/lib/pricing'
import { sessionOpenSpots } from '@/lib/session-capacity'
import { createAndSendKcbPayment } from '@/lib/kcb/service'
import { isKcbConfigured } from '@/lib/kcb/config'
import { normalizeKenyaPhone } from '@/lib/phone'
import { sanitizeGuestError } from '@/lib/guest-errors'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const DEFAULT_ADULT_PRICE = 1000
const DEFAULT_CHILD_PRICE = 800
const DEFAULT_INFANT_PRICE = 0
const MIN_DAYS = 0
const MAX_DAYS = 12

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'mpesa-initiate', { limit: 12, windowMs: 60_000 })
    if (limited) return limited

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

    try {
      normalizeKenyaPhone(String(phone))
    } catch {
      return NextResponse.json(
        { error: 'Enter a valid Kenyan mobile number (07… / 01… / 254…).' },
        { status: 400 },
      )
    }

    const existingRef = String(body?.existingBookingRef || body?.bookingRef || '')
      .trim()
      .toUpperCase()
    const RETRYABLE = new Set(['pending', 'processing', 'failed', 'cancelled', 'canceled', 'timeout', 'expired'])

    if (bookingKind === 'birthday') {
      const email = String((partyMeta as { email?: string } | null)?.email || body?.email || '').trim()
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Enter the parent / guardian name.' }, { status: 400 })
      }
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Enter a valid parent / guardian email.' }, { status: 400 })
      }
    }

    if (bookingKind === 'general') {
      const email = String((partyMeta as { email?: string } | null)?.email || body?.email || '').trim()
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Enter a valid email — we send your ticket link there.' }, { status: 400 })
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
    if (partyHeadcount(party) > sessionOpenSpots(session)) {
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

    let booking: Record<string, unknown> | null = null
    let bErr: { message?: string } | null = null

    if (existingRef) {
      const { data: existing, error: findErr } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('booking_ref', existingRef)
        .maybeSingle()

      if (findErr || !existing) {
        return NextResponse.json({ error: 'Booking not found. Start a new payment.' }, { status: 404 })
      }
      const status = String(existing.payment_status || '').toLowerCase()
      if (status === 'paid') {
        return NextResponse.json({ error: 'This booking is already paid.' }, { status: 409 })
      }
      if (!RETRYABLE.has(status)) {
        return NextResponse.json({ error: 'This booking cannot be retried. Please start again.' }, { status: 409 })
      }
      if (String(existing.session_id) !== String(sessionId)) {
        return NextResponse.json({ error: 'Session changed — please start a new booking.' }, { status: 409 })
      }

      const { data: updated, error: upErr } = await supabaseAdmin
        .from('bookings')
        .update({
          booker_phone: phone,
          booker_name: name || null,
          payment_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (upErr || !updated) {
        return NextResponse.json({ error: sanitizeGuestError(upErr?.message || 'Could not retry payment') }, { status: 500 })
      }
      booking = updated as Record<string, unknown>
    } else {
      ;({ data: booking, error: bErr } = await supabaseAdmin
        .from('bookings')
        .insert(bookingPayload)
        .select()
        .single())

      if (bErr && /(infant_count|booking_kind|party_meta)/i.test(bErr.message || '')) {
        const retry = { ...bookingPayload }
        if (/infant_count/i.test(bErr.message || '')) {
          delete retry.infant_count
          if (childCount === 0 && infantCount > 0) {
            return NextResponse.json(
              {
                error:
                  'Free under-95cm bookings need a database update. Please call 0700 101 425.',
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
        const msg = bErr?.message || 'Failed to create booking'
        if (/adult_with_child/i.test(msg)) {
          return NextResponse.json(
            {
              error:
                'Adult + free under-95cm bookings are temporarily blocked. Please retry shortly or add a paid child ticket.',
            },
            { status: 500 },
          )
        }
        return NextResponse.json({ error: sanitizeGuestError(msg) }, { status: 500 })
      }
    }

    const bookingId = String(booking.id)
    const bookingRef = String(booking.booking_ref)

    const stkDescription =
      bookingKind === 'birthday' ? 'LS Birthday' : bookingKind === 'school' ? 'LS School Trip' : 'LS Tickets'

    // Prefer KCB BUNI when configured. Empty/auto falls back to Daraja only if KCB is not configured
    // or explicitly PAYMENT_PROVIDER=auto|daraja. Force kcb with PAYMENT_PROVIDER=kcb (no Daraja fallback).
    const provider = (process.env.PAYMENT_PROVIDER || (isKcbConfigured() ? 'kcb' : 'daraja')).toLowerCase()
    const useKcb =
      provider === 'kcb' || (provider === 'auto' && isKcbConfigured())

    if (useKcb) {
      if (!isKcbConfigured()) {
        return NextResponse.json({ error: 'KCB payment gateway is not configured' }, { status: 503 })
      }

      try {
        const kcb = await createAndSendKcbPayment({
          amount: total,
          phoneNumber: phone,
          reference: bookingRef,
          description: stkDescription,
          idempotencyKey: `booking:${bookingId}`,
          sourceType: 'booking',
          sourceId: bookingId,
        })

        await supabaseAdmin.from('payments').insert({
          booking_id: bookingId,
          payment_channel: 'kcb_buni',
          amount_kes: total,
          mpesa_checkout_request_id: kcb.payment.kcb_reference,
          mpesa_merchant_request_id: kcb.payment.merchant_request_id || null,
          mpesa_phone: phone,
          status: 'processing',
        })

        await supabaseAdmin.from('audit_log').insert({
          action: 'PAYMENT_INITIATED',
          entity: 'bookings',
          entity_id: bookingId,
          performed_by: 'public',
          metadata: { booking_kind: bookingKind, party_meta: partyMeta, provider: 'kcb_buni' },
        })

        return NextResponse.json({
          success: true,
          bookingRef,
          bookingId,
          checkoutRequestId: kcb.payment.kcb_reference,
          provider: 'kcb',
        })
      } catch (kcbErr) {
        // If KCB fails and Daraja is available, fall back so guests can still pay.
        const hasDaraja = Boolean(
          process.env.MPESA_CONSUMER_KEY?.trim() &&
            process.env.MPESA_CONSUMER_SECRET?.trim() &&
            process.env.MPESA_SHORTCODE?.trim() &&
            process.env.MPESA_PASSKEY?.trim(),
        )
        if (!hasDaraja || provider === 'kcb') {
          throw kcbErr
        }
        console.error('KCB initiate failed, falling back to Daraja:', kcbErr instanceof Error ? kcbErr.message : kcbErr)
      }
    }

    const callbackUrl = process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`

    const stk = await initiateSTKPush({
      phone,
      amount: total,
      reference: bookingRef,
      description: stkDescription,
      callbackUrl,
    })

    await supabaseAdmin.from('payments').insert({
      booking_id: bookingId,
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
      entity_id: bookingId,
      performed_by: 'public',
      metadata: { booking_kind: bookingKind, party_meta: partyMeta, provider: 'daraja' },
    })

    return NextResponse.json({
      success: true,
      bookingRef,
      bookingId,
      checkoutRequestId: stk.checkoutRequestId,
      provider: 'daraja',
    })
  } catch (err) {
    console.error('Initiate error:', err)
    const message = sanitizeGuestError(
      err instanceof Error && err.message
        ? err.message
        : 'Payment initiation failed. Please try again or call 0700 101 425.',
    )
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

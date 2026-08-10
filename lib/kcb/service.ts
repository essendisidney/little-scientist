import { supabaseAdmin } from '@/lib/supabase'
import {
  initiateKcbStkPush,
  mapToKcbStkRequest,
  parseKcbStkCallback,
  validateInitiateInput,
} from '@/lib/kcb/mpesa-express'
import { getKcbConfig } from '@/lib/kcb/config'
import { KcbApiError, KcbValidationError } from '@/lib/kcb/errors'
import { logKcbApiCall, newInternalReference, sanitizePayload } from '@/lib/kcb/persistence'
import type { AppMpesaInitiateInput, KcbPaymentStatus, ParsedKcbCallback } from '@/lib/kcb/types'
import { postTicketPayment } from '@/lib/accounting'
import { notifyBookingPaid } from '@/lib/booking-notify'

type PaymentRow = {
  id: string
  internal_reference: string
  kcb_reference: string | null
  merchant_request_id?: string | null
  status: KcbPaymentStatus
  amount: number
  phone_number: string
  source_type: string | null
  source_id: string | null
}

export async function createAndSendKcbPayment(input: AppMpesaInitiateInput) {
  const validated = validateInitiateInput(input)
  const config = getKcbConfig()

  if (validated.idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('kcb_payment_requests')
      .select('*')
      .eq('idempotency_key', validated.idempotencyKey)
      .maybeSingle()

    if (existing) {
      return {
        duplicate: true as const,
        payment: existing as PaymentRow,
      }
    }
  }

  const internalReference = newInternalReference('KCB')
  const stkBody = mapToKcbStkRequest(validated)

  const { data: pending, error: insertErr } = await supabaseAdmin
    .from('kcb_payment_requests')
    .insert({
      internal_reference: internalReference,
      amount: validated.amount,
      currency: 'KES',
      phone_number: validated.phoneNumber,
      description: validated.description,
      status: 'PENDING',
      idempotency_key: validated.idempotencyKey || null,
      source_type: validated.sourceType || null,
      source_id: validated.sourceId || null,
      request_payload: sanitizePayload(stkBody),
    })
    .select('*')
    .single()

  if (insertErr || !pending) {
    if (validated.idempotencyKey && /duplicate|unique/i.test(insertErr?.message || '')) {
      const { data: existing } = await supabaseAdmin
        .from('kcb_payment_requests')
        .select('*')
        .eq('idempotency_key', validated.idempotencyKey)
        .maybeSingle()
      if (existing) return { duplicate: true as const, payment: existing as PaymentRow }
    }
    throw new KcbApiError('Failed to create payment request', 500, insertErr?.message)
  }

  try {
    const started = Date.now()
    const result = await initiateKcbStkPush(stkBody)
    await logKcbApiCall({
      endpoint: config.mpesaExpressUrl,
      method: 'POST',
      requestReference: internalReference,
      responseStatus: 200,
      durationMs: result.durationMs || Date.now() - started,
    })

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('kcb_payment_requests')
      .update({
        status: 'PROCESSING',
        kcb_reference: result.checkoutRequestId,
        merchant_request_id: result.merchantRequestId || null,
        response_payload: sanitizePayload(result.accept),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending.id)
      .select('*')
      .single()

    if (updErr || !updated) {
      throw new KcbApiError('Payment accepted by KCB but failed to update local record', 500)
    }

    await supabaseAdmin.from('kcb_payment_events').insert({
      payment_request_id: pending.id,
      event_type: 'STK_ACCEPTED',
      external_reference: result.checkoutRequestId,
      payload: sanitizePayload(result.accept),
      processed: true,
      processed_at: new Date().toISOString(),
    })

    return { duplicate: false as const, payment: updated as PaymentRow }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'KCB initiate failed'
    const code = err instanceof KcbApiError || err instanceof KcbValidationError ? err.code : 'KCB_API'
    await supabaseAdmin
      .from('kcb_payment_requests')
      .update({
        status: 'FAILED',
        error_code: code,
        error_message: message,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', pending.id)

    await logKcbApiCall({
      endpoint: config.mpesaExpressUrl,
      method: 'POST',
      requestReference: internalReference,
      responseStatus: err instanceof KcbApiError ? err.status : 500,
      errorCode: code,
    })

    throw err
  }
}

function statusFromCallback(parsed: ParsedKcbCallback): KcbPaymentStatus {
  if (parsed.success) return 'SUCCESS'
  if (parsed.cancelled) return 'CANCELLED'
  if (parsed.timedOut) return 'TIMEOUT'
  return 'FAILED'
}

export async function processKcbCallback(rawBody: unknown) {
  const parsed = parseKcbStkCallback(rawBody)
  if (!parsed) {
    return { ok: false as const, reason: 'malformed' as const }
  }

  const { data: payment } = await supabaseAdmin
    .from('kcb_payment_requests')
    .select('*')
    .eq('kcb_reference', parsed.checkoutRequestId)
    .maybeSingle()

  if (!payment) {
    return { ok: false as const, reason: 'unknown_reference' as const, parsed }
  }

  const eventType = parsed.success
    ? 'CALLBACK_SUCCESS'
    : parsed.cancelled
      ? 'CALLBACK_CANCELLED'
      : parsed.timedOut
        ? 'CALLBACK_TIMEOUT'
        : 'CALLBACK_FAILED'

  const externalRef = `${parsed.checkoutRequestId}:${parsed.resultCode}:${parsed.mpesaReceiptNumber || 'none'}`

  const { data: existingEvent } = await supabaseAdmin
    .from('kcb_payment_events')
    .select('id, processed')
    .eq('payment_request_id', payment.id)
    .eq('event_type', eventType)
    .eq('external_reference', externalRef)
    .maybeSingle()

  if (existingEvent?.processed) {
    return { ok: true as const, duplicate: true as const, paymentId: payment.id, status: payment.status as KcbPaymentStatus }
  }

  if (!existingEvent) {
    await supabaseAdmin.from('kcb_payment_events').insert({
      payment_request_id: payment.id,
      event_type: eventType,
      external_reference: externalRef,
      payload: sanitizePayload(rawBody),
      processed: false,
    })
  }

  // Already terminal — record event but do not re-settle
  if (['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(payment.status)) {
    await supabaseAdmin
      .from('kcb_payment_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('payment_request_id', payment.id)
      .eq('external_reference', externalRef)

    return { ok: true as const, duplicate: true as const, paymentId: payment.id, status: payment.status as KcbPaymentStatus }
  }

  const nextStatus = statusFromCallback(parsed)
  const now = new Date().toISOString()

  await supabaseAdmin
    .from('kcb_payment_requests')
    .update({
      status: nextStatus,
      error_code: parsed.success ? null : String(parsed.resultCode),
      error_message: parsed.success ? null : parsed.resultDesc,
      updated_at: now,
      completed_at: now,
      response_payload: sanitizePayload(rawBody),
    })
    .eq('id', payment.id)
    .eq('status', 'PROCESSING')

  await supabaseAdmin
    .from('kcb_payment_events')
    .update({ processed: true, processed_at: now })
    .eq('payment_request_id', payment.id)
    .eq('external_reference', externalRef)

  if (parsed.success && payment.source_type === 'booking' && payment.source_id && parsed.mpesaReceiptNumber) {
    await settleBookingFromKcb({
      bookingId: payment.source_id,
      amount: Number(payment.amount),
      mpesaReceipt: parsed.mpesaReceiptNumber,
      checkoutRequestId: parsed.checkoutRequestId,
      rawBody,
    })
  } else if (!parsed.success && payment.source_type === 'booking' && payment.source_id) {
    const bookingStatus = parsed.cancelled ? 'cancelled' : parsed.timedOut ? 'timeout' : 'failed'
    await supabaseAdmin
      .from('bookings')
      .update({ payment_status: bookingStatus, updated_at: now })
      .eq('id', payment.source_id)
      .eq('payment_status', 'pending')

    await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: parsed.resultDesc || bookingStatus,
        raw_callback: sanitizePayload(rawBody),
      })
      .eq('mpesa_checkout_request_id', parsed.checkoutRequestId)
  }

  return { ok: true as const, duplicate: false as const, paymentId: payment.id, status: nextStatus }
}

async function settleBookingFromKcb(p: {
  bookingId: string
  amount: number
  mpesaReceipt: string
  checkoutRequestId: string
  rawBody: unknown
}) {
  const { data: booking } = await supabaseAdmin.from('bookings').select('*').eq('id', p.bookingId).maybeSingle()
  if (!booking) return
  if (booking.payment_status === 'paid') return

  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('mpesa_checkout_request_id', p.checkoutRequestId)
    .maybeSingle()

  let paymentId = existingPayment?.id as string | undefined
  if (!paymentId) {
    const { data: inserted } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: booking.id,
        payment_channel: 'kcb_buni',
        amount_kes: p.amount,
        mpesa_checkout_request_id: p.checkoutRequestId,
        mpesa_receipt_number: p.mpesaReceipt,
        mpesa_phone: booking.booker_phone,
        status: 'completed',
        settled_at: new Date().toISOString(),
        raw_callback: sanitizePayload(p.rawBody),
      })
      .select('id')
      .single()
    paymentId = inserted?.id
  } else {
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        mpesa_receipt_number: p.mpesaReceipt,
        settled_at: new Date().toISOString(),
        raw_callback: sanitizePayload(p.rawBody),
      })
      .eq('id', paymentId)
  }

  await supabaseAdmin
    .from('bookings')
    .update({ payment_status: 'paid', payment_method: 'mpesa', updated_at: new Date().toISOString() })
    .eq('id', booking.id)

  const { count } = await supabaseAdmin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', booking.id)

  if (!count) {
    const tickets = []
    for (let i = 0; i < (booking.adult_count as number); i++) tickets.push({ booking_id: booking.id, ticket_type: 'Adult' })
    for (let i = 0; i < (booking.child_count as number); i++) tickets.push({ booking_id: booking.id, ticket_type: 'Child' })
    const infantCount = Number(booking.infant_count || 0) || 0
    const bookingKind = String(booking.booking_kind || 'general')
    if (bookingKind === 'birthday' && infantCount > 0) {
      for (let i = 0; i < infantCount; i++) tickets.push({ booking_id: booking.id, ticket_type: 'Child under 95cm' })
    }
    if (tickets.length) await supabaseAdmin.from('tickets').insert(tickets)

    const addCount = (booking.adult_count as number) + (booking.child_count as number) + infantCount
    const { data: sessionRow } = await supabaseAdmin
      .from('sessions')
      .select('booked_count')
      .eq('id', booking.session_id)
      .single()
    const nextBooked = (sessionRow?.booked_count || 0) + addCount
    await supabaseAdmin.from('sessions').update({ booked_count: nextBooked }).eq('id', booking.session_id)
  }

  if (paymentId) {
    await supabaseAdmin.from('etr_receipts').insert({
      booking_id: booking.id,
      payment_id: paymentId,
      receipt_number: `LST-${Date.now()}`,
      amount_kes: booking.total_amount_kes,
      source_type: 'booking',
      source_id: booking.id,
    })
  }

  await postTicketPayment({
    bookingId: booking.id as string,
    ticketAmountKes: booking.total_amount_kes as number,
    platformFeeKes: 0,
    mpesaReceipt: p.mpesaReceipt,
    bookingKind: String(booking.booking_kind || 'general'),
  })

  await notifyBookingPaid(booking.id as string, p.mpesaReceipt)
}

/** If KCB already SUCCESS but booking still pending (missed IPN), settle now. */
export async function reconcileBookingFromKcb(bookingId: string) {
  const { data: booking } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (!booking) return { ok: false as const, reason: 'not_found' as const }
  if (booking.payment_status === 'paid') return { ok: true as const, status: 'paid' as const, already: true as const }

  const { data: kcbPay } = await supabaseAdmin
    .from('kcb_payment_requests')
    .select('*')
    .eq('source_type', 'booking')
    .eq('source_id', bookingId)
    .eq('status', 'SUCCESS')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!kcbPay?.kcb_reference) {
    return { ok: false as const, reason: 'no_success_payment' as const, status: booking.payment_status as string }
  }

  const receipt =
    (kcbPay.response_payload as { Body?: { stkCallback?: { CallbackMetadata?: { Item?: { Name: string; Value?: string }[] } } } } | null)
      ?.Body?.stkCallback?.CallbackMetadata?.Item?.find((i) => i.Name === 'MpesaReceiptNumber')?.Value ||
    kcbPay.kcb_reference

  await settleBookingFromKcb({
    bookingId,
    amount: Number(kcbPay.amount),
    mpesaReceipt: String(receipt),
    checkoutRequestId: String(kcbPay.kcb_reference),
    rawBody: kcbPay.response_payload || {},
  })

  return { ok: true as const, status: 'paid' as const, already: false as const }
}

export async function getKcbPaymentStatus(opts: { internalReference?: string; kcbReference?: string }) {
  if (!opts.internalReference && !opts.kcbReference) {
    throw new KcbValidationError('Provide internalReference or kcbReference')
  }
  let q = supabaseAdmin.from('kcb_payment_requests').select('*')
  if (opts.internalReference) q = q.eq('internal_reference', opts.internalReference)
  else q = q.eq('kcb_reference', opts.kcbReference!)
  const { data, error } = await q.maybeSingle()
  if (error) throw new KcbApiError('Failed to load payment status', 500)
  return data
}

export async function markProcessingTimeouts(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()
  const { data } = await supabaseAdmin
    .from('kcb_payment_requests')
    .update({
      status: 'TIMEOUT',
      error_code: 'TIMEOUT',
      error_message: 'No callback received within expected window',
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('status', 'PROCESSING')
    .lt('updated_at', cutoff)
    .select('id')
  return data?.length || 0
}

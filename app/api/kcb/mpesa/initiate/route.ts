import { NextRequest, NextResponse } from 'next/server'
import { createAndSendKcbPayment } from '@/lib/kcb/service'
import { toPublicError } from '@/lib/kcb/errors'
import { isKcbConfigured } from '@/lib/kcb/config'

/**
 * POST /api/kcb/mpesa/initiate
 * Body: { amount, phoneNumber, reference, description?, idempotencyKey?, sourceType?, sourceId? }
 */
export async function POST(req: NextRequest) {
  try {
    if (!isKcbConfigured()) {
      return NextResponse.json({ error: 'KCB payment gateway is not configured' }, { status: 503 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = await createAndSendKcbPayment({
      amount: Number((body as { amount?: unknown }).amount),
      phoneNumber: String((body as { phoneNumber?: unknown }).phoneNumber || ''),
      reference: String((body as { reference?: unknown }).reference || ''),
      description: (body as { description?: string }).description,
      idempotencyKey: (body as { idempotencyKey?: string }).idempotencyKey,
      sourceType: (body as { sourceType?: string }).sourceType,
      sourceId: (body as { sourceId?: string }).sourceId,
    })

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      internalReference: result.payment.internal_reference,
      kcbReference: result.payment.kcb_reference,
      status: result.payment.status,
      amount: result.payment.amount,
      phoneNumber: result.payment.phone_number,
    })
  } catch (err) {
    const pub = toPublicError(err)
    return NextResponse.json({ ok: false, error: pub.error, code: pub.code }, { status: pub.status })
  }
}

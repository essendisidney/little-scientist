import { NextRequest, NextResponse } from 'next/server'
import { getKcbPaymentStatus, markProcessingTimeouts } from '@/lib/kcb/service'
import { toPublicError } from '@/lib/kcb/errors'

/**
 * GET /api/kcb/mpesa/status?internalReference=...|&kcbReference=...
 * POST { internalReference?, kcbReference?, markTimeouts?: boolean }
 *
 * Reads our ledger of KCB requests. Does not call a KCB query API unless
 * portal Swagger documents one (see docs/kcb/CONTRACT.md gaps).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const payment = await getKcbPaymentStatus({
      internalReference: sp.get('internalReference') || undefined,
      kcbReference: sp.get('kcbReference') || undefined,
    })
    if (!payment) return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })
    return NextResponse.json({
      ok: true,
      internalReference: payment.internal_reference,
      kcbReference: payment.kcb_reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      phoneNumber: payment.phone_number,
      errorCode: payment.error_code,
      errorMessage: payment.error_message,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      completedAt: payment.completed_at,
    })
  } catch (err) {
    const pub = toPublicError(err)
    return NextResponse.json({ ok: false, error: pub.error, code: pub.code }, { status: pub.status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      internalReference?: string
      kcbReference?: string
      markTimeouts?: boolean
    }

    if (body.markTimeouts) {
      const count = await markProcessingTimeouts(15)
      return NextResponse.json({ ok: true, timedOut: count })
    }

    const payment = await getKcbPaymentStatus({
      internalReference: body.internalReference,
      kcbReference: body.kcbReference,
    })
    if (!payment) return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })
    return NextResponse.json({
      ok: true,
      internalReference: payment.internal_reference,
      kcbReference: payment.kcb_reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      phoneNumber: payment.phone_number,
      errorCode: payment.error_code,
      errorMessage: payment.error_message,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      completedAt: payment.completed_at,
    })
  } catch (err) {
    const pub = toPublicError(err)
    return NextResponse.json({ ok: false, error: pub.error, code: pub.code }, { status: pub.status })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { kcbCallbackAck } from '@/lib/kcb/mpesa-express'
import { processKcbCallback } from '@/lib/kcb/service'

/**
 * POST /api/kcb/mpesa/callback
 * KCB IPN / STK callback. Always acknowledges to avoid endless retries when possible.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const result = await processKcbCallback(body)

    if (!result.ok && result.reason === 'malformed') {
      console.error('KCB callback malformed')
      return NextResponse.json(kcbCallbackAck(), { status: 200 })
    }

    if (!result.ok && result.reason === 'unknown_reference') {
      console.error('KCB callback unknown CheckoutRequestID')
      return NextResponse.json(kcbCallbackAck(), { status: 200 })
    }

    return NextResponse.json(kcbCallbackAck(), { status: 200 })
  } catch (err) {
    console.error('KCB callback processing error')
    return NextResponse.json(kcbCallbackAck(), { status: 200 })
  }
}

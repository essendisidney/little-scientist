import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMpesaCallback } from '@/lib/mpesa'
import { postMerchPayment } from '@/lib/accounting'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseMpesaCallback(body)
    if (!parsed) return NextResponse.json({ ok: true })

    const { success, checkoutRequestId, mpesaReceiptNumber, resultDesc } = parsed

    const { data: order } = await supabaseAdmin
      .from('merch_orders')
      .select('*')
      .eq('mpesa_checkout_request_id', checkoutRequestId)
      .single()

    if (!order) return NextResponse.json({ ok: true })

    if (success && mpesaReceiptNumber) {
      await supabaseAdmin
        .from('merch_orders')
        .update({
          status: 'paid',
          mpesa_receipt_number: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      await postMerchPayment({
        orderType: (order.order_type as 'preorder' | 'pos') || 'pos',
        orderId: order.id,
        amountKes: order.amount_kes,
        mpesaReceipt: mpesaReceiptNumber,
      })
    } else {
      await supabaseAdmin
        .from('merch_orders')
        .update({
          status: 'failed',
          failure_reason: resultDesc || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Merch callback error:', err)
    return NextResponse.json({ ok: true })
  }
}


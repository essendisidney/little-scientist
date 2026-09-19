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

    let order: Record<string, unknown> | null = null
    const byCheckout = await supabaseAdmin
      .from('merch_orders')
      .select('*')
      .eq('mpesa_checkout_request_id', checkoutRequestId)
      .maybeSingle()
    if (byCheckout.data) {
      order = byCheckout.data as Record<string, unknown>
    } else {
      // Fallback when checkout id was only stored in notes (schema without mpesa_* columns)
      const { data: rows } = await supabaseAdmin
        .from('merch_orders')
        .select('*')
        .ilike('notes', `%checkout:${checkoutRequestId}%`)
        .limit(1)
      order = (rows?.[0] as Record<string, unknown>) || null
    }

    if (!order) return NextResponse.json({ ok: true })

    if (success && mpesaReceiptNumber) {
      const paidPatch = {
        status: 'paid',
        payment_status: 'paid',
        mpesa_receipt_number: mpesaReceiptNumber,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabaseAdmin.from('merch_orders').update(paidPatch).eq('id', order.id)
      if (error) {
        await supabaseAdmin
          .from('merch_orders')
          .update({
            payment_status: 'paid',
            updated_at: new Date().toISOString(),
            notes: `${order.notes || ''}|paid:${mpesaReceiptNumber}`.slice(0, 500),
          })
          .eq('id', order.id as string)
      }

      await postMerchPayment({
        orderType: (order.order_type as 'preorder' | 'pos') || 'pos',
        orderId: order.id as string,
        amountKes: Number(order.amount_kes ?? order.total_kes ?? 0),
        mpesaReceipt: mpesaReceiptNumber,
      })
    } else {
      const failPatch = {
        status: 'failed',
        payment_status: 'failed',
        failure_reason: resultDesc || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabaseAdmin.from('merch_orders').update(failPatch).eq('id', order.id)
      if (error) {
        await supabaseAdmin
          .from('merch_orders')
          .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', order.id as string)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Merch callback error:', err)
    return NextResponse.json({ ok: true })
  }
}

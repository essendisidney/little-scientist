import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseMpesaCallback } from '@/lib/mpesa'
import { postInVenuePurchase } from '@/lib/accounting'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = parseMpesaCallback(body)
    if (!parsed) return NextResponse.json({ ok: true })

    const { success, checkoutRequestId, mpesaReceiptNumber, resultDesc } = parsed

    const { data: purchase } = await supabaseAdmin
      .from('in_venue_purchases')
      .select('*')
      .eq('mpesa_checkout_request_id', checkoutRequestId)
      .single()

    if (!purchase) return NextResponse.json({ ok: true })

    if (success && mpesaReceiptNumber) {
      await supabaseAdmin
        .from('in_venue_purchases')
        .update({
          payment_status: 'paid',
          mpesa_receipt_number: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id)

      await postInVenuePurchase({
        purchaseId: purchase.id,
        amountKes: purchase.total_kes,
        mpesaReceipt: mpesaReceiptNumber,
      })

      await supabaseAdmin.from('audit_log').insert({
        action: 'INVENUE_CONFIRMED',
        entity: 'in_venue_purchases',
        entity_id: purchase.id,
        performed_by: purchase.served_by || 'staff',
        metadata: {
          amount: purchase.total_kes,
          mpesa_receipt: mpesaReceiptNumber,
        },
      })
    } else {
      await supabaseAdmin.from('in_venue_purchases').update({ payment_status: 'failed' }).eq('id', purchase.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('In-venue callback error:', err)
    return NextResponse.json({ ok: true })
  }
}

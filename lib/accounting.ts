import { supabaseAdmin } from './supabase'

async function postEntry(p: {
  description: string
  sourceType: string
  sourceId: string
  debitCode: string
  creditCode: string
  amountKes: number
  mpesaReceipt?: string
}) {
  const { error } = await supabaseAdmin.rpc('post_journal_entry', {
    p_description: p.description,
    p_source_type: p.sourceType,
    p_source_id: p.sourceId,
    p_debit_code: p.debitCode,
    p_credit_code: p.creditCode,
    p_amount_kes: p.amountKes,
    p_mpesa_receipt: p.mpesaReceipt || null,
  })
  if (error) console.error('Journal entry failed:', error.message)
}

export async function postTicketPayment(p: {
  bookingId: string
  ticketAmountKes: number
  platformFeeKes: number
  mpesaReceipt: string
}) {
  await postEntry({
    description: `Ticket booking — ${p.mpesaReceipt}`,
    sourceType: 'booking',
    sourceId: p.bookingId,
    debitCode: '1001',
    creditCode: '4001',
    amountKes: p.ticketAmountKes,
    mpesaReceipt: p.mpesaReceipt,
  })
  if (p.platformFeeKes > 0) {
    await postEntry({
      description: `Platform fee — ${p.bookingId}`,
      sourceType: 'booking',
      sourceId: p.bookingId,
      debitCode: '1001',
      creditCode: '4010',
      amountKes: p.platformFeeKes,
      mpesaReceipt: p.mpesaReceipt,
    })
  }
}

export async function postMerchPayment(p: {
  orderType: 'preorder' | 'pos'
  orderId: string
  amountKes: number
  mpesaReceipt: string
}) {
  await postEntry({
    description: `Merch ${p.orderType} — ${p.mpesaReceipt}`,
    sourceType: 'merch_order',
    sourceId: p.orderId,
    debitCode: '1001',
    creditCode: p.orderType === 'preorder' ? '2001' : '4002',
    amountKes: p.amountKes,
    mpesaReceipt: p.mpesaReceipt,
  })
}

export async function postInVenuePurchase(p: {
  purchaseId: string
  amountKes: number
  mpesaReceipt: string
}) {
  await postEntry({
    description: `In-venue — ${p.mpesaReceipt}`,
    sourceType: 'in_venue_purchase',
    sourceId: p.purchaseId,
    debitCode: '1001',
    creditCode: '4003',
    amountKes: p.amountKes,
    mpesaReceipt: p.mpesaReceipt,
  })
}

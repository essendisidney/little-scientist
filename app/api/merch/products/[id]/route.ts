import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  try {
    const { id } = await context.params
    const body = await req.json()
    const { isActive, priceKes, stockQty, variantId } = body as Record<string, unknown>

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (isActive != null) {
      const active = Boolean(isActive)
      let { error } = await supabaseAdmin
        .from('merch_products')
        .update({ is_active: active, active })
        .eq('id', id)
      if (error && /is_active|schema cache/i.test(error.message)) {
        const r = await supabaseAdmin.from('merch_products').update({ active }).eq('id', id)
        error = r.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (priceKes != null || stockQty != null) {
      const targetVariantId = variantId ? String(variantId) : null
      if (!targetVariantId) {
        return NextResponse.json({ error: 'Missing variantId for price/stock update' }, { status: 400 })
      }
      const update: Record<string, unknown> = {}
      if (priceKes != null) update.price_kes = Number(priceKes)
      if (stockQty != null) update.stock_qty = Number(stockQty)

      let { error } = await supabaseAdmin
        .from('merch_variants')
        .update(update)
        .eq('id', targetVariantId)
        .eq('product_id', id)

      if (error && /stock_qty|schema cache/i.test(error.message)) {
        const fallback: Record<string, unknown> = {}
        if (priceKes != null) fallback.price_kes = Number(priceKes)
        const r = await supabaseAdmin
          .from('merch_variants')
          .update(fallback)
          .eq('id', targetVariantId)
          .eq('product_id', id)
        error = r.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update product' },
      { status: 500 },
    )
  }
}

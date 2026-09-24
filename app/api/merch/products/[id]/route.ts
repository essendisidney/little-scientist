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
      const { error } = await supabaseAdmin
        .from('merch_products')
        .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (priceKes != null) {
      const price = Number(priceKes)
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('merch_products')
        .update({ base_price_kes: price, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (stockQty != null) {
      const stock = Math.max(0, Math.round(Number(stockQty)))
      const targetVariantId = variantId ? String(variantId) : null
      if (targetVariantId) {
        const { error } = await supabaseAdmin
          .from('merch_variants')
          .update({ stock_qty: stock, updated_at: new Date().toISOString() })
          .eq('id', targetVariantId)
          .eq('product_id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const { data: inv } = await supabaseAdmin
          .from('merch_inventory')
          .select('id')
          .eq('product_id', id)
          .eq('variant_id', targetVariantId)
          .eq('location', 'main')
          .maybeSingle()

        if (inv?.id) {
          await supabaseAdmin.from('merch_inventory').update({ quantity_on_hand: stock, updated_at: new Date().toISOString() }).eq('id', inv.id)
        } else {
          await supabaseAdmin.from('merch_inventory').insert({
            product_id: id,
            variant_id: targetVariantId,
            location: 'main',
            quantity_on_hand: stock,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update product' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(req, ['admin'])
  if ('error' in auth) return auth.error

  try {
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await supabaseAdmin.from('merch_inventory_log').delete().eq('product_id', id)
    await supabaseAdmin.from('merch_inventory').delete().eq('product_id', id)

    const { error } = await supabaseAdmin.from('merch_products').delete().eq('id', id)
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete this product. Deactivate it instead if it has sales.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete product' },
      { status: 500 },
    )
  }
}

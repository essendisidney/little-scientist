import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

function skuFromName(name: string) {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 18) || 'ITEM'
  return `${base}-${Date.now().toString(36).toUpperCase()}`
}

function normalizeProduct(row: Record<string, unknown>) {
  const basePrice = Number(row.base_price_kes ?? 0)
  const variants = ((row.merch_variants as Record<string, unknown>[]) || []).map((v) => ({
    ...v,
    name: (v.variant_value as string) || (v.name as string) || 'Default',
    is_active: v.is_active ?? true,
    stock_qty: Number(v.stock_qty ?? 0),
    // UI reads price_kes; production stores the selling price on the product.
    price_kes: basePrice + Number(v.price_adjustment_kes ?? 0),
  }))
  return {
    ...row,
    category: row.category ?? null,
    is_active: row.is_active ?? true,
    price_kes: basePrice,
    merch_variants: variants,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  const { data, error } = await supabaseAdmin
    .from('merch_products')
    .select('*, merch_variants(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: (data || []).map((p) => normalizeProduct(p as Record<string, unknown>)) })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'counter'])
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const { name, description, category, priceKes, stockQty } = body as Record<string, unknown>

    if (!name || priceKes == null || stockQty == null) {
      return NextResponse.json({ error: 'Name, price, and stock are required' }, { status: 400 })
    }

    const price = Number(priceKes)
    const stock = Math.max(0, Math.round(Number(stockQty)))
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    const sku = skuFromName(String(name))
    const { data: product, error: pErr } = await supabaseAdmin
      .from('merch_products')
      .insert({
        name: String(name).trim(),
        description: description ? String(description) : null,
        category: category ? String(category) : null,
        sku,
        base_price_kes: price,
        is_active: true,
        has_variants: true,
      })
      .select()
      .single()

    if (pErr || !product) {
      return NextResponse.json({ error: pErr?.message || 'Failed to create product' }, { status: 500 })
    }

    const { data: variant, error: vErr } = await supabaseAdmin
      .from('merch_variants')
      .insert({
        product_id: product.id,
        variant_type: 'default',
        variant_value: 'One size',
        sku_suffix: 'DEF',
        price_adjustment_kes: 0,
        stock_qty: stock,
        is_active: true,
      })
      .select('id')
      .single()

    if (vErr || !variant) {
      await supabaseAdmin.from('merch_products').delete().eq('id', product.id)
      return NextResponse.json({ error: vErr?.message || 'Failed to create variant' }, { status: 500 })
    }

    await supabaseAdmin.from('merch_inventory').insert({
      product_id: product.id,
      variant_id: variant.id,
      location: 'main',
      quantity_on_hand: stock,
    })

    return NextResponse.json({ success: true, productId: product.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create product' },
      { status: 500 },
    )
  }
}

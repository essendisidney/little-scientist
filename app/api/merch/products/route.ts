import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('merch_products')
    .select('*, merch_variants(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, category, priceKes, stockQty } = body as Record<string, unknown>

    if (!name || !category || priceKes == null || stockQty == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: product, error: pErr } = await supabaseAdmin
      .from('merch_products')
      .insert({
        name: String(name),
        description: description ? String(description) : null,
        category: String(category),
        is_active: true,
      })
      .select()
      .single()

    if (pErr || !product) return NextResponse.json({ error: pErr?.message || 'Failed to create product' }, { status: 500 })

    const { error: vErr } = await supabaseAdmin.from('merch_variants').insert({
      product_id: product.id,
      name: 'Default',
      price_kes: Number(priceKes),
      stock_qty: Number(stockQty),
      is_active: true,
    })
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

    return NextResponse.json({ success: true, productId: product.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create product' },
      { status: 500 }
    )
  }
}


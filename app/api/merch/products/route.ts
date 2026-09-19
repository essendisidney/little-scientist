import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

function normalizeProduct(row: Record<string, unknown>) {
  const variants = ((row.merch_variants as Record<string, unknown>[]) || []).map((v) => ({
    ...v,
    is_active: v.is_active ?? v.active ?? true,
    stock_qty: Number(v.stock_qty ?? 0),
  }))
  return {
    ...row,
    category: row.category ?? null,
    is_active: row.is_active ?? row.active ?? true,
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

    if (!name || !category || priceKes == null || stockQty == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert with both modern + legacy column names for mixed schemas
    const productInsert: Record<string, unknown> = {
      name: String(name),
      description: description ? String(description) : null,
      category: String(category),
      is_active: true,
      active: true,
    }

    let { data: product, error: pErr } = await supabaseAdmin
      .from('merch_products')
      .insert(productInsert)
      .select()
      .single()

    // Retry without columns that may not exist yet
    if (pErr && /category|is_active|schema cache/i.test(pErr.message)) {
      const retry: Record<string, unknown> = {
        name: String(name),
        description: description ? String(description) : null,
        active: true,
      }
      const r2 = await supabaseAdmin.from('merch_products').insert(retry).select().single()
      product = r2.data
      pErr = r2.error
      if (!pErr && product && /category/i.test(String((await supabaseAdmin.from('merch_products').update({ category: String(category) }).eq('id', product.id)).error?.message || ''))) {
        // category column still missing — product created without category
      }
    }

    if (pErr || !product) {
      return NextResponse.json(
        {
          error:
            pErr?.message ||
            'Failed to create product. Apply migration 016 to add merch category / stock columns.',
        },
        { status: 500 },
      )
    }

    const variantInsert: Record<string, unknown> = {
      product_id: product.id,
      name: 'Default',
      price_kes: Number(priceKes),
      stock_qty: Number(stockQty),
      is_active: true,
      active: true,
    }

    let { error: vErr } = await supabaseAdmin.from('merch_variants').insert(variantInsert)
    if (vErr && /stock_qty|is_active|schema cache/i.test(vErr.message)) {
      const r = await supabaseAdmin.from('merch_variants').insert({
        product_id: product.id,
        name: 'Default',
        price_kes: Number(priceKes),
        active: true,
      })
      vErr = r.error
    }
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

    return NextResponse.json({ success: true, productId: product.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create product' },
      { status: 500 },
    )
  }
}

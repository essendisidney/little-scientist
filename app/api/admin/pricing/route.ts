import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'accounting', 'counter'])
  if ('error' in auth) return auth.error

  const { data, error } = await supabaseAdmin
    .from('pricing_tiers')
    .select('*')
    .order('price_kes', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data || [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaff(req, ['admin'])
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const id = String(body?.id || '')
    const key = String(body?.key || '')
    if (!id && !key) return NextResponse.json({ error: 'id or key required' }, { status: 400 })

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: auth.staffId,
    }

    if (body.priceKes != null) update.price_kes = Math.max(0, Math.round(Number(body.priceKes)))
    if (body.free != null) update.free = Boolean(body.free)
    if (body.active != null) update.active = Boolean(body.active)
    if (body.label != null) update.label = String(body.label)
    if (body.sublabel != null) update.sublabel = String(body.sublabel)

    // If price > 0, clear free flag so birthday/under-95cm can be charged
    if (typeof update.price_kes === 'number' && (update.price_kes as number) > 0) {
      update.free = false
    }
    if (typeof update.price_kes === 'number' && (update.price_kes as number) === 0 && body.free == null) {
      update.free = true
    }

    let q = supabaseAdmin.from('pricing_tiers').update(update)
    q = id ? q.eq('id', id) : q.eq('key', key)
    const { data, error } = await q.select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('audit_log').insert({
      action: 'PRICING_UPDATED',
      entity: 'pricing_tiers',
      entity_id: data.id,
      performed_by: auth.staffId,
      metadata: update,
    })

    return NextResponse.json({ ok: true, tier: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update pricing' },
      { status: 500 },
    )
  }
}

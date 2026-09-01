import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

const STATUSES = new Set(['pending', 'contacted', 'confirmed', 'declined'])

export async function PATCH(req: NextRequest) {
  const auth = await requireStaff(req, ['admin', 'accounting'])
  if ('error' in auth) return auth.error

  try {
    const body = (await req.json()) as { type?: string; enquiryRef?: string; status?: string }
    const type = String(body.type || '').toLowerCase()
    const enquiryRef = String(body.enquiryRef || '').trim().toUpperCase()
    const status = String(body.status || '').toLowerCase()

    if (!enquiryRef || !STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid enquiry ref or status' }, { status: 400 })
    }

    const table = type === 'birthday' ? 'birthday_enquiries' : type === 'school' ? 'school_enquiries' : null
    if (!table) {
      return NextResponse.json({ error: 'type must be birthday or school' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('enquiry_ref', enquiryRef)
      .select('enquiry_ref, status')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    await supabaseAdmin.from('audit_log').insert({
      action: 'ENQUIRY_STATUS_UPDATED',
      entity: table,
      entity_id: null,
      performed_by: auth.staffId,
      metadata: { enquiry_ref: enquiryRef, status, type },
    })

    return NextResponse.json({ ok: true, enquiryRef: data.enquiry_ref, status: data.status })
  } catch (err) {
    console.error('enquiry patch error', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

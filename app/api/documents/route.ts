import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

const FALLBACKS: Record<string, { title: string; public_url: string }> = {
  general_waiver: {
    title: 'General Visit Entry Agreement & Risk Release',
    public_url: '/waivers/general-visit.pdf',
  },
  birthday_waiver: {
    title: 'Birthday Visit Entry Agreement & Risk Release',
    public_url: '/waivers/birthday-visit.pdf',
  },
  school_waiver: {
    title: 'School Visit Entry Agreement & Risk Release',
    public_url: '/waivers/school-visit.pdf',
  },
}

/** Public: list / fetch waiver document URLs. */
export async function GET(req: NextRequest) {
  const key = String(req.nextUrl.searchParams.get('key') || '').trim()

  try {
    if (key) {
      const { data } = await supabaseAdmin.from('site_documents').select('*').eq('doc_key', key).maybeSingle()
      if (data) return NextResponse.json({ document: data })
      const fb = FALLBACKS[key]
      if (fb) return NextResponse.json({ document: { doc_key: key, ...fb } })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data } = await supabaseAdmin.from('site_documents').select('*').order('doc_key')
    if (data?.length) return NextResponse.json({ documents: data })
    return NextResponse.json({
      documents: Object.entries(FALLBACKS).map(([doc_key, v]) => ({ doc_key, ...v })),
    })
  } catch {
    if (key && FALLBACKS[key]) {
      return NextResponse.json({ document: { doc_key: key, ...FALLBACKS[key] } })
    }
    return NextResponse.json({
      documents: Object.entries(FALLBACKS).map(([doc_key, v]) => ({ doc_key, ...v })),
    })
  }
}

/** Admin: upload / replace a waiver PDF. multipart: key, file */
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req, ['admin'])
  if ('error' in auth) return auth.error

  try {
    const form = await req.formData()
    const key = String(form.get('key') || '').trim()
    const title = String(form.get('title') || '').trim()
    const file = form.get('file')

    if (!key || !FALLBACKS[key]) {
      return NextResponse.json({ error: 'Invalid document key' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF must be under 12MB' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const path = `waivers/${key}-${Date.now()}.pdf`

    const { error: upErr } = await supabaseAdmin.storage.from('site-documents').upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (upErr) {
      return NextResponse.json(
        { error: `Upload failed: ${upErr.message}. Ensure storage bucket site-documents exists.` },
        { status: 500 },
      )
    }

    const { data: pub } = supabaseAdmin.storage.from('site-documents').getPublicUrl(path)
    const publicUrl = pub.publicUrl
    const docTitle = title || FALLBACKS[key].title

    const { data, error } = await supabaseAdmin
      .from('site_documents')
      .upsert(
        {
          doc_key: key,
          title: docTitle,
          file_path: path,
          public_url: publicUrl,
          updated_at: new Date().toISOString(),
          updated_by: auth.staffId,
        },
        { onConflict: 'doc_key' },
      )
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('audit_log').insert({
      action: 'DOCUMENT_UPDATED',
      entity: 'site_documents',
      entity_id: data.id,
      performed_by: auth.staffId,
      metadata: { doc_key: key, public_url: publicUrl },
    })

    return NextResponse.json({ ok: true, document: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}

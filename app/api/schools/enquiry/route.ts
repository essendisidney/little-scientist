import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInfoEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      schoolName,
      contactName,
      contactPhone,
      contactEmail,
      studentCount,
      preferredDate,
      sessionPreference,
      specialRequirements,
    } = body as Record<string, unknown>

    if (
      !schoolName ||
      !contactName ||
      !contactPhone ||
      !contactEmail ||
      !studentCount ||
      !preferredDate ||
      !sessionPreference
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      school_name: String(schoolName),
      contact_person_name: String(contactName),
      contact_phone: String(contactPhone),
      contact_email: String(contactEmail),
      student_count: Number(studentCount),
      preferred_date: String(preferredDate),
      session_preference: String(sessionPreference),
      special_requirements: specialRequirements ? String(specialRequirements) : null,
    }

    const { error: insErr } = await supabaseAdmin.from('school_enquiries').insert(payload)
    if (insErr) return NextResponse.json({ error: 'Failed to save enquiry' }, { status: 500 })

    const text = [
      'New school enquiry (Little Scientist)',
      '',
      `School name: ${payload.school_name}`,
      `Contact person: ${payload.contact_person_name}`,
      `Phone: ${payload.contact_phone}`,
      `Email: ${payload.contact_email}`,
      `Number of students: ${payload.student_count}`,
      `Preferred date: ${payload.preferred_date}`,
      `Session preference: ${payload.session_preference}`,
      `Special requirements: ${payload.special_requirements || '-'}`,
      '',
      '— Sent from littlescientist.ke',
    ].join('\n')

    await sendInfoEmail({
      subject: `School enquiry — ${payload.school_name} — ${payload.preferred_date}`,
      text,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit enquiry' },
      { status: 500 }
    )
  }
}


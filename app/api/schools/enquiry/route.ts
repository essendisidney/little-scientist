import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInfoEmail, sendGuestEmail } from '@/lib/email'
import { sanitizeGuestError } from '@/lib/guest-errors'
import { isValidKenyaPhone } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'

function makeRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = 'SCH-'
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'schools-enquiry', { limit: 8, windowMs: 60_000 })
    if (limited) return limited

    const body = await req.json()
    const {
      schoolName,
      contactName,
      contactPhone,
      contactEmail,
      studentCount,
      preferredDate,
      sessionType,
      specialRequirements,
    } = body as Record<string, unknown>

    if (
      !schoolName ||
      !contactName ||
      !contactPhone ||
      !contactEmail ||
      !studentCount ||
      !preferredDate ||
      !sessionType
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!isValidKenyaPhone(String(contactPhone))) {
      return NextResponse.json({ error: 'Enter a valid Kenyan mobile number.' }, { status: 400 })
    }

    const enquiryRef = makeRef()

    const payload = {
      school_name: String(schoolName),
      contact_name: String(contactName),
      contact_phone: String(contactPhone),
      contact_email: String(contactEmail),
      student_count: Number(studentCount),
      preferred_date: String(preferredDate),
      session_type: String(sessionType),
      special_requirements: specialRequirements ? String(specialRequirements) : null,
      status: 'pending',
      enquiry_ref: enquiryRef,
    }

    const { error: insErr } = await supabaseAdmin.from('school_enquiries').insert(payload)
    if (insErr) {
      return NextResponse.json({ error: sanitizeGuestError(insErr.message) }, { status: 500 })
    }

    const text = [
      'New school enquiry (Little Scientist)',
      '',
      `Enquiry ref: ${enquiryRef}`,
      `School name: ${payload.school_name}`,
      `Contact person: ${payload.contact_name}`,
      `Phone: ${payload.contact_phone}`,
      `Email: ${payload.contact_email}`,
      `Number of students: ${payload.student_count}`,
      `Preferred date: ${payload.preferred_date}`,
      `Session type: ${payload.session_type}`,
      `Special requirements: ${payload.special_requirements || '-'}`,
      '',
      '— Sent from littlescientist.ke',
    ].join('\n')

    await sendInfoEmail({
      subject: `School enquiry — ${enquiryRef} — ${payload.school_name}${
        String(payload.special_requirements || '').includes('CUSTOMIZED PLAN') ? ' — CUSTOM PLAN' : ''
      }`,
      text,
    })

    await sendGuestEmail({
      to: payload.contact_email,
      subject: `Little Scientist school trip enquiry — ${enquiryRef}`,
      text: [
        `Hi ${payload.contact_name},`,
        '',
        'Thank you — we received your school trip enquiry.',
        '',
        `Reference: ${enquiryRef}`,
        `School: ${payload.school_name}`,
        `Preferred date: ${payload.preferred_date}`,
        `Students: ${payload.student_count}`,
        '',
        'Our team will contact you by email or phone.',
        '',
        '— Little Scientist',
        '0700 101 425 · info@littlescientist.ke',
      ].join('\n'),
    })

    return NextResponse.json({ success: true, enquiryRef })
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeGuestError(err instanceof Error ? err.message : 'Failed to submit enquiry') },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInfoEmail, sendGuestEmail } from '@/lib/email'
import { BIRTHDAY_FOOD_NOTICE } from '@/lib/pricing'
import { sanitizeGuestError } from '@/lib/guest-errors'

function makeRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = 'BDY-'
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      parentName,
      email,
      guestCount,
      preferredDate,
      sessionPreference,
      specialRequirements,
      phone,
    } = body as Record<string, unknown>

    if (!parentName || !guestCount || !preferredDate || !sessionPreference || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailStr = String(email).trim()
    if (!emailStr.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const enquiryRef = makeRef()

    const notes = [
      `Guardian email: ${emailStr}`,
      BIRTHDAY_FOOD_NOTICE,
      specialRequirements ? String(specialRequirements) : '',
    ]
      .filter(Boolean)
      .join('\n')

    const payload = {
      parent_name: String(parentName),
      child_name: String(parentName),
      child_age: 0,
      guest_count: Number(guestCount),
      preferred_date: String(preferredDate),
      session_preference: String(sessionPreference),
      special_requirements: notes,
      phone: String(phone),
      status: 'pending',
      enquiry_ref: enquiryRef,
    }

    const { error: insErr } = await supabaseAdmin.from('birthday_enquiries').insert(payload)
    if (insErr) {
      return NextResponse.json({ error: sanitizeGuestError(insErr.message) }, { status: 500 })
    }

    const text = [
      'New birthday enquiry (Little Scientist)',
      '',
      `Enquiry ref: ${enquiryRef}`,
      `Parent / guardian: ${payload.parent_name}`,
      `Phone: ${payload.phone}`,
      `Email: ${emailStr}`,
      `Number of guests: ${payload.guest_count}`,
      `Preferred date: ${payload.preferred_date}`,
      `Session preference: ${payload.session_preference}`,
      `Notes: ${payload.special_requirements || '-'}`,
      '',
      '— Sent from littlescientist.ke',
    ].join('\n')

    await sendInfoEmail({
      subject: `Birthday enquiry — ${enquiryRef} — ${payload.parent_name} — ${payload.preferred_date}${
        String(payload.special_requirements || '').includes('CUSTOMIZED PLAN') ? ' — CUSTOM PLAN' : ''
      }`,
      text,
    })

    await sendGuestEmail({
      to: emailStr,
      subject: `Little Scientist birthday enquiry — ${enquiryRef}`,
      text: [
        `Hi ${payload.parent_name},`,
        '',
        'Thank you — we received your birthday party enquiry.',
        '',
        `Reference: ${enquiryRef}`,
        `Preferred date: ${payload.preferred_date}`,
        `Guests: ${payload.guest_count}`,
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

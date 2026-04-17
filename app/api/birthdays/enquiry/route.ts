import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInfoEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      parentName,
      childName,
      childAge,
      guestCount,
      preferredDate,
      sessionPreference,
      specialRequirements,
      phone,
    } = body as Record<string, unknown>

    if (
      !parentName ||
      !childName ||
      !childAge ||
      !guestCount ||
      !preferredDate ||
      !sessionPreference ||
      !phone
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      parent_name: String(parentName),
      child_name: String(childName),
      child_age: Number(childAge),
      guest_count: Number(guestCount),
      preferred_date: String(preferredDate),
      session_preference: String(sessionPreference),
      special_requirements: specialRequirements ? String(specialRequirements) : null,
      phone: String(phone),
    }

    const { error: insErr } = await supabaseAdmin.from('birthday_enquiries').insert(payload)
    if (insErr) return NextResponse.json({ error: 'Failed to save enquiry' }, { status: 500 })

    const text = [
      'New birthday enquiry (Little Scientist)',
      '',
      `Parent name: ${payload.parent_name}`,
      `Phone: ${payload.phone}`,
      `Child name: ${payload.child_name}`,
      `Child age: ${payload.child_age}`,
      `Number of guests: ${payload.guest_count}`,
      `Preferred date: ${payload.preferred_date}`,
      `Session preference: ${payload.session_preference}`,
      `Special requirements: ${payload.special_requirements || '-'}`,
      '',
      '— Sent from littlescientist.ke',
    ].join('\n')

    await sendInfoEmail({
      subject: `Birthday enquiry — ${payload.child_name} — ${payload.preferred_date}`,
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


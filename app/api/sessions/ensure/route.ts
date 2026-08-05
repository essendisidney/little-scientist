import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const HOURLY_SLOTS = [
  '09:00-11:00',
  '10:00-12:00',
  '11:00-13:00',
  '12:00-14:00',
  '13:00-15:00',
  '14:00-16:00',
  '15:00-17:00',
] as const

type SessionRow = {
  id: string
  session_date: string
  time_slot: string
  capacity: number
  booked_count: number
  is_blocked: boolean
}

function isDateKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

async function ensureOneDate(sessionDate: string) {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('sessions')
    .select('id, session_date, time_slot, capacity, booked_count, is_blocked')
    .eq('session_date', sessionDate)

  if (existingErr) throw new Error('Failed to check sessions.')

  const rows = (existing || []) as SessionRow[]
  const existingSlots = new Set(rows.map(r => String(r.time_slot)))
  const missingSlots = HOURLY_SLOTS.filter(s => !existingSlots.has(s))

  if (missingSlots.length > 0) {
    const toInsert = missingSlots.map(slot => ({
      id: crypto.randomUUID(),
      session_date: sessionDate,
      time_slot: slot,
      capacity: 100,
      booked_count: 0,
      is_blocked: false,
    }))
    const { error: insErr } = await supabaseAdmin.from('sessions').insert(toInsert)
    if (insErr) throw new Error('Failed to seed sessions.')
    rows.push(...toInsert)
  }

  return { created: missingSlots.length, sessions: rows }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const sessionDate = body?.sessionDate
    const sessionDates = Array.isArray(body?.sessionDates) ? body.sessionDates.filter(isDateKey) : null

    if (sessionDates && sessionDates.length > 0) {
      const unique = [...new Set(sessionDates as string[])].slice(0, 14)
      const results = await Promise.all(unique.map(d => ensureOneDate(d)))
      const byDate: Record<string, SessionRow[]> = {}
      let created = 0
      unique.forEach((d, i) => {
        byDate[d] = results[i].sessions
        created += results[i].created
      })
      return NextResponse.json({ ok: true, created, byDate })
    }

    if (!isDateKey(sessionDate)) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    }

    const result = await ensureOneDate(sessionDate)
    return NextResponse.json({ ok: true, created: result.created, sessions: result.sessions })
  } catch (err) {
    console.error('Ensure sessions error:', err)
    return NextResponse.json({ error: 'Failed to seed sessions.' }, { status: 500 })
  }
}

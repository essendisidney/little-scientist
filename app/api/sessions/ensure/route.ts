import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireStaffOrCron } from '@/lib/admin-auth'
import { todayInNairobi } from '@/lib/dates'

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
  held_count?: number
  pending_count?: number
  is_blocked: boolean
}

function isDateKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** Guest seeding uses the Nairobi calendar, not the UTC date. */
function guestSeedWindow() {
  const minKey = todayInNairobi()
  const [y, m, d] = minKey.split('-').map(Number)
  const max = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  max.setUTCDate(max.getUTCDate() + 14)
  return { minKey, maxKey: max.toISOString().slice(0, 10) }
}

async function ensureOneDate(sessionDate: string) {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('sessions')
    .select('id, session_date, time_slot, capacity, booked_count, held_count, pending_count, is_blocked')
    .eq('session_date', sessionDate)

  if (existingErr) throw new Error('Failed to check sessions.')

  const rows = (existing || []) as SessionRow[]
  const existingSlots = new Set(rows.map((r) => String(r.time_slot)))
  const missingSlots = HOURLY_SLOTS.filter((s) => !existingSlots.has(s))

  if (missingSlots.length > 0) {
    const toInsert = missingSlots.map((slot) => ({
      id: crypto.randomUUID(),
      session_date: sessionDate,
      time_slot: slot,
      capacity: 100,
      booked_count: 0,
      held_count: 0,
      is_blocked: false,
    }))
    const { error: insErr } = await supabaseAdmin.from('sessions').insert(toInsert)
    if (insErr) throw new Error('Failed to seed sessions.')
    rows.push(...toInsert)
  }

  return { created: missingSlots.length, sessions: rows }
}

export async function POST(req: NextRequest) {
  // Public booking UI seeds slots; allow unauthenticated only when creating today's/near dates
  // is too open. Prefer staff/cron; also allow if body includes only dates within next 14 days
  // AND no capacity mutations — seeding empty slots is low risk but was abused open.
  // Keep staff/cron for mutations; for guest book flow use a limited public path below.
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const auth = await requireStaffOrCron(req, ['admin', 'counter', 'accounting'])
    if ('error' in auth) return auth.error
  } else {
    // Guest book page: allow seed only (no secret ops). Rate-limit via short-circuit size.
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sessionDate = body?.sessionDate
    const sessionDates = Array.isArray(body?.sessionDates) ? body.sessionDates.filter(isDateKey) : null

    if (sessionDates && sessionDates.length > 0) {
      const unique = [...new Set(sessionDates as string[])].slice(0, 14)
      // Without auth, only allow seeding dates within the next 14 calendar days.
      if (!authHeader) {
        const { minKey, maxKey } = guestSeedWindow()
        for (const d of unique) {
          if (d < minKey || d > maxKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
        }
      }
      const results = await Promise.all(unique.map((d) => ensureOneDate(d)))
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

    if (!authHeader) {
      const { minKey, maxKey } = guestSeedWindow()
      if (sessionDate < minKey || sessionDate > maxKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await ensureOneDate(sessionDate)
    return NextResponse.json({ ok: true, created: result.created, sessions: result.sessions })
  } catch (err) {
    console.error('Ensure sessions error:', err)
    return NextResponse.json({ error: 'Failed to seed sessions.' }, { status: 500 })
  }
}

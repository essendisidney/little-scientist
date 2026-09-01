import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/admin-auth'
import { markProcessingTimeouts } from '@/lib/kcb/service'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

/**
 * GET /api/cron/payments — Vercel cron: expire stale KCB processing + old pending bookings.
 * Requires Authorization: Bearer {CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timedOut = await markProcessingTimeouts(15)

  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { data: stale } = await supabaseAdmin
    .from('bookings')
    .update({ payment_status: 'expired', updated_at: new Date().toISOString() })
    .eq('payment_status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  return NextResponse.json({
    ok: true,
    kcbTimedOut: timedOut,
    bookingsExpired: stale?.length || 0,
  })
}

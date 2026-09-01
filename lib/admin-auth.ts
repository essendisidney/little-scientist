import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type StaffRole = 'admin' | 'gate' | 'counter' | 'accounting'

export function getStaffRole(user: {
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
} | null): StaffRole {
  const raw =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    (user?.app_metadata?.roles as string[] | undefined)?.[0] ??
    (user?.user_metadata?.roles as string[] | undefined)?.[0] ??
    null
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (v === 'gate' || v === 'counter' || v === 'accounting' || v === 'admin') return v
  return 'admin'
}

export function staffLabel(user: { email?: string | null; id: string }): string {
  return user.email || user.id
}

type StaffAuthOk = { user: { id: string; email?: string | null }; role: StaffRole; staffId: string }
type StaffAuthFail = { error: NextResponse }

export async function requireStaff(req: NextRequest, allowed: StaffRole[]): Promise<StaffAuthOk | StaffAuthFail> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const user = data.user
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = getStaffRole(user)
  if (role !== 'admin' && !allowed.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, role, staffId: staffLabel(user) }
}

export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')?.trim()
  return auth === `Bearer ${secret}`
}

export async function requireStaffOrCron(
  req: NextRequest,
  allowed: StaffRole[],
): Promise<(StaffAuthOk & { cron?: false }) | { cron: true; staffId: string } | StaffAuthFail> {
  if (isCronAuthorized(req)) {
    return { cron: true, staffId: 'cron' }
  }
  const auth = await requireStaff(req, allowed)
  if ('error' in auth) return auth
  return { ...auth, cron: false as const }
}

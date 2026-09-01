import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
import { getKcbAccessToken, clearKcbTokenCache } from '@/lib/kcb/auth'
import { isKcbConfigured, getKcbConfig } from '@/lib/kcb/config'
import { toPublicError } from '@/lib/kcb/errors'
import { logKcbApiCall } from '@/lib/kcb/persistence'
import { requireStaff } from '@/lib/admin-auth'

/**
 * POST /api/kcb/auth
 * Server-side OAuth health check. Never returns the access token or client secret.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff(req, ['admin'])
    if ('error' in auth) return auth.error

    if (!isKcbConfigured()) {
      return NextResponse.json({ ok: false, error: 'KCB credentials are not configured' }, { status: 503 })
    }

    clearKcbTokenCache()
    const started = Date.now()
    await getKcbAccessToken({ forceRefresh: true })
    const config = getKcbConfig()
    await logKcbApiCall({
      endpoint: config.tokenUrl.replace(/\?.*/, ''),
      method: 'POST',
      responseStatus: 200,
      durationMs: Date.now() - started,
    })

    return NextResponse.json({
      ok: true,
      environment: config.environment,
      tokenUrlHost: (() => {
        try {
          return new URL(config.tokenUrl).host
        } catch {
          return 'configured'
        }
      })(),
      message: 'KCB access token obtained successfully (not returned).',
    })
  } catch (err) {
    const pub = toPublicError(err)
    return NextResponse.json({ ok: false, error: pub.error, code: pub.code }, { status: pub.status })
  }
}

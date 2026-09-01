import { getKcbConfig } from './config'
import { KcbAuthError } from './errors'
import type { KcbTokenResponse } from './types'

type Cache = { token: string; expiresAtMs: number }

let cache: Cache | null = null

/** Clear cached token (tests / forced refresh). */
export function clearKcbTokenCache() {
  cache = null
}

/**
 * OAuth2 client credentials — server-side only.
 * Caches token until ~60s before expiry. Never logs secrets or tokens.
 */
export async function getKcbAccessToken(opts?: { forceRefresh?: boolean }): Promise<string> {
  const now = Date.now()
  if (!opts?.forceRefresh && cache && cache.expiresAtMs > now + 60_000) {
    return cache.token
  }

  const config = getKcbConfig()
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const tokenBase = config.tokenUrl.replace(/\?.*$/, '')
  const isAccountsOauth = /accounts\.buni\.kcbgroup\.com/i.test(config.tokenUrl)
  const isApiBuni = /api\.buni\.kcbgroup\.com/i.test(config.tokenUrl)

  // api.buni (go-live email): POST …/token?grant_type=client_credentials, empty body.
  // accounts.buni: grant_type in body. UAT gateway: query string, empty body.
  const attempts: { url: string; body: string }[] = isApiBuni
    ? [
        { url: `${tokenBase}?grant_type=client_credentials`, body: '' },
        { url: tokenBase, body: 'grant_type=client_credentials' },
      ]
    : isAccountsOauth
      ? [{ url: tokenBase, body: 'grant_type=client_credentials' }]
      : [
          {
            url: config.tokenUrl.includes('grant_type=')
              ? config.tokenUrl
              : `${tokenBase}${tokenBase.includes('?') ? '&' : '?'}grant_type=client_credentials`,
            body: '',
          },
        ]

  const started = Date.now()
  let res: Response | undefined
  let lastErr: unknown
  for (const attempt of attempts) {
    try {
      res = await fetch(attempt.url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: attempt.body,
        signal: AbortSignal.timeout(10_000),
      })
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!res) {
    throw new KcbAuthError('KCB token request timed out or failed to connect', {
      durationMs: Date.now() - started,
      reason: lastErr instanceof Error ? lastErr.message : 'network',
    })
  }

  const text = await res.text()
  let data: KcbTokenResponse & { error?: string; error_description?: string }
  try {
    data = JSON.parse(text) as typeof data
  } catch {
    const hint =
      res.status === 404
        ? ' — check KCB_TOKEN_URL (production: https://api.buni.kcbgroup.com/token?grant_type=client_credentials)'
        : res.status >= 500
          ? ' — KCB auth gateway error'
          : ''
    throw new KcbAuthError(`KCB token response was not JSON (HTTP ${res.status})${hint}`, {
      status: res.status,
    })
  }

  if (!res.ok || !data.access_token) {
    throw new KcbAuthError(data.error_description || data.error || 'Failed to obtain KCB access token', {
      status: res.status,
    })
  }

  const expiresIn = Number(data.expires_in) || 3600
  cache = {
    token: data.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  }

  return cache.token
}

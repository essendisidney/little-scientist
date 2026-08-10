import { getKcbAccessToken } from './auth'
import { KcbApiError } from './errors'

export type KcbHttpResult<T> = {
  ok: boolean
  status: number
  data: T | null
  rawText: string
  durationMs: number
}

/**
 * Authenticated JSON call to KCB BUNI. Retries once on 401 with a fresh token.
 * Does not log Authorization headers, tokens, or secrets.
 */
export async function kcbFetchJson<T>(
  url: string,
  init: {
    method?: string
    body?: unknown
    /** Extra headers (e.g. Swagger routeCode / operation / messageId). Never log secrets. */
    headers?: Record<string, string>
    timeoutMs?: number
  } = {},
): Promise<KcbHttpResult<T>> {
  const method = init.method || 'POST'
  const timeoutMs = init.timeoutMs ?? 30_000

  async function once(forceRefresh: boolean): Promise<KcbHttpResult<T>> {
    const token = await getKcbAccessToken({ forceRefresh })
    const started = Date.now()
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw new KcbApiError('KCB API request failed or timed out', 504, {
        reason: err instanceof Error ? err.message : 'network',
        durationMs: Date.now() - started,
      })
    }

    const rawText = await res.text()
    let data: T | null = null
    if (rawText) {
      try {
        data = JSON.parse(rawText) as T
      } catch {
        data = null
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      rawText,
      durationMs: Date.now() - started,
    }
  }

  let result = await once(false)
  if (result.status === 401) {
    result = await once(true)
  }
  return result
}

import { supabaseAdmin } from '@/lib/supabase'

type LogInput = {
  endpoint: string
  method: string
  requestReference?: string | null
  responseStatus?: number | null
  durationMs?: number | null
  errorCode?: string | null
}

/** Persist non-secret API telemetry. Never pass tokens or client secrets. */
export async function logKcbApiCall(input: LogInput) {
  try {
    await supabaseAdmin.from('kcb_api_logs').insert({
      endpoint: input.endpoint.slice(0, 500),
      method: input.method.slice(0, 16),
      request_reference: input.requestReference || null,
      response_status: input.responseStatus ?? null,
      duration_ms: input.durationMs ?? null,
      error_code: input.errorCode || null,
    })
  } catch (err) {
    console.error('kcb_api_logs insert failed')
  }
}

export function newInternalReference(prefix = 'LS') {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${prefix}-${stamp}-${rand}`
}

/** Strip secrets from payloads before persistence. */
export function sanitizePayload(payload: unknown): unknown {
  if (payload == null) return null
  const json = JSON.stringify(payload)
  const redacted = json
    .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"[REDACTED]"')
    .replace(/"client_secret"\s*:\s*"[^"]*"/gi, '"client_secret":"[REDACTED]"')
    .replace(/"Authorization"\s*:\s*"[^"]*"/gi, '"Authorization":"[REDACTED]"')
  try {
    return JSON.parse(redacted)
  } catch {
    return { note: 'payload_redacted' }
  }
}

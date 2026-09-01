import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

function clientKey(req: NextRequest, route: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown'
  return `${route}:${ip}`
}

/** Best-effort in-memory rate limit (per serverless instance). */
export function rateLimit(
  req: NextRequest,
  route: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): NextResponse | null {
  const key = clientKey(req, route)
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (bucket.count >= limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) } },
    )
  }

  bucket.count += 1
  return null
}

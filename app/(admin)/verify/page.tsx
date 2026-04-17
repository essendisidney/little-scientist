'use client'
import { useEffect, useRef, useState } from 'react'

type Result = {
  valid: boolean
  message: string
  ticket?: {
    type: string
    bookingRef: string
    session: string
    bookerName: string | null
    adultCount: number
    childCount: number
  }
}

type OfflineTicket = {
  qr: string
  isUsed: boolean
  usedAt: string | null
  type: string
  bookingRef: string | null
  bookerName: string | null
  adultCount: number
  childCount: number
  sessionDate: string | null
  timeSlot: string | null
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function cacheKey(day: string) {
  return `ls_verify_cache_${day}`
}

function queueKey() {
  return `ls_verify_offline_queue`
}

export default function VerifyPage() {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [manualRef, setManualRef] = useState('')
  const [scanning, setScanning] = useState(true)
  const [offline, setOffline] = useState(false)
  const [cacheCount, setCacheCount] = useState(0)
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null)
  const scannerRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.onload = () => initScanner()
    document.body.appendChild(script)

    // Warm cache when online
    if (navigator.onLine) {
      refreshOfflineCache().catch(() => {})
      syncOfflineQueue().catch(() => {})
    } else {
      readCacheMeta()
    }

    return () => {
      stopScanner()
      if (document.body.contains(script)) document.body.removeChild(script)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!offline) {
      refreshOfflineCache().catch(() => {})
      syncOfflineQueue().catch(() => {})
    }
  }, [offline])

  function readCacheMeta() {
    const day = todayStr()
    try {
      const raw = localStorage.getItem(cacheKey(day))
      if (!raw) {
        setCacheCount(0)
        setCacheUpdatedAt(null)
        return
      }
      const parsed = JSON.parse(raw) as { updatedAt?: string; tickets?: Record<string, OfflineTicket> }
      const cnt = parsed.tickets ? Object.keys(parsed.tickets).length : 0
      setCacheCount(cnt)
      setCacheUpdatedAt(parsed.updatedAt || null)
    } catch {
      setCacheCount(0)
      setCacheUpdatedAt(null)
    }
  }

  async function refreshOfflineCache() {
    const day = todayStr()
    const res = await fetch('/api/verify/today')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to refresh cache')
    const ticketsArr: OfflineTicket[] = data.tickets || []
    const tickets: Record<string, OfflineTicket> = {}
    for (const t of ticketsArr) tickets[t.qr] = t
    localStorage.setItem(cacheKey(day), JSON.stringify({ updatedAt: new Date().toISOString(), tickets }))
    setCacheCount(Object.keys(tickets).length)
    setCacheUpdatedAt(new Date().toISOString())
  }

  function getOfflineTickets(): Record<string, OfflineTicket> {
    const day = todayStr()
    try {
      const raw = localStorage.getItem(cacheKey(day))
      if (!raw) return {}
      const parsed = JSON.parse(raw) as { tickets?: Record<string, OfflineTicket> }
      return parsed.tickets || {}
    } catch {
      return {}
    }
  }

  function setOfflineTickets(next: Record<string, OfflineTicket>) {
    const day = todayStr()
    localStorage.setItem(cacheKey(day), JSON.stringify({ updatedAt: new Date().toISOString(), tickets: next }))
    setCacheCount(Object.keys(next).length)
    setCacheUpdatedAt(new Date().toISOString())
  }

  function enqueueOfflineScan(qr: string) {
    try {
      const raw = localStorage.getItem(queueKey())
      const q = raw ? (JSON.parse(raw) as { qr: string; at: string }[]) : []
      q.push({ qr, at: new Date().toISOString() })
      localStorage.setItem(queueKey(), JSON.stringify(q))
    } catch {}
  }

  async function syncOfflineQueue() {
    if (!navigator.onLine) return
    let q: { qr: string; at: string }[] = []
    try {
      const raw = localStorage.getItem(queueKey())
      q = raw ? (JSON.parse(raw) as { qr: string; at: string }[]) : []
    } catch {
      q = []
    }
    if (q.length === 0) return

    const remaining: typeof q = []
    for (const item of q) {
      try {
        const res = await fetch(`/api/verify/${encodeURIComponent(item.qr)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: 'gate-staff' }),
        })
        if (!res.ok && res.status !== 409) {
          remaining.push(item)
        }
      } catch {
        remaining.push(item)
      }
    }
    localStorage.setItem(queueKey(), JSON.stringify(remaining))
  }

  function initScanner() {
    // @ts-expect-error dynamically loaded
    if (!window.Html5Qrcode) return
    try {
      // @ts-expect-error dynamically loaded
      scannerRef.current = new window.Html5Qrcode('qr-reader')
      // @ts-expect-error dynamically loaded
      scannerRef.current
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => handleScan(text),
          () => {}
        )
        .catch(() => {})
    } catch {}
  }

  function stopScanner() {
    try {
      // @ts-expect-error dynamically loaded
      scannerRef.current?.stop()
    } catch {}
  }

  async function handleScan(qrValue: string) {
    if (loading || !scanning) return
    setScanning(false)
    setLoading(true)
    stopScanner()
    try {
      if (!navigator.onLine) {
        // OFFLINE verification
        const tickets = getOfflineTickets()
        const t = tickets[qrValue]
        if (!t) {
          setResult({ valid: false, message: 'OFFLINE: Ticket not found in cached list.' })
        } else if (t.isUsed) {
          setResult({ valid: false, message: `OFFLINE: Already used${t.usedAt ? ` at ${new Date(t.usedAt).toLocaleString('en-KE')}` : ''}` })
        } else if (t.sessionDate !== todayStr()) {
          setResult({ valid: false, message: `OFFLINE: Ticket is for ${t.sessionDate}, not today.` })
        } else {
          const now = new Date().toISOString()
          tickets[qrValue] = { ...t, isUsed: true, usedAt: now }
          setOfflineTickets(tickets)
          enqueueOfflineScan(qrValue)
          setResult({
            valid: true,
            message: 'OFFLINE: Valid ticket (will sync when online).',
            ticket: {
              type: t.type,
              bookingRef: t.bookingRef || '',
              session: `${t.sessionDate} ${t.timeSlot}`,
              bookerName: t.bookerName,
              adultCount: t.adultCount,
              childCount: t.childCount,
            },
          })
        }
      } else {
        const res = await fetch(`/api/verify/${encodeURIComponent(qrValue)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: 'gate-staff' }),
        })
        const data = await res.json()
        setResult(data)
      }
    } catch {
      setResult({ valid: false, message: 'Network error. Try again.' })
    } finally {
      setLoading(false)
      timerRef.current = setTimeout(() => reset(), 6000)
    }
  }

  function reset() {
    clearTimeout(timerRef.current)
    setResult(null)
    setScanning(true)
    setManualRef('')
    setTimeout(() => initScanner(), 300)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#060d1a', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
        {offline && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'rgba(245,158,11,0.18)',
              borderBottom: '1px solid rgba(245,158,11,0.35)',
              color: '#fbbf24',
              padding: '10px 16px',
              fontWeight: 900,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>OFFLINE MODE — using cached tickets</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>
              Cache: {cacheCount} · {cacheUpdatedAt ? `Updated ${new Date(cacheUpdatedAt).toLocaleTimeString('en-KE')}` : 'Not ready'}
            </span>
          </div>
        )}
        {/* Full screen result */}
        {result && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: result.valid ? '#14532d' : '#3d1515',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 100, marginBottom: 24 }}>{result.valid ? '✅' : '❌'}</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: result.valid ? '#4ade80' : '#f87171',
                marginBottom: 12,
              }}
            >
              {result.valid ? 'VALID — Let them in' : 'INVALID — Do not admit'}
            </div>
            <div
              style={{
                fontSize: 16,
                color: result.valid ? '#86efac' : '#fca5a5',
                marginBottom: 24,
                maxWidth: 400,
              }}
            >
              {result.message}
            </div>
            {result.ticket && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '16px 28px',
                  marginBottom: 28,
                  fontSize: 16,
                  lineHeight: 2,
                }}
              >
                <div>{result.ticket.type} ticket</div>
                <div>{result.ticket.session}</div>
                {result.ticket.bookerName && <div>{result.ticket.bookerName}</div>}
                <div>
                  {result.ticket.adultCount}A · {result.ticket.childCount}C
                </div>
              </div>
            )}
            <button
              onClick={reset}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '14px 36px',
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
              }}
            >
              Scan next ticket
            </button>
            <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Auto-resets in 6 seconds
            </div>
          </div>
        )}

        <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Gate verification</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
            Point camera at visitor QR code
          </p>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <div id="qr-reader" style={{ width: '100%' }} />
            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                Verifying...
              </div>
            )}
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Or enter manually:</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={manualRef}
                onChange={e => setManualRef(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScan(manualRef)}
                placeholder="Type or paste QR value"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 14,
                  fontFamily: 'Nunito, sans-serif',
                }}
              />
              <button
                onClick={() => handleScan(manualRef)}
                style={{
                  background: 'linear-gradient(135deg,#ff5e1a,#ff8c42)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 18px',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                Check
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

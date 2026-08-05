export type SessionCapacity = {
  capacity?: number | null
  booked_count?: number | null
  held_count?: number | null
  is_blocked?: boolean | null
}

function n(v: unknown) {
  const x = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(x) || x < 0) return 0
  return Math.floor(x)
}

/** Tickets still sellable online after booked + admin-held spots. */
export function sessionOpenSpots(session: SessionCapacity) {
  if (session.is_blocked) return 0
  return Math.max(0, n(session.capacity) - n(session.booked_count) - n(session.held_count))
}

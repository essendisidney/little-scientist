export type BookingTicketSource = {
  id: string
  adult_count?: number | null
  child_count?: number | null
  infant_count?: number | null
  booking_kind?: string | null
  session_id?: string | null
}

/** Build ticket rows for a booking (Adult / Child / birthday infants). */
export function buildTicketRows(booking: BookingTicketSource): { booking_id: string; ticket_type: string }[] {
  const tickets: { booking_id: string; ticket_type: string }[] = []
  const adults = Number(booking.adult_count || 0) || 0
  const children = Number(booking.child_count || 0) || 0
  const infants = Number(booking.infant_count || 0) || 0

  for (let i = 0; i < adults; i++) tickets.push({ booking_id: booking.id, ticket_type: 'Adult' })
  for (let i = 0; i < children; i++) tickets.push({ booking_id: booking.id, ticket_type: 'Child' })
  // Under-95cm: issue QR whenever counted (admin may price them; free still gets a gate pass).
  if (infants > 0) {
    for (let i = 0; i < infants; i++) tickets.push({ booking_id: booking.id, ticket_type: 'Child under 95cm' })
  }
  return tickets
}

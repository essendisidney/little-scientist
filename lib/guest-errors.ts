/** Map internal/API errors to guest-safe copy (never expose DB/migration details). */
export function sanitizeGuestError(raw: string): string {
  const msg = String(raw || '').trim()
  if (!msg) return 'Something went wrong. Please try again or call 0700 101 425.'

  if (/adult_with_child|infant_count|party_has_minor|bookings_/i.test(msg)) {
    return 'We could not save this booking. Please adjust your party or call 0700 101 425.'
  }
  if (/migration|sql|constraint|supabase|postgres|violates check/i.test(msg)) {
    return 'Booking is temporarily unavailable. Please try again shortly or call 0700 101 425.'
  }
  if (/invalid_client|KCB_AUTH|token response was not JSON/i.test(msg)) {
    return 'Payment service is temporarily unavailable. Please try again in a moment.'
  }
  if (/Enter a valid Kenyan mobile/i.test(msg)) {
    return msg
  }
  if (/not enough spots|session is not available|not found/i.test(msg)) {
    return msg
  }
  if (msg.length > 160) {
    return 'Something went wrong. Please try again or call 0700 101 425.'
  }
  return msg
}

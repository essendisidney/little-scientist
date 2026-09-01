/** Shared Kenya mobile normalization for M-Pesa / KCB (client + server safe). */
export function normalizeKenyaPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '')
  if (/^07\d{8}$/.test(cleaned) || /^01\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`
  }
  if (/^2547\d{8}$/.test(cleaned) || /^2541\d{8}$/.test(cleaned)) {
    return cleaned
  }
  throw new Error('Enter a valid Kenyan mobile number (07… / 01… / 254…)')
}

export function isValidKenyaPhone(phone: string): boolean {
  try {
    normalizeKenyaPhone(phone)
    return true
  } catch {
    return false
  }
}

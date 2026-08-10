import nodemailer from 'nodemailer'

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM?.trim(),
  )
}

function mustGet(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export async function sendInfoEmail({
  subject,
  text,
}: {
  subject: string
  text: string
}) {
  const host = mustGet('SMTP_HOST')
  const port = Number(mustGet('SMTP_PORT'))
  const user = mustGet('SMTP_USER')
  const pass = mustGet('SMTP_PASS')
  const from = mustGet('SMTP_FROM')

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to: 'info@littlescientist.ke',
    subject,
    text,
  })
}

export type BookingTicketEmailInput = {
  to: string
  bookingRef: string
  bookerName?: string | null
  sessionDate?: string | null
  timeSlot?: string | null
  adultCount: number
  childCount: number
  totalKes: number
  mpesaReceipt?: string | null
}

/** Guest ticket confirmation. No-ops (returns sent:false) if SMTP is not configured. */
export async function sendBookingTicketsEmail(input: BookingTicketEmailInput): Promise<{ sent: boolean; reason?: string }> {
  const to = input.to.trim()
  if (!to.includes('@')) return { sent: false, reason: 'invalid_to' }
  if (!smtpConfigured()) return { sent: false, reason: 'smtp_not_configured' }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://littlescientist.ke').replace(/\/$/, '')
  const ticketUrl = `${appUrl}/ticket/${input.bookingRef}`
  const when = [input.sessionDate, input.timeSlot].filter(Boolean).join(' · ') || 'See your ticket page'
  const guests = `${input.adultCount} adult(s), ${input.childCount} child(ren)`

  try {
    const host = mustGet('SMTP_HOST')
    const port = Number(mustGet('SMTP_PORT'))
    const user = mustGet('SMTP_USER')
    const pass = mustGet('SMTP_PASS')
    const from = mustGet('SMTP_FROM')

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    const greeting = input.bookerName?.trim() ? `Hi ${input.bookerName.trim()},` : 'Hi,'
    const text = [
      greeting,
      '',
      'Your Little Scientist booking is confirmed.',
      '',
      `Booking reference: ${input.bookingRef}`,
      `When: ${when}`,
      `Guests: ${guests}`,
      `Amount: KES ${Number(input.totalKes).toLocaleString('en-KE')}`,
      input.mpesaReceipt ? `M-Pesa receipt: ${input.mpesaReceipt}` : null,
      '',
      `View tickets & QR codes: ${ticketUrl}`,
      '',
      'Show your QR codes at the gate.',
      'Tickets are non-refundable / non-transferable. Rebooking: 0700 101 425.',
      '',
      '— Little Scientist',
      'Sabaki Estate, Athi River · littlescientist.ke',
    ]
      .filter((line) => line !== null)
      .join('\n')

    await transporter.sendMail({
      from,
      to,
      bcc: 'info@littlescientist.ke',
      subject: `Little Scientist tickets — ${input.bookingRef}`,
      text,
    })
    return { sent: true }
  } catch (err) {
    console.error('sendBookingTicketsEmail failed', err instanceof Error ? err.message : err)
    return { sent: false, reason: 'send_failed' }
  }
}

import nodemailer from 'nodemailer'

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


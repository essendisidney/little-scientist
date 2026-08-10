const DARAJA_BASE =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

async function readJsonSafe(res: Response, label: string) {
  const text = await res.text()
  if (!text?.trim()) {
    throw new Error(`${label} returned an empty response (${res.status}). Check M-Pesa credentials and try again.`)
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`${label} returned an invalid response (${res.status}). Please try again shortly.`)
  }
}

export async function getMpesaToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY?.trim()
  const secret = process.env.MPESA_CONSUMER_SECRET?.trim()
  if (!key || !secret) {
    throw new Error('M-Pesa is not configured on the server (missing consumer key/secret).')
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const data = await readJsonSafe(res, 'M-Pesa auth')
  if (!data.access_token) {
    throw new Error('Failed to get M-Pesa token. Check MPESA_ENV and consumer credentials.')
  }
  return String(data.access_token)
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '')
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    return `254${cleaned.slice(1)}`
  }
  return cleaned
}

function getTimestampAndPassword() {
  const shortcode = process.env.MPESA_SHORTCODE?.trim()
  const passkey = process.env.MPESA_PASSKEY?.trim()
  if (!shortcode || !passkey) {
    throw new Error('M-Pesa is not configured on the server (missing shortcode/passkey).')
  }
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  const raw = `${shortcode}${passkey}${timestamp}`
  const password = Buffer.from(raw).toString('base64')
  return { timestamp, password, shortcode }
}

export async function initiateSTKPush({
  phone,
  amount,
  reference,
  description,
  callbackUrl,
}: {
  phone: string
  amount: number
  reference: string
  description: string
  callbackUrl: string
}) {
  if (!callbackUrl?.startsWith('https://')) {
    throw new Error('M-Pesa callback URL must be a public HTTPS address.')
  }

  const token = await getMpesaToken()
  const { timestamp, password, shortcode } = getTimestampAndPassword()

  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: normalizePhone(phone),
      PartyB: shortcode,
      PhoneNumber: normalizePhone(phone),
      CallBackURL: callbackUrl,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: description.slice(0, 13),
    }),
  })

  const data = await readJsonSafe(res, 'M-Pesa STK')
  if (String(data.ResponseCode) !== '0') {
    throw new Error(String(data.ResponseDescription || data.errorMessage || 'STK Push failed'))
  }

  return {
    checkoutRequestId: String(data.CheckoutRequestID || ''),
    merchantRequestId: String(data.MerchantRequestID || ''),
  }
}

export function parseMpesaCallback(body: Record<string, unknown>) {
  const cb = (
    body as {
      Body: {
        stkCallback: {
          ResultCode: number
          ResultDesc: string
          CheckoutRequestID: string
          CallbackMetadata?: { Item: { Name: string; Value: unknown }[] }
        }
      }
    }
  ).Body?.stkCallback

  if (!cb) return null

  const success = cb.ResultCode === 0
  let mpesaReceiptNumber: string | undefined
  let amount: number | undefined
  let phone: string | undefined

  if (success && cb.CallbackMetadata?.Item) {
    for (const item of cb.CallbackMetadata.Item) {
      if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = String(item.Value)
      if (item.Name === 'Amount') amount = Number(item.Value)
      if (item.Name === 'PhoneNumber') phone = String(item.Value)
    }
  }

  return {
    success,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    checkoutRequestId: cb.CheckoutRequestID,
    mpesaReceiptNumber,
    amount,
    phone,
  }
}

const DARAJA_BASE =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

export async function getMpesaToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64')
  const res = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get M-Pesa token')
  return data.access_token
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '')
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    return `254${cleaned.slice(1)}`
  }
  return cleaned
}

function getTimestampAndPassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  const raw = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  const password = Buffer.from(raw).toString('base64')
  return { timestamp, password }
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
  const token = await getMpesaToken()
  const { timestamp, password } = getTimestampAndPassword()

  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: normalizePhone(phone),
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: normalizePhone(phone),
      CallBackURL: callbackUrl,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: description.slice(0, 13),
    }),
  })

  const data = await res.json()
  if (data.ResponseCode !== '0') {
    throw new Error(data.ResponseDescription || 'STK Push failed')
  }

  return {
    checkoutRequestId: data.CheckoutRequestID as string,
    merchantRequestId: data.MerchantRequestID as string,
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

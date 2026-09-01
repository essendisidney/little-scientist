import { randomBytes } from 'crypto'
import { getKcbConfig } from './config'
import { kcbFetchJson } from './client'
import { KcbApiError, KcbValidationError } from './errors'
import { normalizeKenyaPhone as normalizeKenyaPhoneLib } from '@/lib/phone'
import type {
  AppMpesaInitiateInput,
  KcbStkCallbackBody,
  KcbStkPushAcceptResponse,
  KcbStkPushHeaders,
  KcbStkPushRequest,
  ParsedKcbCallback,
} from './types'

/** Swagger STKPushRequest.transactionDescription maxLength */
const TX_DESC_MAX = 13
/** Swagger STKPushRequest.invoiceNumber maxLength */
const INVOICE_MAX = 24
/** Swagger messageId header maxLength */
const MESSAGE_ID_MAX = 32

export function normalizeKenyaPhone(phone: string): string {
  try {
    return normalizeKenyaPhoneLib(phone)
  } catch {
    throw new KcbValidationError('Enter a valid Kenyan mobile number (07… / 01… / 254…)')
  }
}

export function validateInitiateInput(input: AppMpesaInitiateInput) {
  if (!input || typeof input !== 'object') {
    throw new KcbValidationError('Invalid payment request')
  }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 1) {
    throw new KcbValidationError('Amount must be at least KES 1')
  }
  if (amount > 250_000) {
    throw new KcbValidationError('Amount exceeds allowed maximum')
  }
  const reference = String(input.reference || '').trim()
  if (!reference || reference.length > 64) {
    throw new KcbValidationError('Reference is required (max 64 characters)')
  }
  const phoneNumber = normalizeKenyaPhone(String(input.phoneNumber || ''))
  // Default kept within Swagger maxLength 13
  const description = String(input.description || 'LS booking').slice(0, TX_DESC_MAX)
  return {
    amount: Math.ceil(amount),
    phoneNumber,
    reference,
    description,
    idempotencyKey: input.idempotencyKey?.trim() || undefined,
    sourceType: input.sourceType?.trim() || undefined,
    sourceId: input.sourceId?.trim() || undefined,
  }
}

/** Unique alphanumeric messageId for Swagger header (max 32). */
export function buildKcbMessageId(reference?: string): string {
  const stamp = Date.now().toString(36)
  const rand = randomBytes(4).toString('hex')
  const ref = (reference || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 8)
  const raw = ref ? `${stamp}${ref}${rand}` : `${stamp}${rand}`
  return raw.slice(0, MESSAGE_ID_MAX)
}

export function isStkAccepted(responseCode: number | string | undefined): boolean {
  return responseCode === 0 || responseCode === '0'
}

export function mapToKcbStkRequest(validated: {
  amount: number
  phoneNumber: string
  reference: string
  description: string
}): KcbStkPushRequest {
  const config = getKcbConfig()
  // KCB: invoiceNumber = till/account + "-" or "#" + your reference (e.g. 8068418-LSTEST001).
  const account = config.accountNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || '8068418'
  const refBudget = Math.max(0, INVOICE_MAX - account.length - 1)
  const ref =
    validated.reference.replace(/[^A-Za-z0-9-]/g, '').slice(0, refBudget) || 'LS'
  const invoiceNumber = `${account}-${ref}`.slice(0, INVOICE_MAX)

  return {
    phoneNumber: validated.phoneNumber,
    amount: String(validated.amount),
    invoiceNumber,
    sharedShortCode: config.sharedShortCode,
    // Swagger: when sharedShortCode is true, OrgShortCode/OrgPassKey are replaced internally.
    // Sending sandbox example "522522" returns "Merchant does not exist"; empty works on UAT.
    orgShortCode: config.sharedShortCode ? '' : config.orgShortCode,
    orgPassKey: config.sharedShortCode ? '' : config.orgPassKey,
    callbackUrl: config.callbackUrl,
    transactionDescription: validated.description.slice(0, TX_DESC_MAX),
  }
}

export function buildKcbStkHeaders(reference?: string): KcbStkPushHeaders {
  const config = getKcbConfig()
  return {
    routeCode: config.routeCode,
    operation: config.operation,
    messageId: buildKcbMessageId(reference),
  }
}

export async function initiateKcbStkPush(body: KcbStkPushRequest): Promise<{
  accept: KcbStkPushAcceptResponse
  checkoutRequestId: string
  merchantRequestId: string
  messageId: string
  durationMs: number
  rawText: string
}> {
  const config = getKcbConfig()
  const headers = buildKcbStkHeaders(body.invoiceNumber)
  const result = await kcbFetchJson<KcbStkPushAcceptResponse>(config.mpesaExpressUrl, {
    method: 'POST',
    body,
    headers: {
      routeCode: headers.routeCode,
      operation: headers.operation,
      messageId: headers.messageId,
    },
  })

  const accept = result.data || {}
  if (accept.fault) {
    throw new KcbApiError(accept.fault.description || accept.fault.message || 'KCB authentication fault', 401, accept.fault)
  }

  const responseCode = accept.response?.ResponseCode
  if (!result.ok || !isStkAccepted(responseCode) || !accept.response?.CheckoutRequestID) {
    throw new KcbApiError(
      accept.response?.ResponseDescription ||
        accept.header?.statusDescription ||
        'KCB M-Pesa Express request was not accepted',
      result.status >= 400 ? result.status : 502,
      accept,
    )
  }

  return {
    accept,
    checkoutRequestId: String(accept.response.CheckoutRequestID),
    merchantRequestId: String(accept.response.MerchantRequestID || ''),
    messageId: headers.messageId,
    durationMs: result.durationMs,
    rawText: result.rawText,
  }
}

export function parseKcbStkCallback(body: unknown): ParsedKcbCallback | null {
  if (!body || typeof body !== 'object') return null
  const cb = (body as KcbStkCallbackBody).Body?.stkCallback
  if (!cb?.CheckoutRequestID) return null

  const resultCode = Number(cb.ResultCode)
  const items = cb.CallbackMetadata?.Item || []
  let amount: number | undefined
  let mpesaReceiptNumber: string | undefined
  let phoneNumber: string | undefined
  let transactionDate: string | undefined

  for (const item of items) {
    if (item.Name === 'Amount' && item.Value != null) amount = Number(item.Value)
    if (item.Name === 'MpesaReceiptNumber' && item.Value != null) mpesaReceiptNumber = String(item.Value)
    if (item.Name === 'PhoneNumber' && item.Value != null) phoneNumber = String(item.Value)
    if (item.Name === 'TransactionDate' && item.Value != null) transactionDate = String(item.Value)
  }

  const success = resultCode === 0
  const cancelled = resultCode === 1032
  const timedOut = resultCode === 1037

  return {
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: String(cb.CheckoutRequestID),
    resultCode,
    resultDesc: String(cb.ResultDesc || ''),
    success,
    cancelled,
    timedOut,
    amount,
    mpesaReceiptNumber,
    phoneNumber,
    transactionDate,
  }
}

/** Ack body returned to KCB after receiving IPN. */
export function kcbCallbackAck() {
  return { ResultCode: 0, ResultDesc: 'Accepted' }
}

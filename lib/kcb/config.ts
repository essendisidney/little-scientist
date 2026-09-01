import type { KcbEnvironment } from './types'
import { KcbConfigError } from './errors'

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new KcbConfigError(`Missing required env: ${name}`)
  return value.trim()
}

export type KcbConfig = {
  environment: KcbEnvironment
  clientId: string
  clientSecret: string
  tokenUrl: string
  mpesaExpressUrl: string
  /** Swagger required header routeCode — Provider System Code e.g. MPESA → 207 */
  routeCode: string
  /** Swagger required header operation — default STKPush */
  operation: string
  sharedShortCode: boolean
  orgShortCode: string
  /** KCB Paybill / Vooma account number (LITTLE SCIENTIST LIMITED). */
  accountNumber: string
  businessName: string
  orgPassKey: string
  callbackUrl: string
}

/** Merchant details from KCB “PAY WITH” card for Little Scientist Limited. */
export const LS_KCB_MERCHANT = {
  businessName: 'LITTLE SCIENTIST LIMITED',
  accountNumber: '8068418',
  /** M-PESA / Airtel Money Paybill */
  paybill: '522533',
} as const

export function getKcbConfig(): KcbConfig {
  const environment = (process.env.KCB_ENVIRONMENT || 'sandbox').toLowerCase() as KcbEnvironment
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new KcbConfigError('KCB_ENVIRONMENT must be sandbox or production')
  }

  // Production (KCB go-live): api.buni.kcbgroup.com — portal developer.buni.kcbgroup.com
  const defaults =
    environment === 'production'
      ? {
          tokenUrl: 'https://api.buni.kcbgroup.com/token?grant_type=client_credentials',
          mpesaExpressUrl: 'https://api.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush',
        }
      : {
          tokenUrl: 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials',
          mpesaExpressUrl: 'https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush',
        }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const callbackUrl =
    process.env.KCB_CALLBACK_URL?.trim() ||
    (appUrl ? `${appUrl}/api/kcb/mpesa/callback` : '')

  // Own Paybill 522533 → sharedShortCode false unless explicitly overridden.
  const sharedRaw = process.env.KCB_SHARED_SHORT_CODE
  const sharedShortCode =
    sharedRaw == null || sharedRaw === ''
      ? false
      : sharedRaw.toLowerCase() !== 'false'

  return {
    environment,
    clientId: required('KCB_CLIENT_ID', process.env.KCB_CLIENT_ID),
    clientSecret: required('KCB_CLIENT_SECRET', process.env.KCB_CLIENT_SECRET),
    tokenUrl: process.env.KCB_TOKEN_URL?.trim() || defaults.tokenUrl,
    mpesaExpressUrl: process.env.KCB_MPESA_EXPRESS_URL?.trim() || defaults.mpesaExpressUrl,
    routeCode: process.env.KCB_ROUTE_CODE?.trim() || '207',
    operation: process.env.KCB_OPERATION?.trim() || 'STKPush',
    sharedShortCode,
    orgShortCode: process.env.KCB_ORG_SHORT_CODE?.trim() || LS_KCB_MERCHANT.paybill,
    accountNumber: process.env.KCB_ACCOUNT_NUMBER?.trim() || LS_KCB_MERCHANT.accountNumber,
    businessName: process.env.KCB_BUSINESS_NAME?.trim() || LS_KCB_MERCHANT.businessName,
    orgPassKey: process.env.KCB_ORG_PASS_KEY ?? '',
    callbackUrl: required('KCB_CALLBACK_URL or NEXT_PUBLIC_APP_URL', callbackUrl || undefined),
  }
}

export function isKcbConfigured(): boolean {
  return Boolean(process.env.KCB_CLIENT_ID?.trim() && process.env.KCB_CLIENT_SECRET?.trim())
}

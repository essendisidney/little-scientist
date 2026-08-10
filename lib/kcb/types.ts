/**
 * Types mapped 1:1 from docs/kcb/mpesa-express.swagger.json (MpesaExpressAPIService).
 * Callback types remain from published BUNI STK samples (not in that OpenAPI file).
 */

export type KcbEnvironment = 'sandbox' | 'production'

export type KcbPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'

export type KcbTokenResponse = {
  access_token: string
  token_type?: string
  expires_in: number
}

/** Required headers on POST /stkpush (Swagger parameters). */
export type KcbStkPushHeaders = {
  routeCode: string
  operation: string
  messageId: string
}

/**
 * STKPushRequest — all fields required per Swagger.
 * invoiceNumber maxLength 24; transactionDescription maxLength 13; phoneNumber maxLength 12.
 */
export type KcbStkPushRequest = {
  phoneNumber: string
  amount: string
  invoiceNumber: string
  sharedShortCode: boolean
  orgShortCode: string
  orgPassKey: string
  callbackUrl: string
  transactionDescription: string
}

export type KcbStkPushAcceptResponse = {
  response?: {
    MerchantRequestID?: string
    /** Swagger: integer; some gateways may return string */
    ResponseCode?: number | string
    CustomerMessage?: string
    CheckoutRequestID?: string
    ResponseDescription?: string
  }
  header?: {
    statusDescription?: string
    statusCode?: string
  }
  fault?: {
    code?: number
    message?: string
    description?: string
  }
}

export type KcbStkCallbackItem = {
  Name: string
  Value?: string | number
}

export type KcbStkCallbackBody = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string
      CheckoutRequestID?: string
      ResultCode?: number
      ResultDesc?: string
      CallbackMetadata?: {
        Item?: KcbStkCallbackItem[]
      }
    }
  }
}

export type ParsedKcbCallback = {
  merchantRequestId?: string
  checkoutRequestId: string
  resultCode: number
  resultDesc: string
  success: boolean
  cancelled: boolean
  timedOut: boolean
  amount?: number
  mpesaReceiptNumber?: string
  phoneNumber?: string
  transactionDate?: string
}

/** App-level initiate input (mapped to KcbStkPushRequest server-side). */
export type AppMpesaInitiateInput = {
  amount: number
  phoneNumber: string
  reference: string
  description?: string
  idempotencyKey?: string
  /** Optional link to booking / domain entity */
  sourceType?: string
  sourceId?: string
}

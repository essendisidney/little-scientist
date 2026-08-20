import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeKenyaPhone,
  validateInitiateInput,
  parseKcbStkCallback,
  kcbCallbackAck,
  mapToKcbStkRequest,
  buildKcbStkHeaders,
  isStkAccepted,
} from '../mpesa-express'
import { clearKcbTokenCache, getKcbAccessToken } from '../auth'
import { KcbValidationError, KcbAuthError } from '../errors'
import successCb from '../../../docs/kcb/fixtures/stk-callback-success.example.json'
import cancelCb from '../../../docs/kcb/fixtures/stk-callback-cancelled.example.json'

describe('normalizeKenyaPhone', () => {
  it('accepts 07 and 254 formats', () => {
    expect(normalizeKenyaPhone('0712123456')).toBe('254712123456')
    expect(normalizeKenyaPhone('+254712123456')).toBe('254712123456')
  })

  it('rejects invalid phone', () => {
    expect(() => normalizeKenyaPhone('123')).toThrow(KcbValidationError)
  })
})

describe('validateInitiateInput', () => {
  it('accepts a valid request', () => {
    const v = validateInitiateInput({
      amount: 100.4,
      phoneNumber: '0712123456',
      reference: 'ORDER-1',
      description: 'Test',
    })
    expect(v.amount).toBe(101)
    expect(v.phoneNumber).toBe('254712123456')
  })

  it('rejects invalid amount', () => {
    expect(() =>
      validateInitiateInput({ amount: 0, phoneNumber: '0712123456', reference: 'X' }),
    ).toThrow(/Amount/)
  })

  it('rejects missing reference', () => {
    expect(() =>
      validateInitiateInput({ amount: 10, phoneNumber: '0712123456', reference: '' }),
    ).toThrow(/Reference/)
  })
})

describe('parseKcbStkCallback', () => {
  it('parses successful callback', () => {
    const parsed = parseKcbStkCallback(successCb)
    expect(parsed?.success).toBe(true)
    expect(parsed?.mpesaReceiptNumber).toBe('TIH8BED1K4')
    expect(parsed?.checkoutRequestId).toContain('ws_CO_')
  })

  it('parses cancelled callback', () => {
    const parsed = parseKcbStkCallback(cancelCb)
    expect(parsed?.cancelled).toBe(true)
    expect(parsed?.success).toBe(false)
  })

  it('returns null for malformed callback', () => {
    expect(parseKcbStkCallback({})).toBeNull()
    expect(parseKcbStkCallback(null)).toBeNull()
  })
})

describe('kcbCallbackAck', () => {
  it('returns standard ack', () => {
    expect(kcbCallbackAck()).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' })
  })
})

describe('mapToKcbStkRequest', () => {
  const env = { ...process.env }

  beforeEach(() => {
    process.env.KCB_ENVIRONMENT = 'sandbox'
    process.env.KCB_CLIENT_ID = 'test-id'
    process.env.KCB_CLIENT_SECRET = 'test-secret'
    process.env.KCB_CALLBACK_URL = 'https://example.com/api/kcb/mpesa/callback'
    process.env.KCB_ORG_SHORT_CODE = '522533'
    process.env.KCB_ACCOUNT_NUMBER = '8068418'
    process.env.KCB_SHARED_SHORT_CODE = 'false'
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('maps shared-shortcode invoice as account-ref', () => {
    process.env.KCB_SHARED_SHORT_CODE = 'true'
    process.env.KCB_ORG_SHORT_CODE = '522522'
    const body = mapToKcbStkRequest({
      amount: 50,
      phoneNumber: '254712123456',
      reference: 'LSTEST001',
      description: 'Payment for booking visit',
    })
    expect(body.sharedShortCode).toBe(true)
    expect(body.orgShortCode).toBe('')
    expect(body.orgPassKey).toBe('')
    expect(body.invoiceNumber).toBe('8068418-LSTEST001')
    expect(body.invoiceNumber.length).toBeLessThanOrEqual(24)
    expect(body.transactionDescription.length).toBeLessThanOrEqual(13)
  })

  it('maps own-paybill invoice as account-ref', () => {
    process.env.KCB_SHARED_SHORT_CODE = 'false'
    process.env.KCB_ORG_SHORT_CODE = '522533'
    const body = mapToKcbStkRequest({
      amount: 50,
      phoneNumber: '254712123456',
      reference: 'ORDER-123',
      description: 'Payment',
    })
    expect(body).toMatchObject({
      sharedShortCode: false,
      orgShortCode: '522533',
      invoiceNumber: '8068418-ORDER-123',
    })
  })

  it('builds required Swagger STK headers', () => {
    const headers = buildKcbStkHeaders('ORDER-1')
    expect(headers.routeCode).toBe('207')
    expect(headers.operation).toBe('STKPush')
    expect(headers.messageId.length).toBeGreaterThan(0)
    expect(headers.messageId.length).toBeLessThanOrEqual(32)
  })
})

describe('isStkAccepted', () => {
  it('accepts integer and string zero', () => {
    expect(isStkAccepted(0)).toBe(true)
    expect(isStkAccepted('0')).toBe(true)
    expect(isStkAccepted(1)).toBe(false)
    expect(isStkAccepted(undefined)).toBe(false)
  })
})

describe('getKcbAccessToken', () => {
  const env = { ...process.env }

  beforeEach(() => {
    clearKcbTokenCache()
    process.env.KCB_ENVIRONMENT = 'sandbox'
    process.env.KCB_CLIENT_ID = 'test-id'
    process.env.KCB_CLIENT_SECRET = 'test-secret'
    process.env.KCB_TOKEN_URL = 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials'
    process.env.KCB_CALLBACK_URL = 'https://example.com/callback'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...env }
    clearKcbTokenCache()
  })

  it('obtains and caches token on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'tok_abc', expires_in: 3600, token_type: 'Bearer' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const t1 = await getKcbAccessToken()
    const t2 = await getKcbAccessToken()
    expect(t1).toBe('tok_abc')
    expect(t2).toBe('tok_abc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forces refresh when requested', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'tok_1', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'tok_2', expires_in: 3600 }),
      })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getKcbAccessToken()).toBe('tok_1')
    expect(await getKcbAccessToken({ forceRefresh: true })).toBe('tok_2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails cleanly on auth error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'invalid_client', error_description: 'Invalid Credentials' }),
      }),
    )
    await expect(getKcbAccessToken({ forceRefresh: true })).rejects.toBeInstanceOf(KcbAuthError)
  })
})

describe('initiateKcbStkPush', () => {
  const env = { ...process.env }

  beforeEach(() => {
    clearKcbTokenCache()
    process.env.KCB_ENVIRONMENT = 'sandbox'
    process.env.KCB_CLIENT_ID = 'test-id'
    process.env.KCB_CLIENT_SECRET = 'test-secret'
    process.env.KCB_TOKEN_URL = 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials'
    process.env.KCB_MPESA_EXPRESS_URL = 'https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush'
    process.env.KCB_CALLBACK_URL = 'https://example.com/callback'
    process.env.KCB_ORG_SHORT_CODE = '522533'
    process.env.KCB_ACCOUNT_NUMBER = '8068418'
    process.env.KCB_SHARED_SHORT_CODE = 'false'
  })

  afterEach(() => {
    process.env = { ...env }
    clearKcbTokenCache()
    vi.unstubAllGlobals()
  })

  it('returns checkout id on accept (ResponseCode integer per Swagger)', async () => {
    const { initiateKcbStkPush } = await import('../mpesa-express')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            response: {
              MerchantRequestID: 'm1',
              ResponseCode: 0,
              CheckoutRequestID: 'ws_CO_1',
              ResponseDescription: 'Success',
            },
            header: { statusCode: '0', statusDescription: 'Success' },
          }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const res = await initiateKcbStkPush({
      phoneNumber: '254712123456',
      amount: '1',
      invoiceNumber: '8068418-INV',
      sharedShortCode: false,
      orgShortCode: '522533',
      orgPassKey: '',
      callbackUrl: 'https://example.com/callback',
      transactionDescription: 'LS booking',
    })
    expect(res.checkoutRequestId).toBe('ws_CO_1')
    expect(res.messageId.length).toBeGreaterThan(0)

    const stkCall = fetchMock.mock.calls[1]
    const stkHeaders = stkCall[1].headers as Record<string, string>
    expect(stkHeaders.routeCode).toBe('207')
    expect(stkHeaders.operation).toBe('STKPush')
    expect(stkHeaders.messageId).toBe(res.messageId)
  })

  it('throws on KCB API failure', async () => {
    const { initiateKcbStkPush } = await import('../mpesa-express')
    const { KcbApiError } = await import('../errors')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              response: {},
              header: { statusCode: '1', statusDescription: 'Bad Request - Invalid Remarks' },
            }),
        }),
    )

    await expect(
      initiateKcbStkPush({
        phoneNumber: '254712123456',
        amount: '1',
        invoiceNumber: '8068418-X',
        sharedShortCode: false,
        orgShortCode: '522533',
        orgPassKey: '',
        callbackUrl: 'https://example.com/callback',
        transactionDescription: 'LS booking',
      }),
    ).rejects.toBeInstanceOf(KcbApiError)
  })
})

# KCB BUNI M-Pesa Express — Contract Mapping

**Status:** Mapped 1:1 from official portal export [`mpesa-express.swagger.json`](./mpesa-express.swagger.json)  
**OpenAPI:** `MpesaExpressAPIService` v1.0.0 (`openapi: 3.0.0`)

Sources:

1. [`mpesa-express.swagger.json`](./mpesa-express.swagger.json) — portal download (authoritative for STK)
2. [BUNI Getting Started](https://buni.kcbgroup.com/getting-started) — OAuth client credentials (token endpoint is outside this Swagger)

---

## 1. OAuth (Client Credentials)

OAuth is **not** defined as a path in the MpesaExpress Swagger. Security schemes listed: `oauth2` (implicit authorize URL), `basic_auth`, `api_key` (`apikey` header). Runtime STK calls use **Bearer access token** from client-credentials (Getting Started).

| Item | Value |
|------|--------|
| Sandbox token URL (Getting Started) | `https://uat.buni.kcbgroup.com/token?grant_type=client_credentials` |
| Production token URL (go-live) | `https://api.buni.kcbgroup.com/token?grant_type=client_credentials` |
| Portal OAuth2 token URL (legacy) | `https://accounts.buni.kcbgroup.com/oauth2/token` |
| Method | `POST` |
| Auth header | `Authorization: Basic {Base64(clientId:clientSecret)}` |
| Success | `{ "access_token": "...", "token_type": "Bearer", "expires_in": 3599 }` |

**Config:** Set `KCB_TOKEN_URL` to the URL that matches your portal keys.

---

## 2. M-Pesa Express (STK Push)

| Item | Value |
|------|--------|
| Server (Swagger) | `https://uat.buni.kcbgroup.com/mm/api/request/1.0.0` |
| Path | `POST /stkpush` |
| Full sandbox URL | `https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush` |
| Production URL (go-live) | `https://api.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush` |
| Auth | Bearer token (+ optional basic / apikey per portal) |
| `x-auth-type` | Application & Application User |

### Required headers (Swagger `parameters`)

| Header | Required | Max | Notes | Example |
|--------|----------|-----|-------|---------|
| `routeCode` | **Yes** | 64 | Provider system code e.g. MPESA | `207` |
| `operation` | **Yes** | 64 | Operation name | `STKPush` |
| `messageId` | **Yes** | 32 | Unique alphanumeric request ID from **your** system | `232323_KCBOrg_8875661561` |
| `Authorization` | Yes (runtime) | — | `Bearer {access_token}` | — |
| `Content-Type` | Yes | — | `application/json` | — |

`Access-Control-Allow-Origin` appears in Swagger as internal/hidden — do **not** send from the server.

### Request body — `STKPushRequest` (all listed fields **required**)

| Field | Type | Max | Notes |
|-------|------|-----|-------|
| `phoneNumber` | string | 12 | `2547XXXXXXXX` |
| `amount` | string | 18 | No decimals |
| `invoiceNumber` | string | 24 | **KCB guidance (bank paybill):** `{account}-{merchantBrand}` e.g. `8068418-LITTLESCIENTIST` — this is what guests see on the STK prompt. Paybill 522533 always shows “KCB Bank”; own OrgPassKey does not change that. Track bookings via `CheckoutRequestID`, not invoice. |
| `sharedShortCode` | boolean | — | `true` → OrgShortCode/OrgPassKey replaced with internal values |
| `orgShortCode` | string | 12 | 5–6 digit org receiving funds |
| `orgPassKey` | string | — | Password for encrypting request; may be `""` |
| `callbackUrl` | string | — | HTTPS IPN URL |
| `transactionDescription` | string | **13** | Additional comment — **hard max 13 characters** |

### Success response — `STKPushResponse`

```json
{
  "header": {
    "statusCode": "0",
    "statusDescription": "Success"
  },
  "response": {
    "MerchantRequestID": "16813-1590513-1",
    "CheckoutRequestID": "ws_CO_271020211535314658",
    "CustomerMessage": "Success. Request accepted for processing",
    "ResponseCode": 0,
    "ResponseDescription": "Accept the service request successfully."
  }
}
```

| Field | Type (Swagger) | Success meaning |
|-------|----------------|-----------------|
| `header.statusCode` | string | Description: `0` = success (example also shows `"1\|0"`) |
| `response.ResponseCode` | **integer** | `0` = accepted for processing |
| `response.CheckoutRequestID` | string | Lookup key for callbacks / our DB |

Treat accept as success when `ResponseCode` is `0` or `"0"` **and** `CheckoutRequestID` is present. This is **not** final payment success.

### Known gateway fault shapes (outside schema)

- `{ "fault": { "code": 900901, "message": "Invalid Credentials", "description": "Invalid token" } }`
- `{ "fault": { "code": 900902, "message": "Missing Credentials", "description": "Provide credentials" } }`

---

## 3. Callback / IPN

**Not defined** in `MpesaExpressAPIService` Swagger. We keep the published Daraja-style STK callback body used by BUNI samples:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1 },
          { "Name": "MpesaReceiptNumber", "Value": "TIH8BED1K4" },
          { "Name": "Balance" },
          { "Name": "TransactionDate", "Value": 20250917150425 },
          { "Name": "PhoneNumber", "Value": 254712123456 }
        ]
      }
    }
  }
}
```

| ResultCode | Meaning |
|------------|---------|
| `0` | Success |
| `1032` | Cancelled by user |
| `1037` | User unreachable / timeout |
| `2001` | Invalid initiator / PIN issues |

**Lookup key:** `CheckoutRequestID` → `kcb_reference`.

**HTTP ack to KCB:** `{ "ResultCode": 0, "ResultDesc": "Accepted" }` (not in Swagger; standard STK ack).

---

## 4. Idempotency

Swagger does **not** document an idempotency header. We use `messageId` (unique per STK) plus app-level `idempotency_key` on `kcb_payment_requests`.

---

## 5. Remaining gaps

1. Production host confirmation (path assumed identical to UAT server pattern)
2. Exact token host for your app keys (`KCB_TOKEN_URL`)
3. Signature / IP allowlist for IPN (not in this Swagger)
4. Transaction query / status API — none in this Swagger; `/api/kcb/mpesa/status` reads **our** DB
5. Callback body schema — still from published samples, not this OpenAPI file

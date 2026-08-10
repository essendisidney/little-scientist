# KCB BUNI M-Pesa Express — Developer Guide

Contract mapping and gaps: [CONTRACT.md](./CONTRACT.md)

## 1. Configure KCB sandbox

1. Register / log in at [sandbox.buni.kcbgroup.com](https://sandbox.buni.kcbgroup.com/devportal/apis)
2. Create application **littlescientist** (or your app) and generate **Sandbox Keys**
3. Subscribe the app to **M-Pesa Express** / Lipa na M-Pesa Express API
4. Official Swagger is checked in as [`mpesa-express.swagger.json`](./mpesa-express.swagger.json)

## 2. Local credentials

Copy `.env.example` → `.env.local` (gitignored) and fill:

```env
KCB_ENVIRONMENT=sandbox
KCB_CLIENT_ID=your_consumer_key
KCB_CLIENT_SECRET=your_consumer_secret
KCB_TOKEN_URL=https://uat.buni.kcbgroup.com/token?grant_type=client_credentials
KCB_MPESA_EXPRESS_URL=https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush
KCB_CALLBACK_URL=https://YOUR_PUBLIC_HTTPS/api/kcb/mpesa/callback
KCB_ORG_SHORT_CODE=522533
KCB_ACCOUNT_NUMBER=8068418
KCB_BUSINESS_NAME=LITTLE SCIENTIST LIMITED
KCB_SHARED_SHORT_CODE=false
KCB_ROUTE_CODE=207
KCB_OPERATION=STKPush
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Merchant card details: [MERCHANT.md](./MERCHANT.md).

If your portal keys only work with `https://accounts.buni.kcbgroup.com/oauth2/token`, set `KCB_TOKEN_URL` to that URL.

**Never** use `NEXT_PUBLIC_` for KCB secrets. **Never** paste secrets into chat or commit them.

## 3. Run the app

```bash
npm install
npm run dev
```

Apply migration `supabase/migrations/012_kcb_payments.sql` to your Supabase project before testing initiate/callback persistence.

## 4. Test OAuth

```bash
curl -X POST http://localhost:3000/api/kcb/auth
```

Expect `{ "ok": true, ... }` — the access token is **not** returned.

## 5. Initiate M-Pesa Express

```bash
curl -X POST http://localhost:3000/api/kcb/mpesa/initiate \
  -H "Content-Type: application/json" \
  -d "{\"amount\":1,\"phoneNumber\":\"2547XXXXXXXX\",\"reference\":\"TEST-001\",\"description\":\"Sandbox test\",\"idempotencyKey\":\"test-001\"}"
```

Response includes `internalReference`, `kcbReference` (CheckoutRequestID), and `status: PROCESSING` when KCB accepts the STK.

## 6. Callbacks

KCB POSTs the STK result to `KCB_CALLBACK_URL` (`/api/kcb/mpesa/callback`).

- Local: expose HTTPS with ngrok / Cloudflare tunnel pointing to your Next server
- Production: `https://littlescientist.ke/api/kcb/mpesa/callback`

Duplicate callbacks are idempotent (no double ledger / tickets).

Check status:

```bash
curl "http://localhost:3000/api/kcb/mpesa/status?internalReference=KCB-..."
```

## 7. Deploy to Vercel

Add the same `KCB_*` variables in the Vercel project → Settings → Environment Variables (Production + Preview as needed). Redeploy after saving.

Set:

- `KCB_CALLBACK_URL=https://littlescientist.ke/api/kcb/mpesa/callback`
- `NEXT_PUBLIC_APP_URL=https://littlescientist.ke`

## 8. Required environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `KCB_ENVIRONMENT` | Yes | `sandbox` or `production` |
| `KCB_CLIENT_ID` | Yes | Consumer key |
| `KCB_CLIENT_SECRET` | Yes | Consumer secret |
| `KCB_TOKEN_URL` | Recommended | Override default token host |
| `KCB_MPESA_EXPRESS_URL` | Recommended | Override STK URL |
| `KCB_CALLBACK_URL` | Yes* | Or derive from `NEXT_PUBLIC_APP_URL` |
| `KCB_ORG_SHORT_CODE` | Yes for own Paybill | Production Paybill `522533` |
| `KCB_SHARED_SHORT_CODE` | Default `false` | `true` only when using KCB shared shortcode |
| `KCB_ROUTE_CODE` | Default `207` | Swagger required header (MPESA) |
| `KCB_OPERATION` | Default `STKPush` | Swagger required header |
| `PAYMENT_PROVIDER` | Optional | `kcb` / `auto` / `daraja` |

## 9. Sandbox → production

1. Complete KCB go-live (signed letter to BUNI support)
2. Generate **Production Keys** in the portal
3. Set `KCB_ENVIRONMENT=production`
4. Set production `KCB_TOKEN_URL` / `KCB_MPESA_EXPRESS_URL` / org shortcode
5. Point `KCB_CALLBACK_URL` at your live HTTPS callback
6. Smoke-test OAuth + 1 KES STK before going live for customers

## 10. Switch booking payments to KCB

```env
PAYMENT_PROVIDER=kcb
```

Online booking initiate then uses BUNI; leave unset or `daraja` for Safaricom Daraja.

## Tests

```bash
npm test
```

Unit tests cover validation, phone normalize, callback parsing, ack body, and mapping — without calling live KCB.

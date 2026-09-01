# Card / IPG (blocked until Swagger)

There is **no** `card-ipg.swagger.json` in this folder yet.

1. BUNI portal → APIs → subscribe the card/IPG API  
2. Documents → Download Swagger  
3. Save as [`card-ipg.swagger.json`](./card-ipg.swagger.json)

Until then, checkout remains **M-Pesa only**.

## Production M-Pesa (go-live)

**Portal:** [developer.buni.kcbgroup.com/devportal/apis](https://developer.buni.kcbgroup.com/devportal/apis)  
**Login:** `little_scientist` (reset password in portal if needed)

**Token:** `https://api.buni.kcbgroup.com/token?grant_type=client_credentials`

**STK:** `https://api.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush`

**Client id casing:** Production Consumer Key is `…NAsh…` (lowercase `h`). Using `…NAsH…` causes `invalid_client`.

**invoiceNumber:** `{account}-{merchantBrand}` e.g. `8068418-LITTLESCIENTIST` (shown on STK prompt; bank paybill 522533 always displays “KCB Bank”)

**STK branding:** Use `sharedShortCode: true` with branded `invoiceNumber`. Own paybill OrgPassKey does not replace “KCB Bank” on 522533.

```env
KCB_SHARED_SHORT_CODE=true
KCB_INVOICE_BRAND=LITTLESCIENTIST
```

**Vercel (Production):**

```env
KCB_ENVIRONMENT=production
KCB_TOKEN_URL=https://api.buni.kcbgroup.com/token?grant_type=client_credentials
KCB_MPESA_EXPRESS_URL=https://api.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush
PAYMENT_PROVIDER=kcb
```

Remove old overrides pointing at `accounts.buni…` or `uat.buni…` unless KCB support says otherwise.

**Legacy hosts (pre go-live):** `accounts.buni.kcbgroup.com/oauth2/token` and UAT STK were workarounds; prefer `api.buni.kcbgroup.com` now.

## SMS tickets

Not implemented — no SMS provider in the project. Email confirmation is supported when `SMTP_*` env vars are set.

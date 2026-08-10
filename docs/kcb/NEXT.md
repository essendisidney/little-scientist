# Card / IPG (blocked until Swagger)

There is **no** `card-ipg.swagger.json` in this folder yet.

1. BUNI portal → APIs → subscribe the card/IPG API  
2. Documents → Download Swagger  
3. Save as [`card-ipg.swagger.json`](./card-ipg.swagger.json)

Until then, checkout remains **M-Pesa only**.

## Production M-Pesa (blocked until keys work)

Sandbox STK works with sandbox consumer keys. Production `client_credentials` previously returned `invalid_client`.

Next ops steps:

1. BUNI → Production Keys → **CURL TO GENERATE ACCESS TOKEN** with `grant_type=client_credentials`  
2. Confirm curl returns `access_token`  
3. Set Vercel `KCB_ENVIRONMENT=production`, production token/STK URLs, and working production client id/secret  
4. Set `KCB_SHARED_SHORT_CODE=false` and Paybill `522533` only after go-live confirms merchant settlement  

## SMS tickets

Not implemented — no SMS provider in the project. Email confirmation is supported when `SMTP_*` env vars are set.

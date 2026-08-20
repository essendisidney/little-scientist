# Card / IPG (blocked until Swagger)

There is **no** `card-ipg.swagger.json` in this folder yet.

1. BUNI portal → APIs → subscribe the card/IPG API  
2. Documents → Download Swagger  
3. Save as [`card-ipg.swagger.json`](./card-ipg.swagger.json)

Until then, checkout remains **M-Pesa only**.

## Production M-Pesa

**Client id casing:** Production Consumer Key is `…NAsh…` (lowercase `h`). Using `…NAsH…` causes `invalid_client`.

**Token:** `https://accounts.buni.kcbgroup.com/oauth2/token` + `grant_type=client_credentials` works with the Production keys.

**STK host:** As of last probe, `https://buni.kcbgroup.com/mm/api/request/1.0.0/stkpush` returns **404**. Production app tokens are accepted by the **UAT** STK path:

`https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush`

Portal “CURL TO GENERATE ACCESS TOKEN” may show `grant_type=password` placeholders — the server should still use **client_credentials**.

**Paybill 522533:** Own shortcode still returns “Merchant does not exist” until BUNI go-live provisions it. Shared shortcode + empty `orgShortCode` is the working STK shape.

## SMS tickets

Not implemented — no SMS provider in the project. Email confirmation is supported when `SMTP_*` env vars are set.

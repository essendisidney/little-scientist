# Little Scientist Limited — KCB merchant card

From the official KCB “PAY WITH” instruction card:

| Field | Value |
|-------|--------|
| Business name | LITTLE SCIENTIST LIMITED |
| Account number | `8068418` |
| M-PESA Paybill | `522533` |
| Airtel Money Paybill | `522533` |
| Vooma | Vooma App or `*844#` |
| T-kash | Dial `*334#` |

## How the app uses this

| Env / config | Value |
|--------------|--------|
| `KCB_ORG_SHORT_CODE` | `522533` (Paybill) |
| `KCB_ACCOUNT_NUMBER` | `8068418` |
| `KCB_BUSINESS_NAME` | `LITTLE SCIENTIST LIMITED` |
| `KCB_SHARED_SHORT_CODE` | `false` (own paybill, not KCB shared sandbox code) |

STK `invoiceNumber` is built as `8068418-{bookingRef}` so the paybill account number is always present for settlement.

Manual customer payments (outside the app) use the same Paybill **522533** + Account **8068418**.

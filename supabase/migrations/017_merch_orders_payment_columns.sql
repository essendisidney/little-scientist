-- Align merch_orders with POS / KCB settle code (status + amount_kes + M-Pesa fields)
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS amount_kes numeric;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS quantity int;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS unit_price_kes numeric;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id text;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS mpesa_merchant_request_id text;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS mpesa_receipt_number text;
ALTER TABLE merch_orders ADD COLUMN IF NOT EXISTS failure_reason text;

UPDATE merch_orders
SET status = COALESCE(NULLIF(status, ''), payment_status, 'pending')
WHERE status IS NULL OR status = 'pending';

UPDATE merch_orders
SET amount_kes = COALESCE(amount_kes, total_kes)
WHERE amount_kes IS NULL AND total_kes IS NOT NULL;

-- Allow KCB and admin manual marks on payments.payment_channel
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_channel_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_payment_channel_check
  CHECK (payment_channel = ANY (ARRAY['mpesa'::text, 'visa'::text, 'paybill'::text, 'kcb_buni'::text, 'manual'::text]));

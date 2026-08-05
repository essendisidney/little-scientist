-- Visit kind + optional party metadata for birthday/school self-bookings.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_kind text NOT NULL DEFAULT 'general';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS party_meta jsonb;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_kind_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_kind_check
  CHECK (booking_kind IN ('general', 'birthday', 'school'));

INSERT INTO coa_accounts (code, name, account_type, normal_balance) VALUES
  ('4004', 'School Visits', 'revenue', 'credit'),
  ('4005', 'Events & Parties', 'revenue', 'credit')
ON CONFLICT (code) DO NOTHING;

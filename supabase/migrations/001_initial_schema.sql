-- 001: Initial schema (sessions, bookings, tickets, payments, receipts, audit)

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  session_date date,
  time_slot text,
  capacity int DEFAULT 50,
  booked_count int DEFAULT 0,
  is_blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  session_id uuid REFERENCES sessions(id),
  booker_phone text NOT NULL,
  booker_name text,
  adult_count int NOT NULL CHECK (adult_count >= 1),
  child_count int NOT NULL CHECK (child_count >= 1),
  total_amount_kes numeric NOT NULL,
  platform_fee_kes numeric DEFAULT 0,
  payment_method text DEFAULT 'mpesa',
  payment_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  ticket_type text NOT NULL,
  qr_code text UNIQUE DEFAULT gen_random_uuid()::text,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  used_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  payment_channel text,
  amount_kes numeric,
  mpesa_checkout_request_id text,
  mpesa_merchant_request_id text,
  mpesa_receipt_number text,
  mpesa_phone text,
  status text DEFAULT 'processing',
  failure_reason text,
  settled_at timestamptz,
  raw_callback jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etr_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  payment_id uuid REFERENCES payments(id),
  receipt_number text,
  amount_kes numeric,
  source_type text,
  source_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  performed_by text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE etr_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated + service_role full access
CREATE POLICY "auth+service all sessions"
  ON sessions FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth+service all bookings"
  ON bookings FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth+service all tickets"
  ON tickets FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth+service all payments"
  ON payments FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth+service all etr_receipts"
  ON etr_receipts FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth+service all audit_log"
  ON audit_log FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

-- Public (anon) policies
CREATE POLICY "public select sessions"
  ON sessions FOR SELECT
  USING (auth.role() = 'anon');

CREATE POLICY "public insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.role() = 'anon');

CREATE POLICY "public select bookings (phone or ref)"
  ON bookings FOR SELECT
  USING (
    auth.role() = 'anon'
    AND (
      booking_ref = (auth.jwt() ->> 'booking_ref')
      OR booker_phone = (auth.jwt() ->> 'phone')
      OR booking_ref = (auth.jwt() ->> 'ref')
    )
  );

CREATE POLICY "public select tickets by booking_id"
  ON tickets FOR SELECT
  USING (
    auth.role() = 'anon'
    AND booking_id::text = (auth.jwt() ->> 'booking_id')
  );


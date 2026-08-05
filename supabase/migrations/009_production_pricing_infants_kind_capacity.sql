-- Production fix: migrations 004 + 006 + 007 + 008
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT / DROP IF EXISTS)

-- ===== 004 pricing_tiers =====
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  label         text NOT NULL,
  sublabel      text NOT NULL,
  price_kes     integer NOT NULL DEFAULT 0,
  vat_rate      numeric(4,2) NOT NULL DEFAULT 0.16,
  free          boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    text
);

INSERT INTO pricing_tiers (key, label, sublabel, price_kes, vat_rate, free, active) VALUES
  ('adult',  'Adults (18+)',              '18 years and above',             1000, 0.16, false, true),
  ('child',  'Children (95cm – 17 yrs)',  '95cm height to 17 years',         800, 0.16, false, true),
  ('infant', 'Under 95cm',               'Height under 95cm — FREE entry',     0, 0.00, true,  true)
ON CONFLICT (key) DO UPDATE SET
  label     = EXCLUDED.label,
  sublabel  = EXCLUDED.sublabel,
  price_kes = EXCLUDED.price_kes,
  vat_rate  = EXCLUDED.vat_rate,
  free      = EXCLUDED.free,
  active    = EXCLUDED.active;

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read pricing" ON pricing_tiers;
CREATE POLICY "Public can read pricing"
  ON pricing_tiers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can update pricing" ON pricing_tiers;
CREATE POLICY "Service role can update pricing"
  ON pricing_tiers FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated can update pricing" ON pricing_tiers;
CREATE POLICY "Authenticated can update pricing"
  ON pricing_tiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can insert pricing" ON pricing_tiers;
CREATE POLICY "Authenticated can insert pricing"
  ON pricing_tiers FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_active_pricing()
RETURNS TABLE (key text, label text, sublabel text, price_kes integer, vat_rate numeric, free boolean)
LANGUAGE sql STABLE AS $$
  SELECT key, label, sublabel, price_kes, vat_rate, free
  FROM pricing_tiers
  WHERE active = true
  ORDER BY price_kes DESC;
$$;

-- ===== 006 infant_count =====
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS infant_count int NOT NULL DEFAULT 0;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_child_count_check;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_adult_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_adult_count_check CHECK (adult_count >= 1);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_child_count_check CHECK (child_count >= 0);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_infant_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_infant_count_check CHECK (infant_count >= 0);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_party_has_minor_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_party_has_minor_check
  CHECK ((child_count + infant_count) >= 1);

-- ===== 007 booking_kind =====
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

-- ===== 008 session capacity 100 =====
ALTER TABLE sessions
  ALTER COLUMN capacity SET DEFAULT 100;

UPDATE sessions
SET capacity = 100
WHERE capacity < 100;

-- Migration 004: Pricing configuration table
-- Allows admin to change prices without touching code

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,   -- 'adult' | 'child' | 'infant'
  label         text NOT NULL,
  sublabel      text NOT NULL,
  price_kes     integer NOT NULL DEFAULT 0,
  vat_rate      numeric(4,2) NOT NULL DEFAULT 0.16,
  free          boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    text
);

-- Seed with confirmed prices
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

-- RLS: anyone can read, only service role can write
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read pricing"
  ON pricing_tiers FOR SELECT USING (true);

CREATE POLICY "Service role can update pricing"
  ON pricing_tiers FOR ALL USING (auth.role() = 'service_role');

-- Helper function to get current active prices
CREATE OR REPLACE FUNCTION get_active_pricing()
RETURNS TABLE (key text, label text, sublabel text, price_kes integer, vat_rate numeric, free boolean)
LANGUAGE sql STABLE AS $$
  SELECT key, label, sublabel, price_kes, vat_rate, free
  FROM pricing_tiers
  WHERE active = true
  ORDER BY price_kes DESC;
$$;


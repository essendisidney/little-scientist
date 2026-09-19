-- 016: Repair production schema gaps blocking admin + merch + pricing + accounting

-- 1) Pricing tiers (missing entirely on some environments)
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
  ('infant', 'Under 95cm',               'Height under 95cm — editable price', 0, 0.16, false, true),
  ('birthday_adult',  'Birthday Adults (18+)', 'Birthday package — adults', 1500, 0.16, false, true),
  ('birthday_child',  'Birthday Children', 'Birthday package — 95cm to 17 yrs', 1500, 0.16, false, true),
  ('birthday_infant', 'Birthday Under 95cm', 'Birthday package — under 95cm', 800, 0.16, false, true)
ON CONFLICT (key) DO UPDATE SET
  label     = EXCLUDED.label,
  sublabel  = EXCLUDED.sublabel,
  active    = true;

-- Allow authenticated staff to read; writes go through service-role API
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read pricing" ON pricing_tiers;
CREATE POLICY "Public can read pricing"
  ON pricing_tiers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can update pricing" ON pricing_tiers;
CREATE POLICY "Service role can update pricing"
  ON pricing_tiers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2) COA active flag (accounting page selects it)
ALTER TABLE coa_accounts ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
UPDATE coa_accounts SET active = true WHERE active IS NULL;

-- 3) Merch products / variants columns expected by admin UI
ALTER TABLE merch_products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE merch_products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE merch_products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill is_active from legacy `active` if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merch_products' AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE merch_products SET is_active = COALESCE(is_active, active, true)';
  ELSE
    UPDATE merch_products SET is_active = COALESCE(is_active, true);
  END IF;
END $$;

ALTER TABLE merch_variants ADD COLUMN IF NOT EXISTS stock_qty integer DEFAULT 0;
ALTER TABLE merch_variants ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE merch_variants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merch_variants' AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE merch_variants SET is_active = COALESCE(is_active, active, true)';
  ELSE
    UPDATE merch_variants SET is_active = COALESCE(is_active, true);
  END IF;
END $$;

-- Backfill stock from merch_inventory if that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merch_inventory' AND column_name = 'quantity_on_hand'
  ) THEN
    UPDATE merch_variants v
    SET stock_qty = COALESCE((
      SELECT COALESCE(SUM(i.quantity_on_hand), 0)
      FROM merch_inventory i
      WHERE i.variant_id = v.id
    ), v.stock_qty, 0);
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merch_inventory' AND column_name = 'quantity_in_stock'
  ) THEN
    UPDATE merch_variants v
    SET stock_qty = COALESCE((
      SELECT COALESCE(SUM(i.quantity_in_stock), 0)
      FROM merch_inventory i
      WHERE i.variant_id = v.id
    ), v.stock_qty, 0);
  END IF;
END $$;

-- 4) Site documents (waivers / PDFs) managed by admin
CREATE TABLE IF NOT EXISTS site_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key       text UNIQUE NOT NULL, -- general_waiver | birthday_waiver | school_waiver
  title         text NOT NULL,
  file_path     text,                 -- storage path or public URL path
  public_url    text NOT NULL,
  updated_at    timestamptz DEFAULT now(),
  updated_by    text
);

INSERT INTO site_documents (doc_key, title, public_url) VALUES
  ('general_waiver',  'General Visit Entry Agreement & Risk Release',  '/waivers/general-visit.pdf'),
  ('birthday_waiver', 'Birthday Visit Entry Agreement & Risk Release', '/waivers/birthday-visit.pdf'),
  ('school_waiver',   'School Visit Entry Agreement & Risk Release',   '/waivers/school-visit.pdf')
ON CONFLICT (doc_key) DO NOTHING;

ALTER TABLE site_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read site_documents" ON site_documents;
CREATE POLICY "Public can read site_documents"
  ON site_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages site_documents" ON site_documents;
CREATE POLICY "Service role manages site_documents"
  ON site_documents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Storage bucket for admin-uploaded waiver PDFs (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-documents', 'site-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read site-documents" ON storage.objects;
CREATE POLICY "Public read site-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-documents');

DROP POLICY IF EXISTS "Service role write site-documents" ON storage.objects;
CREATE POLICY "Service role write site-documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'site-documents' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'site-documents' AND auth.role() = 'service_role');

-- Walk-up in-venue / merch: ticket QR optional (e.g. rider buying merch)
ALTER TABLE in_venue_purchases ALTER COLUMN booking_id DROP NOT NULL;

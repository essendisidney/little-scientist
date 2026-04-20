-- 002: Merchandise schema

CREATE TABLE IF NOT EXISTS merch_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES merch_categories(id),
  name text NOT NULL,
  description text,
  sku text UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merch_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES merch_products(id),
  name text NOT NULL,
  price_kes numeric NOT NULL,
  sku text UNIQUE,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS merch_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES merch_variants(id),
  quantity_in_stock int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  order_ref text UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  status text DEFAULT 'pending',
  total_kes numeric,
  mpesa_checkout_request_id text,
  mpesa_receipt_number text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merch_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES merch_orders(id),
  variant_id uuid REFERENCES merch_variants(id),
  quantity int NOT NULL,
  unit_price_kes numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS merch_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES merch_orders(id),
  amount_kes numeric,
  status text,
  mpesa_receipt_number text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merch_inventory_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES merch_variants(id),
  change_qty int,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- RLS (service role full access)
ALTER TABLE merch_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_inventory_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service all merch_categories"
  ON merch_categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_products"
  ON merch_products FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_variants"
  ON merch_variants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_inventory"
  ON merch_inventory FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_orders"
  ON merch_orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_order_items"
  ON merch_order_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_payments"
  ON merch_payments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all merch_inventory_log"
  ON merch_inventory_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


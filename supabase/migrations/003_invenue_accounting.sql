-- 003: In-venue purchases + accounting ledger

CREATE TABLE IF NOT EXISTS in_venue_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  purchase_ref text UNIQUE DEFAULT upper(concat('INV-', substring(gen_random_uuid()::text, 1, 6))),
  category text,
  description text,
  quantity int DEFAULT 1,
  unit_price_kes numeric,
  total_kes numeric,
  payment_status text DEFAULT 'pending',
  mpesa_checkout_request_id text,
  mpesa_receipt_number text,
  served_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coa_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  normal_balance text NOT NULL,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date DEFAULT current_date,
  description text,
  source_type text,
  source_id uuid,
  debit_account_code text REFERENCES coa_accounts(code),
  credit_account_code text REFERENCES coa_accounts(code),
  amount_kes numeric NOT NULL,
  mpesa_receipt text,
  created_at timestamptz DEFAULT now()
);

-- Seed chart of accounts
INSERT INTO coa_accounts (code, name, account_type, normal_balance) VALUES
  ('1001', 'M-Pesa Float',          'asset',     'debit'),
  ('2001', 'Deferred Revenue',      'liability', 'credit'),
  ('4001', 'Ticket Revenue',        'revenue',   'credit'),
  ('4002', 'Merchandise Revenue',   'revenue',   'credit'),
  ('4003', 'In-Venue Revenue',      'revenue',   'credit'),
  ('4010', 'Platform Fee Revenue',  'revenue',   'credit')
ON CONFLICT (code) DO NOTHING;

-- Views
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  a.code,
  a.name,
  a.account_type,
  COALESCE(SUM(CASE WHEN j.debit_account_code = a.code THEN j.amount_kes ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN j.credit_account_code = a.code THEN j.amount_kes ELSE 0 END), 0) AS net_balance
FROM coa_accounts a
LEFT JOIN journal_entries j
  ON j.debit_account_code = a.code OR j.credit_account_code = a.code
GROUP BY a.code, a.name, a.account_type;

CREATE OR REPLACE VIEW v_general_ledger AS
SELECT
  j.entry_date,
  j.created_at,
  j.description,
  j.source_type,
  j.source_id,
  j.debit_account_code,
  j.credit_account_code,
  j.amount_kes,
  j.mpesa_receipt
FROM journal_entries j
ORDER BY j.entry_date DESC, j.created_at DESC;

CREATE OR REPLACE VIEW v_daily_cashbook AS
SELECT
  j.entry_date,
  SUM(j.amount_kes) FILTER (WHERE j.debit_account_code = '1001') AS mpesa_inflows_kes
FROM journal_entries j
GROUP BY j.entry_date
ORDER BY j.entry_date DESC;

CREATE OR REPLACE VIEW v_revenue_by_stream AS
SELECT
  j.entry_date,
  j.credit_account_code AS revenue_account,
  SUM(j.amount_kes) AS revenue_kes
FROM journal_entries j
WHERE j.credit_account_code IN ('4001','4002','4003','4010')
GROUP BY j.entry_date, j.credit_account_code
ORDER BY j.entry_date DESC, j.credit_account_code;

CREATE OR REPLACE VIEW v_visitor_spend AS
SELECT
  b.booking_ref,
  b.booker_phone,
  b.total_amount_kes AS ticket_spend_kes,
  COALESCE(SUM(p.total_kes) FILTER (WHERE p.payment_status = 'paid'), 0) AS in_venue_spend_kes
FROM bookings b
LEFT JOIN in_venue_purchases p ON p.booking_id = b.id
GROUP BY b.booking_ref, b.booker_phone, b.total_amount_kes;

-- RPC: post_journal_entry
CREATE OR REPLACE FUNCTION post_journal_entry(
  p_description text,
  p_source_type text,
  p_source_id uuid,
  p_debit_code text,
  p_credit_code text,
  p_amount_kes numeric,
  p_mpesa_receipt text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO journal_entries (
    description,
    source_type,
    source_id,
    debit_account_code,
    credit_account_code,
    amount_kes,
    mpesa_receipt
  ) VALUES (
    p_description,
    p_source_type,
    p_source_id,
    p_debit_code,
    p_credit_code,
    p_amount_kes,
    p_mpesa_receipt
  );
END;
$$;

-- RLS
ALTER TABLE in_venue_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service all in_venue_purchases"
  ON in_venue_purchases FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all coa_accounts"
  ON coa_accounts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service all journal_entries"
  ON journal_entries FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated can SELECT
CREATE POLICY "authenticated select in_venue_purchases"
  ON in_venue_purchases FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated select coa_accounts"
  ON coa_accounts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated select journal_entries"
  ON journal_entries FOR SELECT
  USING (auth.role() = 'authenticated');


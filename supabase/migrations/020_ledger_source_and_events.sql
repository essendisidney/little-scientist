-- Ledger screen reads source_id and account codes that the view did not expose.
-- Birthday ticket posts use source type "events", which the check did not allow.
CREATE OR REPLACE VIEW public.v_general_ledger AS
 SELECT je.entry_date,
    je.entry_ref,
    je.description,
    da.code AS debit_code,
    da.name AS debit_account,
    ca.code AS credit_code,
    ca.name AS credit_account,
    je.amount_kes,
    je.mpesa_receipt,
    je.source_type,
    je.is_reconciled,
    je.created_at,
    je.source_id,
    da.code AS debit_account_code,
    ca.code AS credit_account_code
   FROM journal_entries je
     JOIN coa_accounts da ON da.id = je.debit_account_id
     JOIN coa_accounts ca ON ca.id = je.credit_account_id
  ORDER BY je.entry_date DESC, je.created_at DESC;

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'booking'::text,
    'merch_order'::text,
    'in_venue_purchase'::text,
    'school_invoice'::text,
    'manual'::text,
    'refund'::text,
    'events'::text,
    'birthday'::text,
    'school'::text
  ]));

-- KCB BUNI payment tracking (no secrets / access tokens stored)

CREATE TABLE IF NOT EXISTS public.kcb_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_reference text NOT NULL,
  kcb_reference text,
  merchant_request_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'KES',
  phone_number text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT')),
  idempotency_key text,
  source_type text,
  source_id uuid,
  request_payload jsonb,
  response_payload jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS kcb_payment_requests_internal_reference_uidx
  ON public.kcb_payment_requests (internal_reference);

CREATE UNIQUE INDEX IF NOT EXISTS kcb_payment_requests_idempotency_key_uidx
  ON public.kcb_payment_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS kcb_payment_requests_kcb_reference_idx
  ON public.kcb_payment_requests (kcb_reference);

CREATE INDEX IF NOT EXISTS kcb_payment_requests_status_idx
  ON public.kcb_payment_requests (status);

CREATE TABLE IF NOT EXISTS public.kcb_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid NOT NULL REFERENCES public.kcb_payment_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  external_reference text,
  payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kcb_payment_events_payment_request_id_idx
  ON public.kcb_payment_events (payment_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS kcb_payment_events_dedupe_uidx
  ON public.kcb_payment_events (payment_request_id, event_type, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.kcb_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text NOT NULL,
  request_reference text,
  response_status integer,
  duration_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kcb_api_logs_created_at_idx
  ON public.kcb_api_logs (created_at DESC);

ALTER TABLE public.kcb_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kcb_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kcb_api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kcb_payment_requests_admin_all ON public.kcb_payment_requests;
CREATE POLICY kcb_payment_requests_admin_all
  ON public.kcb_payment_requests
  FOR ALL
  USING (auth.role() IN ('authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS kcb_payment_events_admin_all ON public.kcb_payment_events;
CREATE POLICY kcb_payment_events_admin_all
  ON public.kcb_payment_events
  FOR ALL
  USING (auth.role() IN ('authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS kcb_api_logs_admin_all ON public.kcb_api_logs;
CREATE POLICY kcb_api_logs_admin_all
  ON public.kcb_api_logs
  FOR ALL
  USING (auth.role() IN ('authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

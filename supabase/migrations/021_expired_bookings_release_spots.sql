-- Nightly cleanup marks abandoned checkouts as expired. That status was
-- rejected, so the pending hold was never released.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'expired'::text]));

CREATE OR REPLACE FUNCTION public.release_session_booked(p_session_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_count <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.sessions
  SET booked_count = GREATEST(0, booked_count - p_count)
  WHERE id = p_session_id;
END;
$$;

-- Failed payments must not keep tomorrow's spots. Paid headcount is the booked count.
-- Pending holds only count for checkouts started in the last day.
UPDATE public.sessions s
SET
  booked_count = COALESCE((
    SELECT SUM(b.adult_count + b.child_count + b.infant_count)
    FROM public.bookings b
    WHERE b.session_id = s.id AND b.payment_status = 'paid'
  ), 0),
  pending_count = COALESCE((
    SELECT SUM(b.adult_count + b.child_count + b.infant_count)
    FROM public.bookings b
    WHERE b.session_id = s.id
      AND b.payment_status = 'pending'
      AND b.created_at > now() - interval '24 hours'
  ), 0)
WHERE s.session_date >= CURRENT_DATE;

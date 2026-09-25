-- Paying a booking used to add adult_count + child_count here, and then
-- confirm_session_booking added the full party again (including under 95cm).
-- One adult and one under-95cm visitor occupied 3 spots. Capacity is now
-- counted only when tickets are issued.
CREATE OR REPLACE FUNCTION public.update_session_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

UPDATE public.sessions s
SET booked_count = COALESCE((
  SELECT SUM(b.adult_count + b.child_count + COALESCE(b.infant_count, 0))::int
  FROM public.bookings b
  WHERE b.session_id = s.id
    AND b.payment_status = 'paid'
), 0)
WHERE s.session_date >= CURRENT_DATE;

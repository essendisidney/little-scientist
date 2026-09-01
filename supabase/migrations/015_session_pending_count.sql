-- Hold session spots while M-Pesa payment is pending (prevents overselling).

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS pending_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_pending_count_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_pending_count_check CHECK (pending_count >= 0);

COMMENT ON COLUMN public.sessions.pending_count IS
  'Tickets reserved by unpaid bookings. Open spots = capacity - booked_count - held_count - pending_count.';

CREATE OR REPLACE FUNCTION public.reserve_session_pending(p_session_id uuid, p_count int)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_open int;
BEGIN
  IF p_count <= 0 THEN
    RETURN true;
  END IF;

  SELECT GREATEST(
    0,
    capacity - booked_count - COALESCE(held_count, 0) - pending_count
  )
  INTO v_open
  FROM public.sessions
  WHERE id = p_session_id
    AND NOT COALESCE(is_blocked, false)
  FOR UPDATE;

  IF v_open IS NULL OR v_open < p_count THEN
    RETURN false;
  END IF;

  UPDATE public.sessions
  SET pending_count = pending_count + p_count
  WHERE id = p_session_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_session_pending(p_session_id uuid, p_count int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_count <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.sessions
  SET pending_count = GREATEST(0, pending_count - p_count)
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_session_booking(p_session_id uuid, p_count int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_count <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.sessions
  SET
    pending_count = GREATEST(0, pending_count - p_count),
    booked_count = booked_count + p_count
  WHERE id = p_session_id;
END;
$$;

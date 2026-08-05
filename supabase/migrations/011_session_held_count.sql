-- Admin can hold / block a number of tickets in a slot without closing it.
-- Example: capacity 100, held_count 5 → 95 tickets remain sellable online.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS held_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_held_count_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_held_count_check CHECK (held_count >= 0);

COMMENT ON COLUMN public.sessions.held_count IS
  'Tickets reserved/blocked by admin inside an open slot. Open spots = capacity - booked_count - held_count.';

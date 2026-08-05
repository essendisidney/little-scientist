-- Allow logged-in staff to block / unblock session slots.
-- Production previously only had sessions_public_read (SELECT).

DROP POLICY IF EXISTS sessions_admin_update ON public.sessions;
CREATE POLICY sessions_admin_update
  ON public.sessions
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

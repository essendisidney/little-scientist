-- Gate passes for under-95cm visitors use this label. The previous check
-- only allowed Adult, Child, and School Group, so those inserts failed.
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check
  CHECK (ticket_type = ANY (ARRAY['Adult'::text, 'Child'::text, 'School Group'::text, 'Child under 95cm'::text]));

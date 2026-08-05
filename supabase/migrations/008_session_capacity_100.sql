-- Sessions hold 100 visitors; customer UI only reveals remaining spots at ≤10.

ALTER TABLE sessions
  ALTER COLUMN capacity SET DEFAULT 100;

-- Raise existing open sessions to 100 (keep booked_count as-is).
UPDATE sessions
SET capacity = 100
WHERE capacity < 100;

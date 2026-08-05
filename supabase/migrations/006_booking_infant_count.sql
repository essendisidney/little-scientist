-- Allow adult + free-infant parties; store infant headcount for capacity/gate.
-- Paid child tickets remain in child_count; free under-95cm visitors in infant_count.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS infant_count int NOT NULL DEFAULT 0;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_child_count_check;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_adult_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_adult_count_check CHECK (adult_count >= 1);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_child_count_check CHECK (child_count >= 0);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_infant_count_check CHECK (infant_count >= 0);

-- At least one little scientist (paid child or free infant) on every booking.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_party_has_minor_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_party_has_minor_check
  CHECK ((child_count + infant_count) >= 1);

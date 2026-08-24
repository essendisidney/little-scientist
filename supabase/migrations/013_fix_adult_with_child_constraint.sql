-- Live DB still had legacy adult_with_child (child_count >= 1), which
-- blocks adult + free under-95cm infant parties (infant_count > 0, child_count = 0).

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS adult_with_child;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_adult_with_child;

-- Ensure infant-aware party rule is present.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_party_has_minor_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_party_has_minor_check
  CHECK ((child_count + infant_count) >= 1);

-- Keep adult / child / infant bounds consistent with 006/009.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_adult_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_adult_count_check CHECK (adult_count >= 1);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_child_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_child_count_check CHECK (child_count >= 0);

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_infant_count_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_infant_count_check CHECK (infant_count >= 0);

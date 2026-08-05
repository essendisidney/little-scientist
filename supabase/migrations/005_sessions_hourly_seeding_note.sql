-- Migration 005: Ops note for seeding hourly sessions
-- This does not change runtime behavior; it stores guidance in the database schema.

COMMENT ON TABLE sessions IS
  'NOTE (ops): sessions are 2 hours long but start every hour (overlapping slots). Seed/update sessions per bookable date accordingly. Dr. Syokau must ensure Supabase contains the correct hourly slot rows before booking opens.';


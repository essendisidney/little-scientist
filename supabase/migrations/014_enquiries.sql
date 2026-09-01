-- Birthday and school enquiry tables (public form submissions + admin dashboard)

CREATE TABLE IF NOT EXISTS public.birthday_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_ref text NOT NULL UNIQUE,
  parent_name text NOT NULL,
  child_name text,
  child_age int NOT NULL DEFAULT 0,
  guest_count int NOT NULL CHECK (guest_count > 0),
  preferred_date date NOT NULL,
  session_preference text NOT NULL,
  special_requirements text,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'confirmed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_ref text NOT NULL UNIQUE,
  school_name text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text NOT NULL,
  student_count int NOT NULL CHECK (student_count > 0),
  preferred_date date NOT NULL,
  session_type text NOT NULL,
  special_requirements text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'confirmed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS birthday_enquiries_status_idx ON public.birthday_enquiries (status);
CREATE INDEX IF NOT EXISTS birthday_enquiries_created_at_idx ON public.birthday_enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS school_enquiries_status_idx ON public.school_enquiries (status);
CREATE INDEX IF NOT EXISTS school_enquiries_created_at_idx ON public.school_enquiries (created_at DESC);

ALTER TABLE public.birthday_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthday_enquiries_authenticated ON public.birthday_enquiries;
CREATE POLICY birthday_enquiries_authenticated
  ON public.birthday_enquiries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS school_enquiries_authenticated ON public.school_enquiries;
CREATE POLICY school_enquiries_authenticated
  ON public.school_enquiries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
